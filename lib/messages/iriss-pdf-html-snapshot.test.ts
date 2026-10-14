import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildIrissOfferPrintHtml, buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const FIXED_DATE = "2026. gada 15. aprīlis";

function minimalOffer() {
  const offer = emptyIrissOfferRecord("off-snap", "2026-04-15T10:00:00.000Z", "BMW 320d");
  offer.brandModel = "BMW 320d";
  offer.year = "2018";
  offer.mileage = "145 000 km";
  offer.firstRegistration = "2018";
  offer.odometerReading = "145 000 km";
  offer.transmission = "Automātiskā";
  offer.location = "Vācija";
  offer.priceGermany = "12 500";
  offer.carPrice = "12 500 €";
  offer.deliveryPrice = "800 €";
  offer.commissionFee = "500 €";
  offer.offerValidDays = "7";
  offer.hasFullServiceHistory = true;
  offer.hasFactoryPaint = true;
  offer.hasNoRustBody = false;
  offer.hasSecondWheelSet = true;
  offer.visualAssessment = "8/10 labs stāvoklis";
  offer.technicalAssessment = "7/10";
  offer.summary = "Kopsavilkuma teksts";
  return offer;
}

describe("IRISS printable PDF HTML (template defaults)", () => {
  it("offer print HTML matches snapshot without overrides", () => {
    const rec = emptyIrissPasutijums("pdf-snap-order", "2026-04-15T10:00:00.000Z");
    rec.clientFirstName = "Jānis";
    rec.clientLastName = "Bērziņš";
    rec.phone = "+37120000000";
    rec.email = "klients@example.com";
    const html = buildIrissOfferPrintHtml(rec, minimalOffer(), FIXED_DATE, null);
    expect(html).toMatchSnapshot();
  });

  it("pasūtījuma print HTML matches snapshot without overrides", () => {
    const rec = emptyIrissPasutijums("pdf-snap-order", "2026-04-15T10:00:00.000Z");
    rec.clientFirstName = "Anna";
    rec.clientLastName = "Liepa";
    rec.phone = "+37121111111";
    rec.email = "anna@example.com";
    rec.orderDate = "2026-04-10";
    rec.brandModel = "VW Golf";
    rec.engineType = "Benzīns";
    rec.equipmentRequired = "ACC";
    rec.notes = "Piezīme";
    const html = buildIrissPasutijumsPrintHtml(rec, FIXED_DATE, null);
    expect(html).toMatchSnapshot();
  });
});
