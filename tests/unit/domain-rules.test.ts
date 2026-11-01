import { describe, expect, it } from "vitest";
import type { MediaAsset, Project } from "@prisma/client";
import { allowedActions, statusAfterEdit } from "@/lib/content/workflow";
import { permissionsFor } from "@/lib/auth/permissions";
import { canTransition, STATUS_TRANSITIONS } from "@/lib/enquiries/status";
import { buildEnquirySchema, enquiryRawFromFormData } from "@/lib/enquiries/schema";
import { issueFormToken, MIN_FILL_MS, verifyFormToken } from "@/lib/enquiries/form-token";
import {
  projectContentSchema,
  projectHasEvidence,
  serviceContentSchema,
} from "@/lib/content/schemas";
import { buildProjectSnapshot, publicPath } from "@/lib/content/snapshots";
import { backoffSeconds, MAX_ATTEMPTS } from "@/lib/notifications/outbox";
import { detectImageType } from "@/lib/media/service";

const editor = permissionsFor(["EDITOR"]);
const publisher = permissionsFor(["PUBLISHER"]);

describe("publication workflow (FR-ADM-006)", () => {
  it("lets editors submit but not publish", () => {
    const draft = { status: "DRAFT" as const, isLive: false, everPublished: false };
    expect(allowedActions(draft, editor)).toEqual(["submit"]);
    expect(allowedActions(draft, publisher)).toEqual(
      expect.arrayContaining(["submit", "publish", "archive", "delete"]),
    );
  });
  it("offers review actions only in review", () => {
    const review = { status: "IN_REVIEW" as const, isLive: false, everPublished: false };
    expect(allowedActions(review, editor)).toEqual(["withdraw"]);
    expect(allowedActions(review, publisher)).toEqual(
      expect.arrayContaining(["publish", "reject"]),
    );
  });
  it("never deletes content that has been public", () => {
    const live = { status: "PUBLISHED" as const, isLive: true, everPublished: true };
    expect(allowedActions(live, publisher)).not.toContain("delete");
    expect(allowedActions(live, publisher)).toContain("unpublish");
  });
  it("turns edits of live content into a draft revision", () => {
    expect(statusAfterEdit("PUBLISHED")).toBe("DRAFT");
    expect(statusAfterEdit("IN_REVIEW")).toBe("IN_REVIEW");
  });
  it("maps public paths", () => {
    expect(publicPath("page", "home")).toBe("/");
    expect(publicPath("service", "erp-solutions")).toBe("/services/erp-solutions");
  });
});

describe("lead status transitions (FR-LEAD-003)", () => {
  it("allows the documented path and blocks skips", () => {
    expect(canTransition("NEW", "QUALIFIED")).toBe(true);
    expect(canTransition("QUALIFIED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "WON")).toBe(true);
    expect(canTransition("NEW", "WON")).toBe(false);
    expect(canTransition("WON", "NEW")).toBe(false);
  });
  it("can reopen closed records", () => {
    expect(STATUS_TRANSITIONS.CLOSED).toContain("IN_REVIEW");
  });
});

describe("enquiry validation (FR-ENQ-001..004, BR-03)", () => {
  const schema = buildEnquirySchema({
    phone: "optional",
    country: "off",
    timeline: "required",
    budget: "optional",
    serviceSlugs: ["erp-solutions", "ai-automation"],
  });
  const valid = {
    name: "  Jane   Doe ",
    email: "jane@example.com",
    organisation: "Example",
    phone: "",
    services: ["erp-solutions", "ai-automation", "erp-solutions"],
    projectSummary: "We need a new ERP integration for our warehouse.",
    timeline: "asap",
    budgetRange: "",
    contactPreference: "email",
    privacyAcknowledged: true,
  };
  it("normalises valid input", () => {
    const r = schema.parse(valid);
    expect(r.name).toBe("Jane Doe");
    expect(r.services).toEqual(["erp-solutions", "ai-automation"]);
    expect(r.phone).toBeNull();
    expect(r.country).toBeNull();
    expect(r.budgetRange).toBeNull();
  });
  it("reports each problem against its field", () => {
    const r = schema.safeParse({
      ...valid,
      email: "nope",
      services: [],
      projectSummary: "short",
      timeline: "",
      privacyAcknowledged: false,
    });
    expect(r.success).toBe(false);
    const fields = new Set(r.error!.issues.map((i) => i.path[0]));
    expect(fields).toEqual(
      new Set(["email", "services", "projectSummary", "timeline", "privacyAcknowledged"]),
    );
  });
  it("rejects unknown services, oversized text and bad phone numbers", () => {
    expect(schema.safeParse({ ...valid, services: ["hacking"] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, projectSummary: "x".repeat(5001) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, name: "x".repeat(121) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, phone: "call me <script>" }).success).toBe(false);
  });
  it("reads multiple services from form data", () => {
    const fd = new FormData();
    fd.append("services", "erp-solutions");
    fd.append("services", "ai-automation");
    fd.append("privacyAcknowledged", "on");
    expect(enquiryRawFromFormData(fd)).toMatchObject({
      services: ["erp-solutions", "ai-automation"],
      privacyAcknowledged: true,
    });
  });
});

describe("signed form token (FR-ENQ-005/006)", () => {
  it("verifies, enforces a minimum fill time and expiry", () => {
    const t0 = 1_700_000_000_000;
    const token = issueFormToken(t0);
    expect(verifyFormToken(token, t0 + 100)).toEqual({ ok: false, reason: "too_fast" });
    const ok = verifyFormToken(token, t0 + MIN_FILL_MS + 1);
    expect(ok.ok).toBe(true);
    expect(verifyFormToken(token, t0 + 25 * 3600_000)).toEqual({ ok: false, reason: "expired" });
  });
  it("rejects tampering", () => {
    const token = issueFormToken(0);
    const [p] = token.split(".");
    expect(verifyFormToken(`${p}.deadbeef`).ok).toBe(false);
    expect(verifyFormToken(42).ok).toBe(false);
  });
});

describe("evidence rules (FR-PORT-004, BR-07)", () => {
  const base = projectContentSchema.parse({});
  it("flags content that needs approval", () => {
    expect(projectHasEvidence(base)).toBe(false);
    expect(projectHasEvidence({ ...base, clientName: "Acme" })).toBe(true);
    expect(
      projectHasEvidence({
        ...base,
        outcomes: [{ label: "Close time", value: "-2 days", description: "" }],
      }),
    ).toBe(true);
  });
  it("never publishes a client name without granted permission", () => {
    const project = {
      id: "00000000-0000-4000-8000-000000000001",
      slug: "p",
      title: "T",
      summary: "S",
      featured: false,
      sortDate: new Date("2026-01-01"),
      clientPermission: "PENDING",
      thumbnailId: null,
      seoTitle: null,
      seoDescription: null,
      content: { ...base, clientName: "Acme Ltd", anonymisedLabel: "Regional distributor" },
    } as unknown as Project;
    expect(buildProjectSnapshot(project, new Map<string, MediaAsset>()).displayClient).toBe(
      "Regional distributor",
    );
    expect(JSON.stringify(buildProjectSnapshot(project, new Map()))).not.toContain("Acme");
    expect(
      buildProjectSnapshot({ ...project, clientPermission: "GRANTED" }, new Map()).displayClient,
    ).toBe("Acme Ltd");
  });
  it("labels service outcomes illustrative by default", () => {
    const s = serviceContentSchema.parse({
      headline: "H",
      summary: "S",
      outcomes: [{ text: "Faster close" }],
    });
    expect(s.outcomes[0]!.evidence).toBe("illustrative");
  });
});

describe("operational helpers", () => {
  it("uses bounded exponential backoff", () => {
    const delays = Array.from({ length: MAX_ATTEMPTS + 2 }, (_, i) => backoffSeconds(i + 1));
    expect(delays[0]).toBe(60);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    expect(Math.max(...delays)).toBeLessThanOrEqual(6 * 3600);
  });
  it("detects images by content, not name", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("image/png");
    expect(detectImageType(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
  });
});
