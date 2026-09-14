import { describe, expect, it } from "vitest";
import {
  isUsablePartnerPassword,
  normalizePartnerEmail,
  parsePartnerRecord,
  partnerFieldError,
  toPublicPartner,
  type B2bPartnerRecord,
} from "@/lib/b2b-partner-account";

const validInput = {
  companyName: "SIA Demo Auto",
  companyReg: "40103123456",
  companyAddress: "Brīvības iela 1, Rīga",
  contactName: "Jānis Bērziņš",
  email: "Demo@PROvin.lv",
  phone: "+371 20000000",
};

describe("b2b partner account", () => {
  it("normalizes email and accepts a complete profile", () => {
    expect(normalizePartnerEmail("Demo@PROvin.lv")).toBe("demo@provin.lv");
    expect(partnerFieldError(validInput)).toBeNull();
  });

  it("rejects incomplete or invalid fields", () => {
    expect(partnerFieldError({ ...validInput, companyName: "A" })).toBe("companyName");
    expect(partnerFieldError({ ...validInput, email: "nav-epasts" })).toBe("email");
    expect(isUsablePartnerPassword("1234567")).toBe(false);
    expect(isUsablePartnerPassword("Salon8xx")).toBe(true);
  });

  it("strips the password hash from the public profile", () => {
    const record: B2bPartnerRecord = {
      id: "ptr_0123456789abcdef",
      ...validInput,
      email: "demo@provin.lv",
      passwordHash: "scrypt$salt$hash",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      emailVerifiedAt: "2026-09-04T00:00:00.000Z",
      emailVerifyHash: "abc",
      emailVerifyExpiresAt: null,
      emailVerifyPurpose: null,
      pendingEmail: null,
      dealerEnabled: false,
      prices: {
        business1: null,
        business10: null,
        dealer1: null,
        dealer10: null,
      },
    };
    const publicProfile = toPublicPartner(record);
    expect(publicProfile).not.toHaveProperty("passwordHash");
    expect(publicProfile).not.toHaveProperty("emailVerifyHash");
    expect(publicProfile.email).toBe("demo@provin.lv");
    expect(publicProfile.emailVerifiedAt).toBe("2026-09-04T00:00:00.000Z");
    expect(publicProfile.dealerEnabled).toBe(false);
  });

  it("defaults dealerEnabled to false and parses custom prices", () => {
    const parsed = parsePartnerRecord({
      id: "ptr_0123456789abcdef",
      ...validInput,
      email: "demo@provin.lv",
      passwordHash: "scrypt$salt$hash",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      dealerEnabled: true,
      prices: { business1: 5999, business10: 5499, dealer1: 1499, dealer10: 1299 },
    });
    expect(parsed?.dealerEnabled).toBe(true);
    expect(parsed?.prices.business1).toBe(5999);
    expect(parsed?.prices.dealer10).toBe(1299);
    const legacy = parsePartnerRecord({
      id: "ptr_0123456789abcdef",
      ...validInput,
      email: "demo@provin.lv",
      passwordHash: "scrypt$salt$hash",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    expect(legacy?.dealerEnabled).toBe(false);
    expect(legacy?.prices.business1).toBeNull();
  });

  it("treats legacy records without emailVerifiedAt as already verified", () => {
    const parsed = parsePartnerRecord({
      id: "ptr_0123456789abcdef",
      ...validInput,
      email: "demo@provin.lv",
      passwordHash: "scrypt$salt$hash",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    expect(parsed?.emailVerifiedAt).toBe("2026-09-04T00:00:00.000Z");
    const pending = parsePartnerRecord({
      id: "ptr_0123456789abcdef",
      ...validInput,
      email: "demo@provin.lv",
      passwordHash: "scrypt$salt$hash",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      emailVerifiedAt: null,
    });
    expect(pending?.emailVerifiedAt).toBeNull();
  });
});
