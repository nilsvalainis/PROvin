import { describe, expect, it } from "vitest";
import { parsePartnerRecord } from "@/lib/b2b-partner-account";
import { B2B_PARTNER_TERMS_VERSION, isB2bPartnerTermsAccepted } from "@/lib/b2b-partner-terms";

describe("B2B partneru noteikumu akcepts", () => {
  it("pieņem tikai boolean true", () => {
    expect(isB2bPartnerTermsAccepted(true)).toBe(true);
    for (const v of [false, "true", "on", 1, null, undefined]) expect(isB2bPartnerTermsAccepted(v)).toBe(false);
  });

  it("versija ir datums", () => {
    expect(B2B_PARTNER_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  const base = {
    id: "ptr_0123456789abcdef",
    status: "active",
    email: "dealer@example.com",
    passwordHash: "scrypt$aa$bb",
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  it("veciem ierakstiem akcepta nav", () => {
    const rec = parsePartnerRecord(base);
    expect(rec?.termsVersion).toBeNull();
    expect(rec?.termsAcceptedAt).toBeNull();
  });

  it("saglabā versiju un laiku", () => {
    const rec = parsePartnerRecord({ ...base, termsVersion: "2026-10-28", termsAcceptedAt: "2026-10-28T01:00:00.000Z" });
    expect(rec?.termsVersion).toBe("2026-10-28");
    expect(rec?.termsAcceptedAt).toBe("2026-10-28T01:00:00.000Z");
  });
});
