import { describe, expect, it } from "vitest";
import {
  auto1InvoiceNumberFromUrl,
  cabinetDocumentSourceChip,
  cabinetPhaseForStage,
  cabinetPrefKey,
  cabinetSectionSummary,
  defaultPickupStageFromOrderStatus,
  logisticsDocumentTitle,
  liveCabinetDocuments,
  readCabinetPrefsFromStorage,
  resolveCabinetSectionOpen,
  type CabinetDocument,
} from "@/lib/iriss-logistics-cabinet";

function doc(partial: Partial<CabinetDocument> = {}): CabinetDocument {
  return {
    id: "cd-1",
    carId: "lo-1",
    section: "A",
    type: "car_invoice",
    typeLabel: "Car Invoice",
    title: "Car Invoice: 1",
    docNumber: "1",
    source: "auto1",
    sourceUrl: "",
    blobPath: "",
    sha256: "abc",
    uploadedBy: "env-admin",
    createdAt: "2026-10-20T00:00:00.000Z",
    deletedAt: "",
    deletedBy: "",
    ...partial,
  };
}

describe("Loģistika cabinet helpers", () => {
  it("titles Auto1 invoices as Car Invoice: <nr> from the finance download URL", () => {
    const url = "https://www.auto1.com/en/app/finance/invoice/download-invoice/90042601299722";
    expect(auto1InvoiceNumberFromUrl(url)).toBe("90042601299722");
    expect(
      logisticsDocumentTitle({
        type: "car_invoice",
        sourceUrl: url,
      }),
    ).toBe("Car Invoice: 90042601299722");
    expect(logisticsDocumentTitle({ type: "car_invoice", sourceUrl: url })).not.toMatch(/car order/i);
  });

  it("uses type label plus number when the URL has no Auto1 nr", () => {
    expect(logisticsDocumentTitle({ type: "auction_invoice", docNumber: "90042601299723" })).toBe(
      "Auction Invoice: 90042601299723",
    );
    expect(logisticsDocumentTitle({ type: "pickup_pdf" })).toBe("Pickup dokuments");
  });

  it("defaults A+B open before Atvests and C open after, unless the user overrode", () => {
    expect(cabinetPhaseForStage("planned")).toBe("preAtvests");
    expect(cabinetPhaseForStage("arrived")).toBe("postAtvests");
    expect(resolveCabinetSectionOpen({}, "A", "waiting")).toBe(true);
    expect(resolveCabinetSectionOpen({}, "B", "planned")).toBe(true);
    expect(resolveCabinetSectionOpen({}, "C", "planned")).toBe(false);
    expect(resolveCabinetSectionOpen({}, "A", "arrived")).toBe(false);
    expect(resolveCabinetSectionOpen({}, "C", "arrived")).toBe(true);
    const prefs = { [cabinetPrefKey("A", "preAtvests")]: "closed" };
    expect(resolveCabinetSectionOpen(prefs, "A", "waiting")).toBe(false);
    expect(resolveCabinetSectionOpen(prefs, "B", "waiting")).toBe(true);
  });

  it("maps order status to pickup stage without inventing Atvests", () => {
    expect(defaultPickupStageFromOrderStatus("organize_pickup")).toBe("waiting");
    expect(defaultPickupStageFromOrderStatus("ready_for_pickup")).toBe("waiting");
    expect(defaultPickupStageFromOrderStatus("scheduled")).toBe("planned");
    expect(defaultPickupStageFromOrderStatus("pickup_confirmed")).toBe("planned");
    expect(defaultPickupStageFromOrderStatus("picked_up")).toBe("in_transit");
    expect(defaultPickupStageFromOrderStatus("in_transit_to_warehouse")).toBe("in_transit");
    expect(defaultPickupStageFromOrderStatus("delivered")).toBe("arrived");
  });

  it("hides soft-deleted documents from the cabinet summary", () => {
    const rows = [
      doc({ id: "1" }),
      doc({ id: "2", deletedAt: "2026-10-20T12:00:00.000Z", deletedBy: "env-admin" }),
      doc({ id: "3", type: "purchase_confirm" }),
    ];
    expect(liveCabinetDocuments(rows).map((d) => d.id)).toEqual(["1", "3"]);
    expect(cabinetSectionSummary("A", rows)).toBe("2 no 4 augšupielādēti");
  });

  it("tags automatic document sources and keeps CMR as a cabinet type", () => {
    expect(cabinetDocumentSourceChip("auto1", "Auto1")).toBe("No izsoles - Auto1");
    expect(cabinetDocumentSourceChip("email")).toBe("No e-pasta");
    expect(cabinetDocumentSourceChip("upload")).toBe("");
    expect(logisticsDocumentTitle({ type: "cmr" })).toBe("CMR");
  });

  it("parses localStorage prefs without throwing", () => {
    expect(readCabinetPrefsFromStorage(null)).toEqual({});
    expect(readCabinetPrefsFromStorage("{")).toEqual({});
    expect(readCabinetPrefsFromStorage(JSON.stringify({ "cabinet.section.A.preAtvests": "closed" }))).toEqual({
      "cabinet.section.A.preAtvests": "closed",
    });
  });
});
