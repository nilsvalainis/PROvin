import { describe, expect, it } from "vitest";
import { carPopupCanDeliver, IrissLogistikaCarPopup } from "@/components/admin/iriss-logistika/IrissLogistikaCarPopup";
import { emptyCargoPlan } from "@/lib/iriss-logistics-cargo-plan";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { renderText } from "@/lib/test-render";

function makeOrder(partial: Partial<LogisticsOrder> = {}): LogisticsOrder {
  return {
    id: "lo-1",
    workspace: "iriss",
    source: "auction",
    auction: "Auto1",
    auctionUrl: "",
    listingUrl: "",
    listingParsed: null,
    make: "Volvo",
    model: "XC60",
    vin: "YV1UZA8VDN1234567",
    title: "Volvo XC60",
    priceEur: null,
    mileageKm: 80000,
    pickupPointId: "lp-1",
    pickupSnapshot: {
      name: "Dortmund",
      auction: "Auto1",
      street: "Industriestrasse 12",
      postcode: "44309",
      city: "Dortmund",
      country: "Vācija",
      lat: 51.5,
      lng: 7.5,
      hoursText: "",
      contactName: "",
      phone: "+491511234567",
      email: "",
      parkingRule: null,
      rules: "",
    },
    pickupRef: "PU-1",
    pickupAddress: "Industriestrasse 12, 44309 Dortmund",
    pickupLat: 51.5,
    pickupLng: 7.5,
    geocodeStatus: "ok",
    pickupDate: "2026-10-14",
    stockNo: "",
    freeParkingUntil: "",
    transportCostEur: null,
    transportCostAuto: false,
    status: "ready",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "",
    notes: "",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...partial,
  };
}

const order = makeOrder({ status: "in_transit_to_warehouse" });

describe("Kartes kartīte: «Piegādāts - uz Autoparku» (Nils 19.11, A)", () => {
  it("poga redzama tikai ar tiesībām un ja auto vēl nav atvests", () => {
    expect(carPopupCanDeliver(order, "in_transit", true)).toBe(true);
    expect(carPopupCanDeliver(order, "in_transit", false)).toBe(false);
    expect(carPopupCanDeliver(order, "arrived", true)).toBe(false);
    expect(carPopupCanDeliver({ ...order, status: "delivered" }, "waiting", true)).toBe(false);
    expect(carPopupCanDeliver({ ...order, archived: true }, "waiting", true)).toBe(false);
  });

  it("kartītē poga ir, bet bez tiesībām - nav; nekas nenotiek bez apstiprinājuma", () => {
    const props = { order, plan: emptyCargoPlan("2026-11-19T00:00:00.000Z"), stage: "in_transit" as const, onClose: () => {}, onPlanChange: () => {} };
    const allowed = renderText(<IrissLogistikaCarPopup {...props} canMoveToAutopark onMoveToAutopark={async () => true} />);
    expect(allowed).toContain("Piegādāts - uz Autoparku");
    expect(allowed).not.toContain("Jā, uz Autoparku");
    const denied = renderText(<IrissLogistikaCarPopup {...props} onMoveToAutopark={async () => true} />);
    expect(denied).not.toContain("Piegādāts - uz Autoparku");
  });
});
