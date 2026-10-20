import { describe, expect, it } from "vitest";
import { emptyIrissPasutijums, type IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";
import { formatIrissOffersLinksSummary, irissOfferCardPrimary } from "@/lib/iriss-order-offers-view";
import type { IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";

function offer(partial: Partial<IrissOfferRecord>): IrissOfferRecord {
  return {
    id: "o1",
    title: "Piedāvājums 1",
    brandModel: "",
    year: "",
    firstRegistration: "",
    vin: "",
    mileage: "",
    fuel: "",
    transmission: "",
    power: "",
    color: "",
    bodyType: "",
    location: "",
    carPrice: "",
    deliveryPrice: "",
    commissionFee: "",
    priceGermany: "",
    notes: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    attachments: [],
    ...partial,
  } as IrissOfferRecord;
}

function link(partial: Partial<IrissOfferClientLinkAdminView>): IrissOfferClientLinkAdminView {
  return {
    offerId: "o1",
    path: "/p/x",
    status: "sent",
    statusLabel: "Nosūtīts",
    statusAt: "2026-10-02T00:00:00.000Z",
    createdAt: "2026-10-02T00:00:00.000Z",
    expiresAt: "",
    viewCount: 0,
    question: "",
    ...partial,
  } as IrissOfferClientLinkAdminView;
}

describe("iriss order offers view", () => {
  it("picks one primary action and counts listing links", () => {
    expect(irissOfferCardPrimary(offer({}), null).label).toBe("Turpināt rediģēt");
    expect(irissOfferCardPrimary(offer({ brandModel: "Audi A6" }), null).label).toBe("Nosūtīt");
    expect(irissOfferCardPrimary(offer({ brandModel: "Audi A6" }), link({ status: "viewed" })).label).toBe("Atvērt piedāvājumu");
    const rec = emptyIrissPasutijums("order-1", "2026-10-15T11:31:00.000Z");
    rec.listingLinkAuto1 = ["https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI"];
    rec.listingLinkOpenline = ["https://www.openlane.eu/en/findcar?makes=audi"];
    expect(formatIrissOffersLinksSummary(rec)).toBe("Sludinājumu saites · 2");
  });
});
