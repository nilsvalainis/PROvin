import { describe, expect, it } from "vitest";
import {
  isUsablePartnerPassword,
  normalizePartnerEmail,
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
    };
    expect(toPublicPartner(record)).not.toHaveProperty("passwordHash");
    expect(toPublicPartner(record).email).toBe("demo@provin.lv");
  });
});
