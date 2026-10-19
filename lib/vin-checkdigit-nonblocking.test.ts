import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isBulkVinFormatValid } from "@/lib/b2b-partner-bulk-vin";
import { getVinOrPlateErrorKind, isValidVin } from "@/lib/order-field-validation";
import { hasIso3779CheckDigit, vinNeedsCheckDigitWarning } from "@/lib/vin-iso3779";

// Eiropas VIN bieži nav ISO 3779 kontrolcipara (9. zīme). Tas nedrīkst bloķēt pirkumu.
const EU_VIN = "WVWZZZ3CZME138258";

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
    expect(isValidVin(EU_VIN)).toBe(true);
    expect(isBulkVinFormatValid(EU_VIN)).toBe(true);
    expect(getVinOrPlateErrorKind(EU_VIN)).toBeNull();
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
