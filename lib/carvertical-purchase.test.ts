import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CARVERTICAL_REPORTS_URL } from "@/lib/admin-vin-urls";
import {
  CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES,
  CARVERTICAL_CHECKOUT_HUMAN_STOP_LV,
  CARVERTICAL_DISMISS_CLICK_RE,
  CARVERTICAL_PURPOSE_DEALER_RE,
  CARVERTICAL_PURPOSE_PREFERRED_RE,
  CARVERTICAL_PURPOSE_SURVEY_RE,
  CARVERTICAL_PURCHASED_SUMMARY_LV,
  CARVERTICAL_EXPLICIT_SAVED_PAY_RE,
  CARVERTICAL_SAVED_PAY_CLICK_RE,
  CARVERTICAL_3DS_PAGE_RE,
  buildCarVerticalPurchasedScanResult,
  carVerticalAutofillMayClick,
  classifyCarVerticalCheckoutStep,
  isCarVerticalPurchasedScanSource,
  pickCarVerticalPurposeLabel,
  purchaseCarVerticalReport,
} from "@/lib/carvertical-purchase";
import { VIN_SCAN_BROWSER_AUTO_CLICK_IDS, vinScanBrowserMayAutoClick } from "@/lib/vin-scan/browser-click-policy";

const VIN = "WVWZZZ1JZXW000001";
const ROOT = process.cwd();

describe("purchaseCarVerticalReport", () => {
  it("refuses a call without explicit operator confirm", () => {
    const sneaky = { vin: VIN, explicitOperatorConfirm: false as unknown as true };
    expect(purchaseCarVerticalReport(sneaky)).toEqual({ ok: false, code: "missing_confirm" });
  });

  it("refuses an invalid VIN even after confirm", () => {
    expect(purchaseCarVerticalReport({ vin: "ABC", explicitOperatorConfirm: true })).toEqual({
      ok: false,
      code: "invalid_vin",
    });
  });

  it("after confirm only returns the reports URL and does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(purchaseCarVerticalReport({ vin: VIN, explicitOperatorConfirm: true })).toEqual({
      ok: true,
      mode: "manual_browser",
      href: CARVERTICAL_REPORTS_URL,
      vin: VIN,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("builds a purchased scan payload only as an attachable result", () => {
    const built = buildCarVerticalPurchasedScanResult({
      vin: VIN.toLowerCase(),
      openUrl: "https://www.carvertical.com/lv/report/x",
      detail: "odometer",
    });
    expect(built).toMatchObject({
      id: "carvertical_preview",
      vin: VIN,
      status: "found",
      summary: CARVERTICAL_PURCHASED_SUMMARY_LV,
      purchased: true,
      openUrl: "https://www.carvertical.com/lv/report/x",
    });
    expect(isCarVerticalPurchasedScanSource(built)).toBe(true);
    expect(
      isCarVerticalPurchasedScanSource({
        id: "carvertical_preview",
        summary: "CarVertical rāda priekšskatījumu. Pirkums paliek operatoram",
      }),
    ).toBe(false);
  });
});

describe("automatic flows do not call purchaseCarVerticalReport", () => {
  it("seed, webhook, cron and VIN-scan sources never import the purchase function", () => {
    for (const rel of CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES) {
      const src = readFileSync(path.join(ROOT, rel), "utf8");
      expect(src, rel).not.toMatch(/purchaseCarVerticalReport/);
      expect(src, rel).not.toMatch(/carvertical-purchase/);
      expect(src, rel).not.toMatch(/api\.carvertical/i);
    }
  });

  it("free-source seed and VIN-scan runner never mention a CarVertical order", () => {
    const free = readFileSync(path.join(ROOT, "lib/admin-free-source-seed.ts"), "utf8");
    const scan = readFileSync(path.join(ROOT, "lib/vin-scan/run.ts"), "utf8");
    const stripe = readFileSync(path.join(ROOT, "app/api/webhooks/stripe/route.ts"), "utf8");
    expect(free).not.toMatch(/carvertical/i);
    expect(scan).not.toMatch(/carvertical/i);
    expect(stripe).not.toMatch(/carvertical/i);
    expect(stripe).not.toMatch(/purchaseCarVerticalReport/);
  });
});

describe("CarVertical click policy", () => {
  it("never auto-clicks without operator confirm, including Sākt pārbaudi", () => {
    expect(carVerticalAutofillMayClick("Sākt pārbaudi", false)).toBe(false);
    expect(carVerticalAutofillMayClick("Pārbaudīt", false)).toBe(false);
    expect(carVerticalAutofillMayClick("Continue", false)).toBe(false);
    expect(carVerticalAutofillMayClick("Buy report", false)).toBe(false);
  });

  it("after confirm may start the report and continue saved checkout, but never a new card", () => {
    expect(carVerticalAutofillMayClick("Sākt pārbaudi", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pārbaudīt VIN", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pirkt atskaiti", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Buy report", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Checkout", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Maksāt", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Continue to payment", true)).toBe(true);
    expect(carVerticalAutofillMayClick("I'm buying a used car", true)).toBe(true);
    expect(carVerticalAutofillMayClick("I'm a professional (dealer, workshop, etc.)", true)).toBe(true);
    expect(carVerticalAutofillMayClick("No thanks", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pay with credits", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pay", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pievienot karti", true)).toBe(false);
    expect(carVerticalAutofillMayClick("Add a new card", true)).toBe(false);
    expect(carVerticalAutofillMayClick("Subscribe", true)).toBe(false);
  });

  it("picks buying a car over dealer, and dealer over other", () => {
    expect(
      pickCarVerticalPurposeLabel([
        "Other",
        "I'm a professional (dealer, workshop, etc.)",
        "I'm buying a used car",
        "I'm selling a car",
      ]),
    ).toBe("I'm buying a used car");
    expect(pickCarVerticalPurposeLabel(["Other", "I'm a professional (dealer)"] )).toBe(
      "I'm a professional (dealer)",
    );
    expect(pickCarVerticalPurposeLabel(["Other", "I'm selling a car"])).toBe("");
  });

  it("after confirm classifies purpose, dismiss, saved pay and stops on 3-D Secure", () => {
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: false,
        pageText: "For what purpose are you buying the report?",
        labels: ["I'm buying a used car"],
      }).kind,
    ).toBe("idle");
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "For what purpose are you buying the report?",
        labels: ["I'm selling a car", "I'm buying a used car", "Continue"],
      }),
    ).toMatchObject({ kind: "purpose", label: "I'm buying a used car" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Unlock extra vehicles",
        labels: ["No thanks", "Pay now"],
      }),
    ).toMatchObject({ kind: "dismiss", label: "No thanks" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Pay with your balance",
        labels: ["Pay with credits"],
      }),
    ).toMatchObject({ kind: "pay_saved", label: "Pay with credits" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Complete 3-D Secure to finish payment",
        labels: ["Continue"],
        has3dsFrame: true,
      }),
    ).toMatchObject({ kind: "stop_3ds", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Enter card number",
        labels: ["Pay"],
        hasNewCardField: true,
      }).kind,
    ).toBe("stop_3ds");
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Pay with saved card",
        labels: ["Pay"],
      }),
    ).toMatchObject({ kind: "pay_saved", label: "Pay" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Enter card number",
        labels: ["Pay with credits"],
        hasNewCardField: true,
      }),
    ).toMatchObject({ kind: "pay_saved", label: "Pay with credits" });
  });

  it("VIN scan browser auto-click list excludes CarVertical", () => {
    expect(VIN_SCAN_BROWSER_AUTO_CLICK_IDS).not.toContain("carvertical_preview");
    expect(vinScanBrowserMayAutoClick("carvertical_preview")).toBe(false);
    expect(vinScanBrowserMayAutoClick("autodna_preview")).toBe(false);
  });
});

describe("userscript stays aligned with no auto-buy", () => {
  it("does not auto-click CarVertical preview and gates check behind purchase flag", () => {
    const src = readFileSync(path.join(ROOT, "public/userscripts/provin-vin-autofill.user.js"), "utf8");
    expect(src).toMatch(/@version\s+1\.23\.0/);
    expect(src).toContain('id === "nicb"');
    expect(src).toContain('id === "plc_auction"');
    expect(src).not.toContain('id === "vp_wanted"');
    expect(src).toContain('id === "lt_itpr"');
    expect(src).not.toContain('id === "carvertical_preview" || id === "vininspect"');
    expect(src).toContain("carVerticalPurchaseConfirmed");
    expect(src).toContain("provinCarverticalPurchase");
    expect(src).toContain("if (!carVerticalPurchaseConfirmed()) return;");
    expect(src).toContain("provin_cv_purchase_result");
    expect(src).toContain("watchCarVerticalPurchasedReport");
    expect(src).toContain("advanceCarVerticalCheckout");
    expect(src).toContain("classifyCarVerticalCheckoutStep");
    expect(src).toContain("PROVIN CarVertical solis:");
    expect(src).toContain("provin_cv_purchase_vin");
    expect(src).toContain(CARVERTICAL_PURCHASED_SUMMARY_LV);
    expect(src).toContain(CARVERTICAL_CHECKOUT_HUMAN_STOP_LV);
    expect(src).toContain(CARVERTICAL_PURPOSE_SURVEY_RE.source);
    expect(src).toContain(CARVERTICAL_PURPOSE_PREFERRED_RE.source);
    expect(src).toContain(CARVERTICAL_PURPOSE_DEALER_RE.source);
    expect(src).toContain(CARVERTICAL_DISMISS_CLICK_RE.source);
    expect(src).toContain(CARVERTICAL_EXPLICIT_SAVED_PAY_RE.source);
    expect(src).toContain(CARVERTICAL_SAVED_PAY_CLICK_RE.source);
    expect(src).toContain(CARVERTICAL_3DS_PAGE_RE.source);
  });

  it("VIN SCAN panel does not buy CarVertical; purchase stays in the order opener", () => {
    const panel = readFileSync(path.join(ROOT, "components/admin/AdminVinScanPanel.tsx"), "utf8");
    expect(panel).not.toContain("Pirkt atskaiti");
    expect(panel).not.toContain("openCarVerticalPurchaseTab");
    expect(panel).not.toContain("purchaseCarVerticalReport");
    expect(panel).not.toContain("carvertical");
    const opener = readFileSync(path.join(ROOT, "components/admin/AdminCarVerticalPurchaseButton.tsx"), "utf8");
    expect(opener).toContain("window.confirm(CARVERTICAL_PURCHASE_CONFIRM_LV)");
    expect(opener).toContain("explicitOperatorConfirm: true");
    expect(opener).toContain('dataset.provinCarverticalPurchase = "1"');
  });
});
