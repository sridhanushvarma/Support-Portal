import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitEnquiry } from "@/lib/enquiries/submit";
import {
  addEnquiryActivity,
  anonymiseEnquiry,
  deleteEnquiry,
  exportEnquiries,
  listEnquiries,
  parseEnquiryFilters,
  runEnquiryRetention,
  updateEnquiry,
} from "@/lib/enquiries/admin";
import {
  updateUserRoles,
  setUserActive,
  inviteUser,
  completeSetup,
  issueSetupToken,
} from "@/lib/users";
import { authenticatePassword, verifyUserTotp } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { encrypt } from "@/lib/crypto";
import { currentStep, generateTotpSecret, totpAt } from "@/lib/auth/totp";
import { sessionFromToken } from "@/lib/auth/session";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { makeUser, publishedService, resetData, validEnquiry } from "./helpers";

let seq = 0;
async function newEnquiry(overrides: Record<string, unknown> = {}) {
  return submitEnquiry(validEnquiry(overrides), {
    ip: `192.0.2.${++seq % 250}`,
    requestId: "t",
    submissionKey: `adm-${Date.now()}-${seq}`,
  });
}

beforeEach(async () => {
  await resetData();
  const publisher = await makeUser(["PUBLISHER"]);
  await publishedService(publisher, "erp-solutions", "Enterprise ERP Solutions");
});

describe("lead administration (UC-04)", () => {
  it("enforces permissions server-side (UAT-06)", async () => {
    const editor = await makeUser(["EDITOR"]);
    const sales = await makeUser(["SALES"]);
    const e = await newEnquiry();
    await expect(listEnquiries({ user: editor }, parseEnquiryFilters({}))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      exportEnquiries({ user: sales }, parseEnquiryFilters({}), ["reference"]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(anonymiseEnquiry({ user: sales }, e.id, "x")).rejects.toMatchObject({
      status: 403,
    });
    expect((await listEnquiries({ user: sales }, parseEnquiryFilters({}))).total).toBe(1);
  });

  it("validates transitions, records history and rejects stale updates", async () => {
    const sales = await makeUser(["SALES"]);
    const other = await makeUser(["SALES"]);
    const e = await newEnquiry();
    await expect(
      updateEnquiry({ user: sales }, e.id, { status: "WON", version: 1 }),
    ).rejects.toMatchObject({ status: 422 });
    const updated = await updateEnquiry({ user: sales }, e.id, {
      status: "QUALIFIED",
      assignedToId: other.id,
      version: 1,
    });
    expect(updated.version).toBe(2);
    expect(updated.firstResponseAt).not.toBeNull();
    // Another user still holding version 1 must reload first.
    await expect(
      updateEnquiry({ user: other }, e.id, { status: "NOT_QUALIFIED", version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    const editor = await makeUser(["EDITOR"]);
    await expect(
      updateEnquiry({ user: sales }, e.id, { assignedToId: editor.id, version: 2 }),
    ).rejects.toMatchObject({ status: 422 });
    await addEnquiryActivity({ user: sales }, e.id, { type: "note", body: "Called the client" });
    const acts = await prisma.enquiryActivity.findMany({
      where: { enquiryId: e.id },
      orderBy: { createdAt: "asc" },
    });
    expect(acts.map((a) => a.type)).toEqual(["system", "status_change", "assignment", "note"]);
    expect(acts.every((a) => a.type === "system" || a.actorId === sales.id)).toBe(true);
  });

  it("filters by status, owner, keyword and date", async () => {
    const sales = await makeUser(["SALES"]);
    const a = await newEnquiry({ organisation: "Alpha Logistics" });
    await newEnquiry({ organisation: "Beta Foods" });
    await updateEnquiry({ user: sales }, a.id, {
      status: "IN_REVIEW",
      assignedToId: sales.id,
      version: 1,
    });
    const q = (p: Record<string, string>) =>
      listEnquiries({ user: sales }, parseEnquiryFilters(p)).then((r) =>
        r.rows.map((x) => x.organisation),
      );
    expect(await q({ q: "alpha" })).toEqual(["Alpha Logistics"]);
    expect(await q({ status: "NEW" })).toEqual(["Beta Foods"]);
    expect(await q({ owner: "me" })).toEqual(["Alpha Logistics"]);
    expect(await q({ owner: "unassigned" })).toEqual(["Beta Foods"]);
    expect(await q({ q: "100%_" })).toEqual([]);
    expect(await q({ from: "2999-01-01" })).toEqual([]);
    expect((await q({ status: "BOGUS" })).length).toBe(2);
  });

  it("exports only chosen columns, escapes formulas and audits the export (BR-09)", async () => {
    const manager = await makeUser(["SALES_MANAGER"]);
    await newEnquiry({ organisation: "=cmd|' /C calc'!A0" });
    const { csv, rows } = await exportEnquiries({ user: manager }, parseEnquiryFilters({}), [
      "reference",
      "organisation",
    ]);
    expect(rows).toBe(1);
    expect(csv.split("\r\n")[0]).toBe("Reference,Organisation");
    expect(csv).toContain("'=cmd");
    expect(csv).not.toContain("jane");
    expect(
      await prisma.auditEvent.count({ where: { action: "enquiry.exported", actorId: manager.id } }),
    ).toBe(1);
  });

  it("anonymises and deletes personal data with an audit trail (FR-LEAD-008)", async () => {
    const manager = await makeUser(["SALES_MANAGER"]);
    const e = await newEnquiry();
    await addEnquiryActivity({ user: manager }, e.id, {
      type: "note",
      body: "Jane's mobile is 0123",
    });
    await expect(anonymiseEnquiry({ user: manager }, e.id, "")).rejects.toMatchObject({
      status: 422,
    });
    await anonymiseEnquiry({ user: manager }, e.id, "Erasure request");
    const row = await prisma.enquiry.findUniqueOrThrow({
      where: { id: e.id },
      include: { activities: true, notifications: true, serviceInterests: true },
    });
    expect(JSON.stringify(row)).not.toMatch(/Jane|Example Org|warehouse|0123/i);
    expect(row.serviceInterests).toHaveLength(1); // aggregate reporting retained
    await deleteEnquiry({ user: manager }, e.id, "Duplicate");
    expect(await prisma.enquiry.count()).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { entityId: e.id, action: { in: ["enquiry.anonymised", "enquiry.deleted"] } },
      }),
    ).toBe(2);
  });

  it("applies the retention policy only to inactive closed enquiries (NFR-14)", async () => {
    const sales = await makeUser(["SALES"]);
    const open = await newEnquiry();
    const closed = await newEnquiry();
    await updateEnquiry({ user: sales }, closed.id, { status: "CLOSED", version: 1 });
    await prisma.$executeRaw`UPDATE "Enquiry" SET "updatedAt" = now() - interval '800 days'`;
    expect(await runEnquiryRetention(730)).toBe(1);
    expect(
      (await prisma.enquiry.findUniqueOrThrow({ where: { id: closed.id } })).anonymisedAt,
    ).not.toBeNull();
    expect(
      (await prisma.enquiry.findUniqueOrThrow({ where: { id: open.id } })).anonymisedAt,
    ).toBeNull();
  });
});

describe("user administration (UC-07)", () => {
  it("protects the last administrator and self-escalation", async () => {
    const admin = await makeUser(["ADMIN"]);
    await expect(
      updateUserRoles({ user: admin }, admin.id, ["ADMIN", "PUBLISHER"], "Me"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(setUserActive({ user: admin }, admin.id, false)).rejects.toMatchObject({
      status: 403,
    });
    const second = await makeUser(["ADMIN"]);
    await setUserActive({ user: second }, admin.id, false);
    // `second` is now the only active administrator and cannot be demoted by anyone.
    await expect(
      updateUserRoles({ user: admin }, second.id, ["EDITOR"], "x"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateUserRoles({ user: second }, second.id, ["EDITOR"], "x"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("prevents removing the final active administrator", async () => {
    const a = await makeUser(["ADMIN"]);
    const b = await makeUser(["ADMIN"]);
    await updateUserRoles({ user: a }, b.id, ["EDITOR"], "B");
    await expect(updateUserRoles({ user: b }, a.id, ["EDITOR"], "A")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("invites users with single-use setup links", async () => {
    const admin = await makeUser(["ADMIN"]);
    const editor = await makeUser(["EDITOR"]);
    await expect(
      inviteUser(
        { user: editor },
        { email: "x@example.test", displayName: "X", roles: ["EDITOR"] },
      ),
    ).rejects.toMatchObject({ status: 403 });
    const { url } = await inviteUser(
      { user: admin },
      { email: "new@example.test", displayName: "New", roles: ["EDITOR"] },
    );
    const token = new URL(url).searchParams.get("token")!;
    await expect(completeSetup(token, "short", "t")).rejects.toMatchObject({ status: 422 });
    await completeSetup(token, "violet tram oven lantern", "t");
    await expect(completeSetup(token, "violet tram oven lantern", "t")).rejects.toMatchObject({
      status: 422,
    });
    const res = await authenticatePassword("NEW@example.test", "violet tram oven lantern", {
      ip: "1.1.1.1",
      requestId: "t",
    });
    expect(res).toMatchObject({ ok: true, mfaEnrolled: false });
  });
});

describe("authentication (FR-ADM-001, FR-ADM-009, NFR-10)", () => {
  async function userWithPassword(email: string) {
    return prisma.adminUser.create({
      data: {
        email,
        displayName: "U",
        passwordHash: await hashPassword("violet tram oven lantern"),
        roles: { create: [{ role: "EDITOR" }] },
      },
    });
  }

  it("locks the account after repeated failures without revealing existence", async () => {
    await userWithPassword("lock@example.test");
    const unknown = await authenticatePassword("nobody@example.test", "x".repeat(12), {
      ip: "2.2.2.2",
      requestId: "t",
    });
    const wrong = await authenticatePassword("lock@example.test", "wrong password!", {
      ip: "2.2.2.2",
      requestId: "t",
    });
    expect(unknown).toEqual(wrong);
    for (let i = 0; i < 7; i++)
      await authenticatePassword("lock@example.test", "wrong password!", {
        ip: `3.3.3.${i}`,
        requestId: "t",
      });
    // Per-account rate limit now applies even with the correct password.
    expect(
      await authenticatePassword("lock@example.test", "violet tram oven lantern", {
        ip: "4.4.4.4",
        requestId: "t",
      }),
    ).toMatchObject({ ok: false });
  }, 30000);

  it("rejects replayed TOTP codes", async () => {
    const u = await userWithPassword("mfa@example.test");
    const secret = generateTotpSecret();
    await prisma.adminUser.update({
      where: { id: u.id },
      data: { mfaSecretEnc: encrypt(secret), mfaEnabledAt: new Date() },
    });
    const code = totpAt(secret, currentStep());
    expect(await verifyUserTotp(u.id, code, { requestId: "t" })).toBe("ok");
    expect(await verifyUserTotp(u.id, code, { requestId: "t" })).toBe("invalid");
  });

  it("expires idle sessions and invalidates sessions after a password change", async () => {
    const u = await userWithPassword("sess@example.test");
    const token = randomToken();
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(token),
        userId: u.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    expect((await sessionFromToken(token))?.user.email).toBe("sess@example.test");
    await prisma.adminUser.update({
      where: { id: u.id },
      data: { passwordChangedAt: new Date(Date.now() + 1000) },
    });
    expect(await sessionFromToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);

    const idle = randomToken();
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(idle),
        userId: u.id,
        expiresAt: new Date(Date.now() + 3600_000),
        lastSeenAt: new Date(Date.now() - 31 * 60_000),
        createdAt: new Date(Date.now() + 2000),
      },
    });
    expect(await sessionFromToken(idle)).toBeNull();
    expect(await sessionFromToken("not-a-real-token")).toBeNull();
  });

  it("revokes access when an account is deactivated", async () => {
    const admin = await makeUser(["ADMIN"]);
    const u = await userWithPassword("gone@example.test");
    const token = randomToken();
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(token),
        userId: u.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await setUserActive({ user: admin }, u.id, false);
    expect(await sessionFromToken(token)).toBeNull();
    expect(
      await authenticatePassword("gone@example.test", "violet tram oven lantern", {
        ip: "5.5.5.5",
        requestId: "t",
      }),
    ).toMatchObject({ ok: false });
    // Setup links for inactive users are refused.
    const url = await issueSetupToken(u.id, "reset");
    await expect(
      completeSetup(new URL(url).searchParams.get("token")!, "violet tram oven lantern 2", "t"),
    ).rejects.toMatchObject({ status: 422 });
  });
});
