import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { buildCarverticalPrecheckPurchaseUrl } from "@/lib/admin-vin-urls";
import {
  CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES,
  CARVERTICAL_BUY_ONE_REPORT_RE,
  CARVERTICAL_BUY_FORWARD_RE,
  CARVERTICAL_CHECK_PRICING_RE,
  CARVERTICAL_CHECKOUT_HUMAN_STOP_LV,
  CARVERTICAL_COUNTRY_STAY_LV_RE,
  CARVERTICAL_DISMISS_CLICK_RE,
  CARVERTICAL_PURPOSE_DEALER_RE,
  CARVERTICAL_PURPOSE_PREFERRED_RE,
  CARVERTICAL_PURPOSE_SURVEY_RE,
  CARVERTICAL_PURCHASED_SUMMARY_LV,
  CARVERTICAL_EXPLICIT_SAVED_PAY_RE,
  CARVERTICAL_SAVED_PAY_CLICK_RE,
  CARVERTICAL_START_AVOID_RE,
  CARVERTICAL_VIN_CONFIRM_CLICK_RE,
  CARVERTICAL_3DS_PAGE_RE,
  CARVERTICAL_VIN_INPUT_SELECTORS,
  buildCarVerticalPurchasedScanResult,
  carVerticalAutofillMayClick,
  carVerticalPurchasedReportReady,
  classifyCarVerticalCheckoutStep,
  extractCarVerticalActionLabel,
  isCarVerticalCheckoutFlowPage,
  isCarVerticalClickablePurchaseLabel,
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

  it("after confirm opens precheck searching URL with VIN and does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expected = buildCarverticalPrecheckPurchaseUrl(VIN);
    expect(purchaseCarVerticalReport({ vin: VIN, explicitOperatorConfirm: true })).toEqual({
      ok: true,
      mode: "manual_browser",
      href: expected,
      vin: VIN,
    });
    expect(expected).toContain("precheck/searching");
    expect(expected).toContain(encodeURIComponent(VIN));
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

  it("classifies LV purpose, Turpīnāt after choice, buy one pack, country stay", () => {
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Kādēļ vēlies pārbaudīt šo transportlīdzekli?",
        labels: ["Es pērku transportlīdzekli", "Turpīnāt"],
      }),
    ).toMatchObject({ kind: "purpose", label: "Es pērku transportlīdzekli" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Kādēļ vēlies pārbaudīt",
        labels: ["Es pērku transportlīdzekli", "Turpīnāt"],
        purposeOptionChosen: true,
      }),
    ).toMatchObject({ kind: "continue", label: "Turpīnāt" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Izvēlies paketi",
        href: "https://www.carvertical.com/lv/pricing",
        labels: ["Pirkt 1 atskaiti", "Pirkt 3 atskaites", "Ietaupi 20%"],
      }),
    ).toMatchObject({ kind: "buy_one", label: "Pirkt 1 atskaiti" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Palikt valstī: Latvija",
        labels: ["Palikt valstī: Latvija", "Mainīt valsti"],
      }),
    ).toMatchObject({ kind: "country_stay" });
    expect(isCarVerticalClickablePurchaseLabel("39,99 €")).toBe(false);
    expect(isCarVerticalClickablePurchaseLabel("Pirkt 3 atskaites")).toBe(false);
    expect(carVerticalAutofillMayClick("Pirkt 1 atskaiti", true)).toBe(true);
    expect(CARVERTICAL_BUY_ONE_REPORT_RE.test("Pirkt 1 atskaiti")).toBe(true);
    expect(CARVERTICAL_COUNTRY_STAY_LV_RE.test("Palikt valstī: Latvija")).toBe(true);
    expect(CARVERTICAL_COUNTRY_STAY_LV_RE.test("Stay in Latvia")).toBe(true);
    expect(CARVERTICAL_VIN_INPUT_SELECTORS[0]).toBe('input[name="identifier"]');
  });

  it("clicks through current CarVertical CTAs and skips VIN edit/header search", () => {
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Tā ir Tava izvēle. Priekšpārbaude gatava.",
        href: `https://www.carvertical.com/lv/precheck/searching?identifier=${VIN}`,
        labels: ["Pārbaudīt transportlīdzekli", "Pārbaudīt cenu", "Labot"],
      }),
    ).toMatchObject({ kind: "check_pricing", label: "Pārbaudīt cenu" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Check pricing",
        href: "https://www.carvertical.com/en/precheck",
        labels: ["Check vehicle", "Check pricing"],
      }),
    ).toMatchObject({ kind: "check_pricing", label: "Check pricing" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Izvēlies cenu piedāvājumu",
        href: `https://www.carvertical.com/lv/precheck?identifier=${VIN}`,
        labels: ["Pārbaudīt transportlīdzekli", "Pirkt atskaiti", "Pirkt 3 atskaites"],
      }),
    ).toMatchObject({ kind: "buy_one", label: "Pirkt atskaiti" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Select pricing package",
        href: "https://www.carvertical.com/lv/precheck",
        labels: ["Pērc par 24,99 €", "Pirkt 3 atskaites"],
      }),
    ).toMatchObject({ kind: "buy_one", label: "Pērc par 24,99 €" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "What’s your goal with this vehicle history check?",
        labels: ["I’m selling a vehicle", "I’m buying a vehicle", "Continue"],
      }),
    ).toMatchObject({ kind: "purpose", label: "I’m buying a vehicle" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Vai šis VIN izskatās pareizs?",
        labels: ["Sākt bez VIN", "Ziņot un turpināt", "Pārbaudi citu transportlīdzekli"],
      }),
    ).toMatchObject({ kind: "vin_confirm", label: "Ziņot un turpināt" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Does this VIN look right?",
        labels: ["Start without a VIN", "Report & proceed"],
      }),
    ).toMatchObject({ kind: "vin_confirm", label: "Report & proceed" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Stay in Latvia",
        labels: ["Stay in Latvia", "Change country"],
      }),
    ).toMatchObject({ kind: "country_stay", label: "Stay in Latvia" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "Tu jau pārbaudīji šo auto",
        labels: ["Skatīt atskaiti", "Ģenerēt jaunu atskaiti"],
      }),
    ).toMatchObject({ kind: "start_report", label: "Ģenerēt jaunu atskaiti" });
    expect(
      classifyCarVerticalCheckoutStep({
        purchaseConfirmed: true,
        pageText: "precheck",
        labels: ["Pārbaudīt transportlīdzekli", "Pārbaudīt cenu"],
        ignoredLabels: ["Pārbaudīt cenu"],
      }),
    ).toMatchObject({ kind: "start_report", label: "Pārbaudīt transportlīdzekli" });
    expect(carVerticalAutofillMayClick("Pārbaudīt cenu", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Check pricing", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pirkt atskaiti tūlīt", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Ziņot un turpināt", true)).toBe(true);
    expect(carVerticalAutofillMayClick("Pārbaudi citu transportlīdzekli", true)).toBe(false);
    expect(carVerticalAutofillMayClick("Start without a VIN", true)).toBe(false);
    expect(carVerticalAutofillMayClick("Pirkt atskaites", true)).toBe(false);
    expect(isCarVerticalClickablePurchaseLabel("Pirkt 3 atskaites")).toBe(false);
    expect(CARVERTICAL_CHECK_PRICING_RE.test("Pārbaudīt cenu")).toBe(true);
    expect(CARVERTICAL_BUY_FORWARD_RE.test("Pērc par 19,99 €")).toBe(true);
    expect(CARVERTICAL_VIN_CONFIRM_CLICK_RE.test("Report & proceed")).toBe(true);
    expect(CARVERTICAL_START_AVOID_RE.test("Check other vehicle")).toBe(true);
    expect(CARVERTICAL_BUY_ONE_REPORT_RE.test("Pirkt atskaites")).toBe(false);
    expect(
      extractCarVerticalActionLabel(
        "1 atskaite\n24,99 €\nBojājumi, nobraukums, īpašnieki un vēl desmit punkti kas padara karti garu\nPirkt 1 atskaiti",
      ),
    ).toBe("Pirkt 1 atskaiti");
  });

  it("does not treat precheck, pricing, checkout or reports list as purchased report", () => {
    const vin = VIN;
    const precheck = `https://www.carvertical.com/lv/precheck/searching?identifier=${vin}`;
    const pricing = "https://www.carvertical.com/lv/pricing";
    const checkout = "https://www.carvertical.com/lv/checkout?package=standard";
    const reports = "https://www.carvertical.com/lv/user/reports";
    const report = "https://www.carvertical.com/lv/report/abc";
    const body =
      `${vin} Pilnā atskaite odometer nobraukums vehicle history damage atskaite report ready your report `.repeat(4);
    expect(isCarVerticalCheckoutFlowPage(precheck)).toBe(true);
    expect(carVerticalPurchasedReportReady({ href: precheck, pageText: body, vin })).toBe(false);
    expect(carVerticalPurchasedReportReady({ href: pricing, pageText: body, vin })).toBe(false);
    expect(carVerticalPurchasedReportReady({ href: checkout, pageText: body, vin })).toBe(false);
    expect(carVerticalPurchasedReportReady({ href: reports, pageText: body, vin })).toBe(false);
    expect(carVerticalPurchasedReportReady({ href: report, pageText: body, vin })).toBe(true);
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
    expect(src).toMatch(/@version\s+1\.25\.0/);
    expect(src).toContain('input[name="identifier"]');
    expect(src).toContain('params.get("identifier")');
    expect(src).toContain("extractCarVerticalActionLabel");
    expect(src).toContain("ignoredLabels");
    expect(src).toContain(CARVERTICAL_CHECK_PRICING_RE.source);
    expect(src).toContain(CARVERTICAL_BUY_FORWARD_RE.source);
    expect(src).toContain(CARVERTICAL_VIN_CONFIRM_CLICK_RE.source);
    expect(src).toContain(CARVERTICAL_START_AVOID_RE.source);
    expect(src).toContain("purposeOptionChosen");
    expect(src).toContain("carVerticalPurchasedReportReady");
    expect(src).toContain("isCarVerticalCheckoutFlowPage");
    expect(src).toContain(CARVERTICAL_BUY_ONE_REPORT_RE.source);
    expect(src).toContain(CARVERTICAL_COUNTRY_STAY_LV_RE.source);
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
