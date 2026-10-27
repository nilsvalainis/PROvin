import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isBulkVinFormatValid } from "@/lib/b2b-partner-bulk-vin";
import {
  getVinOrPlateErrorKind,
  isValidVin,
  validateOrderFields,
  vinOrPlateErrorMessage,
} from "@/lib/order-field-validation";
import { getTestPricingPlan, validateTestPricingStep2 } from "@/lib/test-pricing-plans";
import { validateTp5InlineFields } from "@/lib/test-pricing-5-inline-checkout";
import { hasIso3779CheckDigit, vinNeedsCheckDigitWarning } from "@/lib/vin-iso3779";

// Eiropas VIN bieži nav ISO 3779 kontrolcipara (9. zīme). Tas nedrīkst bloķēt pirkumu.
const EU_VIN = "WVWZZZ3CZME138258";
/** Toyota NZ (WMI 7A8) vējstikla VIN - ISO 3779 9. zīme nesakrīt. */
const NZ_VIN = "7A81G1E0794001421";

function expectCheckoutAcceptsVin(vin: string) {
  expect(isValidVin(vin)).toBe(true);
  expect(isBulkVinFormatValid(vin)).toBe(true);
  expect(getVinOrPlateErrorKind(vin)).toBeNull();
  expect(vinOrPlateErrorMessage(vin, { vin: "vin", vinLength: "vinLength" })).toBeNull();
  expect(
    validateOrderFields({
      vin,
      listingUrl: "",
      email: "test@example.com",
      phone: "+371 21234567",
    }),
  ).toBeNull();
  expect(validateTp5InlineFields("", vin).ok).toBe(true);
  const premium = getTestPricingPlan("premium");
  expect(premium).toBeTruthy();
  expect(validateTestPricingStep2(premium!, "", vin, true).ok).toBe(true);
}

const FORM_FILES = [
  "components/OrderForm.tsx",
  "components/admin/AdminOrderDetailView.tsx",
  "components/b2b/B2bPartnerHome.tsx",
  "components/b2b/B2bPartnerPricingCard.tsx",
  "components/b2b/B2bPartnerWalletHome.tsx",
  "components/client-link/ClientLinkForm.tsx",
  "components/home/HomeRiskAuditGuide.tsx",
] as const;

describe("ISO 3779 kontrolcipars nekad nebloķē pirkumu", () => {
  it("EU VIN ar nesakrītošu kontrolciparu ir derīgs visās pirkuma pārbaudēs", () => {
    expect(hasIso3779CheckDigit(EU_VIN)).toBe(false);
    expect(vinNeedsCheckDigitWarning(EU_VIN)).toBe(true);
    expectCheckoutAcceptsVin(EU_VIN);
  });

  it("NZ WMI VIN 7A81G1E0794001421 iet cauri visām checkout validācijām", () => {
    expect(NZ_VIN).toHaveLength(17);
    expect(hasIso3779CheckDigit(NZ_VIN)).toBe(false);
    expect(vinNeedsCheckDigitWarning(NZ_VIN)).toBe(true);
    expectCheckoutAcceptsVin(NZ_VIN);
  });

  it("pamata validācija paliek: 17 zīmes, bez I/O/Q", () => {
    expect(isValidVin("WVWZZZ3CZME13825")).toBe(false);
    expect(isValidVin("WVWZZZ3CZME13825I")).toBe(false);
    expect(isValidVin("WVWZZZ3CZME13825O")).toBe(false);
    expect(isValidVin("WVWZZZ3CZME13825Q")).toBe(false);
    expect(isBulkVinFormatValid("WVWZZZ3CZME1382")).toBe(false);
  });

  it("formas nerāda ISO 3779 kontrolcipara hint", () => {
    for (const rel of FORM_FILES) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("vinNeedsCheckDigitWarning");
      expect(src, rel).not.toContain("vinCheckDigitWarning");
      expect(src, rel).not.toContain("order-hero-vin-checkdigit");
      expect(src, rel).not.toContain("data-vin-hint");
    }
  });
});
