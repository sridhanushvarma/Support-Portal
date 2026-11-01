import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitEnquiry } from "@/lib/enquiries/submit";
import {
  processDueNotifications,
  MAX_ATTEMPTS,
  requeueNotification,
} from "@/lib/notifications/outbox";
import {
  setEmailProviderOverride,
  EmailDeliveryError,
  type EmailMessage,
} from "@/lib/email/providers";
import { saveSettings } from "@/lib/settings";
import { makeUser, publishedService, resetData, validEnquiry } from "./helpers";

let seq = 0;
const meta = (key?: string, ip = "203.0.113.10") => ({
  ip,
  requestId: "test-req",
  submissionKey: key ?? `key-${Date.now()}-${++seq}`,
});
const sent: EmailMessage[] = [];

beforeEach(async () => {
  await resetData();
  sent.length = 0;
  setEmailProviderOverride({
    name: "memory",
    send: async (m) => (sent.push(m), { messageId: String(sent.length) }),
  });
  const publisher = await makeUser(["PUBLISHER"]);
  await publishedService(publisher, "erp-solutions", "Enterprise ERP Solutions");
  await publishedService(publisher, "ai-automation", "AI and Intelligent Automation");
  await saveSettings(
    { enquiryRecipients: ["sales@example.test"], enquiryAckEnabled: true },
    publisher.id,
  );
});
afterEach(() => setEmailProviderOverride(null));

describe("enquiry submission (UC-03)", () => {
  it("stores one enquiry with services, consent, activity and queued notifications", async () => {
    const r = await submitEnquiry(
      validEnquiry({ services: ["erp-solutions", "ai-automation"] }),
      meta(),
    );
    expect(r.duplicate).toBe(false);
    expect(r.reference).toMatch(/^ENQ-/);
    const e = await prisma.enquiry.findUniqueOrThrow({
      where: { id: r.id },
      include: { serviceInterests: true, consents: true, activities: true, notifications: true },
    });
    expect(e.emailNormalized).toBe("jane@example.com");
    expect(e.email).toBe("Jane@Example.com");
    expect(e.serviceInterests.map((s) => s.serviceLabel).sort()).toEqual([
      "AI and Intelligent Automation",
      "Enterprise ERP Solutions",
    ]);
    expect(e.consents[0]).toMatchObject({ purpose: "privacy_notice_acknowledged", choice: true });
    expect(e.activities).toHaveLength(1);
    expect(e.notifications.map((n) => n.kind).sort()).toEqual(["enquiry_ack", "enquiry_internal"]);
    expect(
      await prisma.auditEvent.count({ where: { action: "enquiry.created", entityId: r.id } }),
    ).toBe(1);
  });

  it("is idempotent for the same submission key, including concurrent retries (FR-ENQ-005)", async () => {
    const key = "same-key-123456";
    const results = await Promise.all(
      [1, 2, 3].map(() => submitEnquiry(validEnquiry(), meta(key))),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await prisma.enquiry.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(2);
  });

  it("persists nothing when validation fails (UAT-03)", async () => {
    await expect(
      submitEnquiry(validEnquiry({ email: "bad", services: [] }), meta()),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { email: expect.any(Array), services: expect.any(Array) },
    });
    await expect(
      submitEnquiry(validEnquiry({ services: ["unpublished-service"] }), meta()),
    ).rejects.toMatchObject({ status: 422 });
    expect(await prisma.enquiry.count()).toBe(0);
  });

  it("rejects honeypot submissions with a neutral message", async () => {
    await expect(
      submitEnquiry(validEnquiry(), { ...meta(), honeypot: "http://spam" }),
    ).rejects.toMatchObject({ status: 400, code: "rejected" });
    expect(await prisma.enquiry.count()).toBe(0);
  });

  it("rate limits repeated submissions per visitor (FR-ENQ-006)", async () => {
    for (let i = 0; i < 5; i++)
      await submitEnquiry(validEnquiry(), meta(undefined, "198.51.100.7"));
    await expect(
      submitEnquiry(validEnquiry(), meta(undefined, "198.51.100.7")),
    ).rejects.toMatchObject({ status: 429 });
    // A different visitor is unaffected.
    await expect(
      submitEnquiry(validEnquiry(), meta(undefined, "198.51.100.8")),
    ).resolves.toBeTruthy();
  });

  it("keeps internal notifications free of contact details and the brief", async () => {
    await submitEnquiry(validEnquiry(), meta());
    await processDueNotifications();
    const internal = sent.find((m) => m.to === "sales@example.test")!;
    expect(internal.subject).toMatch(/^New enquiry ENQ-/);
    for (const forbidden of ["Jane", "Example Org", "warehouse", "Jane@Example.com"]) {
      expect(internal.text).not.toContain(forbidden);
      expect(internal.html).not.toContain(forbidden);
    }
    const ack = sent.find((m) => m.to === "Jane@Example.com")!;
    expect(ack.text).toContain("confirms receipt only");
    expect(ack.text).not.toContain("warehouse");
  });
});

describe("notification failure handling (UC-09, NFR-15, UAT-05)", () => {
  it("keeps the enquiry when email fails, retries with backoff, then dead-letters and alerts", async () => {
    setEmailProviderOverride({
      name: "down",
      send: async () => {
        throw new EmailDeliveryError("connection refused", false);
      },
    });
    const r = await submitEnquiry(validEnquiry(), meta());
    const first = await processDueNotifications();
    expect(first.failed).toBe(2);
    expect(await prisma.enquiry.count({ where: { id: r.id } })).toBe(1);
    const n = await prisma.notification.findFirstOrThrow({ where: { kind: "enquiry_internal" } });
    expect(n.status).toBe("FAILED");
    expect(n.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);

    // Fast-forward through the remaining attempts.
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await prisma.notification.updateMany({
        where: { status: "FAILED" },
        data: { nextAttemptAt: new Date(0) },
      });
      await processDueNotifications();
    }
    expect(
      await prisma.notification.count({
        where: { status: "DEAD", kind: { in: ["enquiry_internal", "enquiry_ack"] } },
      }),
    ).toBe(2);
    const alerts = await prisma.notification.findMany({ where: { kind: "ops_alert" } });
    expect(alerts).toHaveLength(2);
    expect(alerts[0]!.recipient).toBe("ops@example.test");
    expect(await prisma.enquiry.count()).toBe(1);

    // After the provider recovers, an operator can requeue and deliver.
    setEmailProviderOverride({
      name: "memory",
      send: async (m) => (sent.push(m), { messageId: "1" }),
    });
    const dead = await prisma.notification.findFirstOrThrow({
      where: { kind: "enquiry_internal" },
    });
    expect(await requeueNotification(dead.id)).toBe(true);
    await processDueNotifications();
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: dead.id } })).status).toBe(
      "SENT",
    );
  });

  it("does not retry permanent failures", async () => {
    setEmailProviderOverride({
      name: "reject",
      send: async () => {
        throw new EmailDeliveryError("550 no such user", true);
      },
    });
    await submitEnquiry(validEnquiry(), meta());
    const res = await processDueNotifications();
    expect(res.dead).toBe(2);
  });

  it("never sends the same notification twice when workers run concurrently", async () => {
    await submitEnquiry(validEnquiry(), meta());
    const results = await Promise.all([
      processDueNotifications(),
      processDueNotifications(),
      processDueNotifications(),
    ]);
    expect(results.reduce((a, r) => a + r.sent, 0)).toBe(2);
    expect(sent).toHaveLength(2);
  });
});
