import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCarverticalPrecheckPurchaseUrl } from "@/lib/admin-vin-urls";
import {
  CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES,
  CARVERTICAL_BUY_ONE_REPORT_RE,
  CARVERTICAL_BUY_FORWARD_RE,
  CARVERTICAL_CHECK_PRICING_RE,
  CARVERTICAL_CHECKOUT_HUMAN_STOP_LV,
  CARVERTICAL_COUNTRY_STAY_LV_RE,
  CARVERTICAL_PURCHASE_CONFIRM_LV,
  CARVERTICAL_PURCHASED_SUMMARY_LV,
  CARVERTICAL_START_AVOID_RE,
  CARVERTICAL_VIN_CONFIRM_CLICK_RE,
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
import { openCarVerticalPurchaseTab } from "@/components/admin/AdminCarVerticalPurchaseButton";
import { VIN_SCAN_BROWSER_AUTO_CLICK_IDS, vinScanBrowserMayAutoClick } from "@/lib/vin-scan/browser-click-policy";
import { importChain, importedBindings, reachableProjectFiles } from "@/lib/vin-scan/test-helpers/import-graph";
import { FakeElement, runUserscriptAt } from "@/lib/vin-scan/test-helpers/userscript-vm";

const VIN = "WVWZZZ1JZXW000001";

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
  /*
   * Vienīgā pārbaude pēc koda struktūras, apzināti šaura: īsts importu grafs (TypeScript resolveris),
   * tranzitīvi no visām automātisko plūsmu ieejām. Uzvedības daļa (maksas avotu zondes netiek sauktas,
   * pirkuma funkcija netiek izsaukta) ir lib/vin-scan/auto-flow-paid-sources.test.ts. Grafs sedz to,
   * ko izpildot nevar pierādīt: ka nevienā zarā (Stripe webhook, cron, partneru API) nav ceļa uz pirkumu.
   */
  it("no automatic entry point can reach the purchase function or the purchase button", () => {
    const reached = reachableProjectFiles(CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES);
    expect(reached.size).toBeGreaterThan(CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES.length);
    const button = "components/admin/AdminCarVerticalPurchaseButton.tsx";
    expect(reached.has(button), importChain(reached, button).join(" -> ")).toBe(false);
    for (const file of reached.keys()) {
      if (file === "lib/carvertical-purchase.ts") continue;
      const names = importedBindings(file, "lib/carvertical-purchase.ts");
      const chain = importChain(reached, file).join(" -> ");
      expect(names, chain).not.toContain("purchaseCarVerticalReport");
      expect(names, chain).not.toContain("*");
    }
  });

  it("VIN SCAN panel cannot reach the purchase button or function; purchase stays in the order opener", () => {
    const button = "components/admin/AdminCarVerticalPurchaseButton.tsx";
    const reached = reachableProjectFiles([
      "components/admin/AdminVinScanPanel.tsx",
      "components/admin/AdminVinScanPageClient.tsx",
      "components/admin/AdminOrderVinScanCard.tsx",
    ]);
    expect(reached.has(button), importChain(reached, button).join(" -> ")).toBe(false);
    for (const file of reached.keys()) {
      if (file === "lib/carvertical-purchase.ts") continue;
      const names = importedBindings(file, "lib/carvertical-purchase.ts");
      expect(names, importChain(reached, file).join(" -> ")).not.toContain("purchaseCarVerticalReport");
      expect(names, importChain(reached, file).join(" -> ")).not.toContain("*");
    }
  });

  it("the import graph check sees a real purchase import (positive control)", () => {
    const button = "components/admin/AdminCarVerticalPurchaseButton.tsx";
    expect(importedBindings(button, "lib/carvertical-purchase.ts")).toContain("purchaseCarVerticalReport");
    expect(reachableProjectFiles([button]).has("lib/carvertical-purchase.ts")).toBe(true);
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

/* ---------- Userscript CarVertical lapā: īstais skripts Node vm vidē ---------- */

type CvPage = {
  href: string;
  pageText: string;
  labels: string[];
  /** Redzams 3-D Secure iframe. */
  has3dsFrame?: boolean;
  /** Redzams jaunas kartes numura lauks. */
  hasNewCardField?: boolean;
};

const CV_FLAG = { provin_cv_purchase: "1", provin_cv_purchase_vin: VIN, provin_pending_vin: VIN };

/** Palaiž skriptu CarVertical lapā ar dotajām pogām un izpilda vienu checkout soli. */
function userscriptOnCarVertical(page: CvPage, gm: Record<string, unknown>) {
  const buttons = page.labels.map((label) => new FakeElement("button", { text: label }));
  const elements = [...buttons];
  if (page.has3dsFrame) elements.push(new FakeElement("iframe", { attrs: { title: "3-D Secure", src: "https://acs.bank.test/3ds" } }));
  if (page.hasNewCardField) elements.push(new FakeElement("input", { attrs: { autocomplete: "cc-number", type: "text" } }));
  const run = runUserscriptAt(page.href, { gm, elements, bodyText: page.pageText });
  expect(run.errors).toEqual([]);
  /* 250 ms cilpa palaiž pirkuma vērotāju, tā 500 ms cilpa izpilda soli; pēc 1 s arī tiešais ceļš. */
  for (let i = 0; i < 6; i += 1) {
    run.tickIntervals(250);
    run.flushTimeouts();
  }
  run.tickIntervals(500);
  const clicked = buttons.filter((b) => b.clicks > 0).map((b) => b.textContent);
  const badge = run.created.map((el) => el.textContent).filter(Boolean).join(" | ");
  return { run, clicked, badge };
}

const CV_PAGES: CvPage[] = [
  {
    href: `https://www.carvertical.com/lv/precheck/searching?identifier=${VIN}`,
    pageText: "Tā ir Tava izvēle. Priekšpārbaude gatava.",
    labels: ["Pārbaudīt transportlīdzekli", "Pārbaudīt cenu", "Labot"],
  },
  { href: "https://www.carvertical.com/en/precheck", pageText: "Check pricing", labels: ["Check vehicle", "Check pricing"] },
  {
    href: `https://www.carvertical.com/lv/precheck?identifier=${VIN}`,
    pageText: "Izvēlies cenu piedāvājumu",
    labels: ["Pārbaudīt transportlīdzekli", "Pirkt atskaiti", "Pirkt 3 atskaites"],
  },
  { href: "https://www.carvertical.com/lv/precheck", pageText: "Select pricing package", labels: ["Pērc par 24,99 €", "Pirkt 3 atskaites"] },
  {
    href: "https://www.carvertical.com/lv/pricing",
    pageText: "Izvēlies paketi",
    labels: ["Pirkt 1 atskaiti", "Pirkt 3 atskaites", "Ietaupi 20%"],
  },
  {
    href: "https://www.carvertical.com/lv/checkout",
    pageText: "Kādēļ vēlies pārbaudīt šo transportlīdzekli?",
    labels: ["Es pērku transportlīdzekli", "Turpīnāt"],
  },
  {
    href: "https://www.carvertical.com/en/checkout",
    pageText: "What’s your goal with this vehicle history check?",
    labels: ["I’m selling a vehicle", "I’m buying a vehicle", "Continue"],
  },
  {
    href: "https://www.carvertical.com/en/checkout",
    pageText: "For what purpose are you buying the report?",
    labels: ["Other", "I'm a professional (dealer, workshop, etc.)", "I'm selling a car"],
  },
  {
    href: "https://www.carvertical.com/lv/precheck",
    pageText: "Vai šis VIN izskatās pareizs?",
    labels: ["Sākt bez VIN", "Ziņot un turpināt", "Pārbaudi citu transportlīdzekli"],
  },
  { href: "https://www.carvertical.com/en/precheck", pageText: "Does this VIN look right?", labels: ["Start without a VIN", "Report & proceed"] },
  { href: "https://www.carvertical.com/lv", pageText: "Palikt valstī: Latvija", labels: ["Palikt valstī: Latvija", "Mainīt valsti"] },
  { href: "https://www.carvertical.com/en", pageText: "Stay in Latvia", labels: ["Stay in Latvia", "Change country"] },
  { href: "https://www.carvertical.com/lv/precheck", pageText: "Tu jau pārbaudīji šo auto", labels: ["Skatīt atskaiti", "Ģenerēt jaunu atskaiti"] },
  { href: "https://www.carvertical.com/lv/user/reports", pageText: "Manas atskaites", labels: ["Sākt pārbaudi"] },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Unlock extra vehicles", labels: ["No thanks", "Pay now"] },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Pay with your balance", labels: ["Pay with credits"] },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Pay with saved card", labels: ["Pay"] },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Order summary", labels: ["Add a new card", "Subscribe", "Pievienot karti"] },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Order details", labels: ["Continue", "Add a new card"] },
  {
    href: "https://www.carvertical.com/en/checkout",
    pageText: "Complete 3-D Secure to finish payment",
    labels: ["Continue"],
    has3dsFrame: true,
  },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Enter card number", labels: ["Pay"], hasNewCardField: true },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Enter card number", labels: ["Pay with credits"], hasNewCardField: true },
  { href: "https://www.carvertical.com/en/checkout", pageText: "Verified by Visa: enter the SMS code", labels: ["Confirm", "Pay now"] },
];

describe("userscript stays aligned with no auto-buy", () => {
  it.each(CV_PAGES)("bez operatora pirkuma karoga neko nespiež: $pageText", (page) => {
    const { clicked, run } = userscriptOnCarVertical(page, { provin_pending_vin: VIN });
    expect(clicked).toEqual([]);
    expect(run.gm.set.has("provin_cv_purchase_result")).toBe(false);
  });

  it("URL parametrs ?provin_purchase=1 neaizstāj admin klikšķa karogu", () => {
    const { clicked } = userscriptOnCarVertical(
      { href: `https://www.carvertical.com/lv/precheck?identifier=${VIN}&provin_purchase=1`, pageText: "Priekšpārbaude", labels: ["Pirkt atskaiti", "Sākt pārbaudi"] },
      {},
    );
    expect(clicked).toEqual([]);
  });

  it.each(CV_PAGES)("ar karogu sper to pašu soli, ko lib klasifikators: $pageText", (page) => {
    const expected = classifyCarVerticalCheckoutStep({
      purchaseConfirmed: true,
      pageText: page.pageText,
      labels: page.labels,
      href: page.href,
      has3dsFrame: page.has3dsFrame,
      hasNewCardField: page.hasNewCardField,
    });
    const { clicked, badge } = userscriptOnCarVertical(page, CV_FLAG);
    expect(clicked).toEqual(expected.label ? [expected.label] : []);
    if (expected.kind === "stop_3ds") expect(badge).toContain(CARVERTICAL_CHECKOUT_HUMAN_STOP_LV);
    else expect(badge).not.toContain(CARVERTICAL_CHECKOUT_HUMAN_STOP_LV);
  });

  it("scenāriji sedz visus soļu veidus, ieskaitot apstāšanos pie 3-D Secure un jaunas kartes", () => {
    const kinds = new Set(
      CV_PAGES.map(
        (page) =>
          classifyCarVerticalCheckoutStep({
            purchaseConfirmed: true,
            pageText: page.pageText,
            labels: page.labels,
            href: page.href,
            has3dsFrame: page.has3dsFrame,
            hasNewCardField: page.hasNewCardField,
          }).kind,
      ),
    );
    expect([...kinds].sort()).toEqual(
      ["buy_one", "check_pricing", "continue", "country_stay", "dismiss", "pay_saved", "purpose", "start_report", "stop_3ds", "vin_confirm", "wait"].sort(),
    );
  });

  it("pēc mērķa izvēles nākamajā solī spiež Turpīnāt, nevis mērķi vēlreiz", () => {
    const page: CvPage = {
      href: "https://www.carvertical.com/lv/checkout",
      pageText: "Kādēļ vēlies pārbaudīt šo transportlīdzekli?",
      labels: ["Es pērku transportlīdzekli", "Turpīnāt"],
    };
    const buttons = page.labels.map((label) => new FakeElement("button", { text: label }));
    const run = runUserscriptAt(page.href, { gm: CV_FLAG, elements: buttons, bodyText: page.pageText });
    run.tickIntervals(250);
    run.tickIntervals(500);
    run.advance(1000);
    run.tickIntervals(500);
    expect(buttons.map((b) => b.clicks)).toEqual([1, 1]);
  });

  it.each(CARVERTICAL_VIN_INPUT_SELECTORS)("VIN lauku %s aizpilda arī bez pirkuma, bet pogu nespiež", (selector) => {
    const m = /^(input|textarea)?(?:#([\w-]+))?(?:\[name="(\w+)"\])?$/.exec(selector)!;
    const input = new FakeElement(m[1] ?? "input", { attrs: { ...(m[2] ? { id: m[2] } : {}), ...(m[3] ? { name: m[3] } : {}) } });
    const start = new FakeElement("button", { text: "Sākt pārbaudi" });
    const run = runUserscriptAt(`https://www.carvertical.com/lv?identifier=${VIN}`, { elements: [input, start] });
    run.tickIntervals(250);
    run.flushTimeouts();
    expect(input.value).toBe(VIN);
    expect(start.clicks).toBe(0);
  });

  it("gatavu nopirkto atskaiti paziņo adminam ar to pašu saturu, ko būvē lib, un nodzēš karogu", () => {
    const href = "https://www.carvertical.com/lv/report/abc";
    const body = `${VIN} Pilnā atskaite odometer nobraukums vehicle history damage report ready your report `.repeat(4);
    expect(carVerticalPurchasedReportReady({ href, pageText: body, vin: VIN })).toBe(true);
    const run = runUserscriptAt(href, { gm: CV_FLAG, bodyText: body });
    run.tickIntervals(250);
    for (let i = 0; i < 6; i += 1) run.tickIntervals(500);
    const published = JSON.parse(String(run.gm.set.get("provin_cv_purchase_result")));
    expect(published).toEqual(
      buildCarVerticalPurchasedScanResult({ vin: VIN, openUrl: href, detail: published.detail, ready: true }),
    );
    expect(published.summary).toBe(CARVERTICAL_PURCHASED_SUMMARY_LV);
    expect(isCarVerticalPurchasedScanSource(published)).toBe(true);
    expect(run.gm.set.has("provin_cv_purchase")).toBe(false);
    expect(run.gm.set.has("provin_cv_purchase_vin")).toBe(false);

    /* Admin cilne (kur operators nospieda pogu) rezultātu saņem kā provin-vin-scan-result. */
    const admin = runUserscriptAt("https://www.provin.lv/admin/orders/x");
    const anchor = new FakeElement("a", { attrs: { href } });
    anchor.dataset = { provinCarverticalPurchase: "1", provinHandoffVin: VIN };
    for (const fn of admin.listeners.get("click") ?? []) {
      fn({ target: { closest: (sel: string) => (sel.startsWith("a") ? anchor : null) }, isTrusted: true });
    }
    admin.gm.set.set("provin_cv_purchase_result", JSON.stringify(published));
    admin.tickIntervals(500);
    expect(admin.dispatched).toContainEqual({ type: "provin-vin-scan-result", detail: published });
  });

  it("pirkuma plūsmas lapas (precheck, cenas, checkout) netiek paziņotas kā nopirkta atskaite", () => {
    const body = `${VIN} Pilnā atskaite odometer nobraukums vehicle history damage report ready your report `.repeat(4);
    for (const href of [
      `https://www.carvertical.com/lv/precheck/searching?identifier=${VIN}`,
      "https://www.carvertical.com/lv/pricing",
      "https://www.carvertical.com/lv/checkout?package=standard",
      "https://www.carvertical.com/lv/user/reports",
    ]) {
      const run = runUserscriptAt(href, { gm: CV_FLAG, bodyText: body });
      run.tickIntervals(250);
      for (let i = 0; i < 8; i += 1) run.tickIntervals(500);
      expect(run.gm.set.has("provin_cv_purchase_result"), href).toBe(false);
    }
  });

  it("VIN SCAN rindā CarVertical priekšskatījums tiek tikai nolasīts, bez klikšķiem", () => {
    const buy = new FakeElement("button", { text: "Pirkt atskaiti" });
    const run = runUserscriptAt(`https://www.carvertical.com/lv/precheck?identifier=${VIN}`, {
      gm: { provin_scan_job: JSON.stringify({ vin: VIN, sources: ["carvertical_preview"], index: 0, startedAt: Date.now() }) },
      elements: [buy],
      bodyText: `Mēs atradām datus par ${VIN}`,
    });
    for (let i = 0; i < 10; i += 1) {
      run.tickIntervals();
      run.flushTimeouts();
    }
    expect(buy.clicks).toBe(0);
  });
});

describe("admin CarVertical pirkuma poga", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fakeBrowser(confirmAnswer: boolean) {
    const anchors: { href: string; target: string; dataset: Record<string, string>; clicked: number }[] = [];
    const confirm = vi.fn<(msg: string) => boolean>(() => confirmAnswer);
    vi.stubGlobal("window", { confirm });
    vi.stubGlobal("document", {
      createElement: () => {
        const a = { href: "", target: "", rel: "", dataset: {} as Record<string, string>, clicked: 0, click() { a.clicked += 1; }, remove() {} };
        anchors.push(a);
        return a;
      },
      body: { appendChild() {} },
    });
    return { anchors, confirm };
  }

  it("bez operatora apstiprinājuma cilni neatver un pirkuma karogu neliek", () => {
    const { anchors, confirm } = fakeBrowser(false);
    expect(openCarVerticalPurchaseTab(VIN)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(CARVERTICAL_PURCHASE_CONFIRM_LV);
    expect(anchors).toEqual([]);
  });

  it("pēc apstiprinājuma atver pirkuma saiti ar VIN un karogu, ko nolasa userscript", () => {
    const { anchors } = fakeBrowser(true);
    expect(openCarVerticalPurchaseTab(VIN.toLowerCase())).toBe(true);
    expect(anchors).toHaveLength(1);
    const a = anchors[0]!;
    expect(a.clicked).toBe(1);
    expect(a.href).toBe(buildCarverticalPrecheckPurchaseUrl(VIN));
    expect(a.target).toBe("_blank");
    expect(a.dataset).toEqual({ provinHandoffVin: VIN, provinCarverticalPurchase: "1" });

    /* Tas pats enkurs userscript pusē: īsts klikšķis ieslēdz pirkumu tieši šim VIN. */
    const admin = runUserscriptAt("https://www.provin.lv/admin/orders/x");
    const anchor = new FakeElement("a", { attrs: { href: a.href } });
    anchor.dataset = a.dataset;
    for (const fn of admin.listeners.get("click") ?? []) {
      fn({ target: { closest: (sel: string) => (sel.startsWith("a") ? anchor : null) }, isTrusted: true });
    }
    expect(admin.gm.set.get("provin_cv_purchase")).toBe("1");
    expect(admin.gm.set.get("provin_cv_purchase_vin")).toBe(VIN);
  });

  it("nederīgam VIN apstiprinājumu pat nejautā", () => {
    const { anchors, confirm } = fakeBrowser(true);
    expect(openCarVerticalPurchaseTab("nav vin")).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(anchors).toEqual([]);
  });
});
