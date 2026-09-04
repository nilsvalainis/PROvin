import { describe, expect, it } from "vitest";
import { hashB2bPartnerPassword, verifyB2bPartnerPassword } from "@/lib/b2b-partner-password";

describe("b2b partner password", () => {
  it("verifies the same password and rejects another", () => {
    const stored = hashB2bPartnerPassword("Salon8xx");
    expect(verifyB2bPartnerPassword("Salon8xx", stored)).toBe(true);
    expect(verifyB2bPartnerPassword("wrong-pass", stored)).toBe(false);
    expect(verifyB2bPartnerPassword("Salon8xx", "plain")).toBe(false);
  });
});
