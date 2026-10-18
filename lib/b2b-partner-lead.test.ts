import { describe, expect, it } from "vitest";
import { b2bPartnerLeadFieldError, normalizeB2bPartnerLeadInput } from "@/lib/b2b-partner-lead";

const valid = {
  contactName: " Jānis  Bērziņš ",
  companyName: "Auto SIA",
  phone: "+371 29 502 039",
  email: "Info@Auto.lv",
  message: "Ap 20 auto mēnesī",
  consent: true,
};

describe("b2b partner lead", () => {
  it("normalizes and accepts a complete request", () => {
    const input = normalizeB2bPartnerLeadInput(valid);
    expect(input.contactName).toBe("Jānis Bērziņš");
    expect(input.email).toBe("info@auto.lv");
    expect(b2bPartnerLeadFieldError(input)).toBeNull();
  });

  it("returns the first invalid required field", () => {
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, contactName: "" }))).toBe("contactName");
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, companyName: "" }))).toBe("companyName");
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, phone: "123" }))).toBe("phone");
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, email: "nav@" }))).toBe("email");
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, consent: "yes" }))).toBe("consent");
  });

  it("message is optional", () => {
    expect(b2bPartnerLeadFieldError(normalizeB2bPartnerLeadInput({ ...valid, message: "" }))).toBeNull();
  });
});
