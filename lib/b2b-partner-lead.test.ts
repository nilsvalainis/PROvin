import { describe, expect, it } from "vitest";
import { b2bPartnerLeadFieldError, normalizeB2bPartnerLeadInput, parseB2bPartnerLeadsDoc } from "@/lib/b2b-partner-lead";

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

  it("reads legacy leads without reg, VAT or decision", () => {
    const doc = parseB2bPartnerLeadsDoc({
      version: 1,
      leads: [
        {
          id: "lead_1_abc12",
          createdAt: "2026-10-18T10:00:00.000Z",
          contactName: "Jānis",
          companyName: "Demo Auto",
          email: "janis@demo-auto.lv",
        },
      ],
    });
    expect(doc.leads[0]?.companyReg).toBe("");
    expect(doc.leads[0]?.decision).toBe("pending");
    expect(doc.leads[0]?.vatNumber).toBe("");
  });
});
