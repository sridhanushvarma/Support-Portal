import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { decrypt, encrypt, humanReference, safeEqual } from "@/lib/crypto";
import { normalizePath } from "@/lib/redirects";
import { isValidSlug, slugify } from "@/lib/slug";
import { __test as loggerTest } from "@/lib/logger";
import { sanitizeProps, analyticsAllowed } from "@/lib/analytics/client";

describe("CSV export safety (FR-LEAD-007)", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-2")).toBe("'-2");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(toCsv(["A", "B"], [[1, null]])).toBe("A,B\r\n1,\r\n");
  });
});

describe("crypto helpers", () => {
  it("round-trips AES-GCM and detects tampering", () => {
    const enc = encrypt("JBSWY3DPEHPK3PXP");
    expect(decrypt(enc)).toBe("JBSWY3DPEHPK3PXP");
    const [iv, tag, ct] = enc.split(".");
    const tampered = [iv, tag, Buffer.from("xx").toString("base64url") + ct!.slice(3)].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
  it("creates non-sequential references without ambiguous characters", () => {
    const refs = new Set(Array.from({ length: 200 }, () => humanReference()));
    expect(refs.size).toBe(200);
    for (const r of refs) expect(r).toMatch(/^ENQ-[A-HJ-KMNP-TV-Z2-9]{8}$/);
  });
  it("compares in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("slugs and redirect paths (BR-02, UC-10)", () => {
  it("slugifies titles", () => {
    expect(slugify("  Data Analytics & BI!  ")).toBe("data-analytics-and-bi");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(isValidSlug("erp-solutions")).toBe(true);
    expect(isValidSlug("Bad Slug")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
  });
  it("accepts only safe site-relative paths", () => {
    expect(normalizePath("/old-page/")).toBe("/old-page");
    expect(normalizePath("/")).toBe("/");
    for (const bad of [
      "https://evil.test",
      "//evil.test",
      "/a b",
      "/x?y=1",
      "/admin",
      "/api/v1/x",
      "relative",
      "/\\evil",
    ]) {
      expect(() => normalizePath(bad)).toThrow();
    }
  });
});

describe("log redaction (NFR-19)", () => {
  it("removes personal and secret fields", () => {
    const out = loggerTest.redact({
      email: "a@b.c",
      nested: { password: "x", projectSummary: "secret" },
      ok: 1,
    }) as Record<string, unknown>;
    expect(out.email).toBe("[redacted]");
    expect(out.nested).toEqual({ password: "[redacted]", projectSummary: "[redacted]" });
    expect(out.ok).toBe(1);
  });
});

describe("analytics privacy (BR-12, FR-AN-002)", () => {
  it("drops values that could carry personal data", () => {
    expect(
      sanitizeProps({ location: "home_hero", email: "x@y.z", fields: "name,email", Bad: "x" }),
    ).toEqual({ location: "home_hero", fields: "name,email" });
  });
  it("respects the consent mode", () => {
    expect(analyticsAllowed("opt-in", null)).toBe(false);
    expect(analyticsAllowed("opt-in", "granted")).toBe(true);
    expect(analyticsAllowed("notice-only", null)).toBe(true);
    expect(analyticsAllowed("notice-only", "denied")).toBe(false);
    expect(analyticsAllowed("disabled", "granted")).toBe(false);
  });
});
