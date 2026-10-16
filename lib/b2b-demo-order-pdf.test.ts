import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { DEFAULT_LISTING_COSTS } from "./iriss-listings-cost";
import { emptyB2bDemoSettings } from "./b2b-demo-settings";
import { createB2bDemoOrder, emptyB2bDemoOffer, newB2bDemoOfferId } from "./b2b-demo-orders";
import { buildB2bDemoOfferPdfModel, buildB2bDemoOfferPrintHtml, buildB2bDemoOrderPrintHtml } from "./b2b-demo-order-pdf-html";
import { resolveB2bDemoOfferPricing } from "./b2b-demo-order-pricing";

const TENANT_A = "tnt_pdfaaa";
const TENANT_B = "tnt_pdfbbb";

const FORBIDDEN = [
  "SIA ĪRISS",
  "ĪRISS",
  "Dzintarzeme",
  "1190",
  "200,00 EUR",
  "depozīta iemaksa 200",
];

describe("b2b demo offer PDF isolation", () => {
  it("uses this tenant's settings and never injects ĪRISS hardcoded fees or contacts", () => {
    const settings = emptyB2bDemoSettings(TENANT_A);
    settings.companyName = "Auto Sala";
    settings.companyReg = "41203000000";
    settings.vatNumber = "LV41203000000";
    settings.address = "Rīga, Testa 1";
    settings.phone = "20000001";
    settings.email = "info@autosala.lv";
    settings.bank = "LV12HABA0000000000000";
    settings.commissionEur = 250;
    settings.transportEur = 90;
    settings.auctionFeeEur = 40;
    settings.unexpectedEur = 15;
    settings.pdfFooterText = "Auto Sala kājene";
    settings.pdfTermsText = "Mūsu noteikumi: komisija no iestatījumiem.";
    settings.pdfDepositText = "Depozīts pēc vienošanās.";
    settings.vatMode = "standard";

    const order = createB2bDemoOrder(TENANT_A, {
      clientFirstName: "Jānis",
      clientLastName: "Kalniņš",
      brandModel: "Volvo XC60",
      phone: "20000002",
    });
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), order.createdAt, "Piedāvājums 1");
    offer.carPrice = "18000";
    offer.brandModel = "Volvo XC60";
    order.offers = [offer];

    const pricing = resolveB2bDemoOfferPricing(order, offer, settings);
    expect(pricing.tenantId).toBe(TENANT_A);
    expect(pricing.lines.find((l) => l.label === "Komisija")?.amountEur).toBe(250);
    expect(pricing.lines.find((l) => l.label === "Piegāde / transports")?.amountEur).toBe(90);
    expect(pricing.lines.find((l) => l.label === "Izsoles maksa")?.amountEur).toBe(40);
    expect(pricing.lines.every((l) => l.amountEur !== DEFAULT_LISTING_COSTS.commission)).toBe(true);
    expect(pricing.lines.every((l) => l.amountEur !== DEFAULT_LISTING_COSTS.transport)).toBe(true);
    expect(pricing.lines.every((l) => l.amountEur !== DEFAULT_LISTING_COSTS.fee)).toBe(true);
    expect(pricing.lines.every((l) => l.amountEur !== DEFAULT_LISTING_COSTS.unplanned)).toBe(true);

    const html = buildB2bDemoOfferPrintHtml(order, offer, settings, {
      tenantName: "Auto Sala",
      generatedAt: "2026. gada 16. oktobris",
    });
    expect(html).toContain("Auto Sala");
    expect(html).toContain("41203000000");
    expect(html).toContain("250,00 €");
    expect(html).toContain("90,00 €");
    expect(html).toContain("Mūsu noteikumi");
    expect(html).toContain("Depozīts pēc vienošanās");
    expect(html).not.toContain("/brands/dzintarzeme");
    for (const bad of FORBIDDEN) {
      expect(html.includes(bad), `PDF HTML must not contain ${bad}`).toBe(false);
    }
  });

  it("empty settings omit deposit and ĪRISS defaults instead of filling 200 EUR / 1190", () => {
    const settings = emptyB2bDemoSettings(TENANT_A);
    const order = createB2bDemoOrder(TENANT_A, { clientName: "Klients", brandModel: "Golf" });
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), order.createdAt);
    offer.carPrice = "5000";
    order.offers = [offer];
    const model = buildB2bDemoOfferPdfModel(order, offer, settings, { tenantName: "Dīleris X", generatedAt: "šodien" });
    expect(model.party.depositText).toBe("");
    expect(model.party.termsText).toBe("");
    expect(model.pricing?.lines.some((l) => l.label === "Komisija")).toBe(false);
    const html = buildB2bDemoOrderPrintHtml(order, settings, { tenantName: "Dīleris X", generatedAt: "šodien" });
    expect(html).not.toContain("200");
    expect(html).not.toContain("1190");
    expect(html).not.toContain("SIA ĪRISS");
  });

  it("does not mix tenant B company data into tenant A PDF", () => {
    const settingsA = emptyB2bDemoSettings(TENANT_A);
    settingsA.companyName = "Sala A";
    const settingsB = emptyB2bDemoSettings(TENANT_B);
    settingsB.companyName = "Sala B";
    const orderA = createB2bDemoOrder(TENANT_A, { clientName: "A", brandModel: "A4" });
    const html = buildB2bDemoOrderPrintHtml(orderA, settingsA, { tenantName: "Sala A", generatedAt: "šodien" });
    expect(html).toContain("Sala A");
    expect(html).not.toContain("Sala B");
    expect(() => buildB2bDemoOrderPrintHtml(orderA, settingsB, { tenantName: "Sala B", generatedAt: "šodien" })).toThrow();
  });

  it("builds PDF bytes from tenant settings", async () => {
    const { buildB2bDemoOfferPdfBytes } = await import("./b2b-demo-order-pdf");
    const settings = emptyB2bDemoSettings(TENANT_A);
    settings.companyName = "Auto Sala";
    settings.commissionEur = 250;
    const order = createB2bDemoOrder(TENANT_A, { clientName: "Jānis Kalniņš", brandModel: "Volvo XC60" });
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), order.createdAt);
    offer.carPrice = "18000";
    order.offers = [offer];
    const bytes = await buildB2bDemoOfferPdfBytes(order, offer, settings, {
      tenantName: "Auto Sala",
      generatedAt: "2026. gada 16. oktobris",
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
