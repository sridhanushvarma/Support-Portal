import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, currentStep, totpAt, verifyTotp } from "@/lib/auth/totp";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { hasPermission, permissionsFor, ROLE_PERMISSIONS } from "@/lib/auth/permissions";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 Appendix B test secret "12345678901234567890" (SHA-1), truncated to 6 digits.
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC test vectors", () => {
    expect(totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(secret, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(secret, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("round-trips base32", () => {
    const buf = Buffer.from("hello world, mfa!");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
  it("accepts ±1 step and rejects replays", () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyTotp(secret, totpAt(secret, step), null, now)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step - 2), null, now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, step), step, now)).toBeNull(); // replay
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
  });
});

describe("password hashing", () => {
  it("hashes with a salt and verifies", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(await verifyPassword("wrong horse battery staple", a)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  }, 20000);
  it("applies a length-based policy", () => {
    expect(passwordPolicyError("short")).toMatch(/12/);
    expect(passwordPolicyError("aaaaaaaaaaaaaa")).toBeTruthy();
    expect(passwordPolicyError("mypassword123456")).toBeTruthy();
    expect(passwordPolicyError("jane.doe-and-more-words", "jane.doe@example.com")).toBeTruthy();
    expect(passwordPolicyError("violet tram oven lantern")).toBeNull();
  });
});

describe("role permissions (FR-ADM-002, least privilege)", () => {
  it("separates content, lead and admin privileges", () => {
    expect(hasPermission(["EDITOR"], "content.edit")).toBe(true);
    expect(hasPermission(["EDITOR"], "content.publish")).toBe(false);
    expect(hasPermission(["EDITOR"], "enquiries.read")).toBe(false);
    expect(hasPermission(["SALES"], "enquiries.export")).toBe(false);
    expect(hasPermission(["SALES_MANAGER"], "enquiries.export")).toBe(true);
    expect(hasPermission(["MARKETING"], "enquiries.read")).toBe(false);
    expect(hasPermission(["ADMIN"], "enquiries.read")).toBe(false);
    expect(hasPermission(["ADMIN"], "users.manage")).toBe(true);
  });
  it("combines roles", () => {
    const p = permissionsFor(["EDITOR", "SALES"]);
    expect(p.has("content.edit") && p.has("enquiries.update")).toBe(true);
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(6);
  });
});
