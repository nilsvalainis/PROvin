import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyOutvinDataBundle } from "@/lib/outvin-data-bundle";
import {
  buildOemDealerDocumentHtml,
  collectOemDealerVisits,
  oemVisitFromEvent,
} from "@/lib/pdf-dealer-oem";

describe("OEM dealer PDF", () => {
  it("maps API events including order number and parts", () => {
    const visit = oemVisitFromEvent({
      date: "2019-04-12",
      mileage: { value: 48210, unit: "km" },
      type: "Inspection",
      description: "Oil service",
      orderNumber: "4501234567",
      location: { label: "AUDI Zentrum Riga", city: "Riga", countryName: "Latvia" },
      warranty: "yes",
      parts: [{ partNumber: "06L115562", description: "Oil filter" }],
    });
    expect(visit?.orderNumber).toBe("4501234567");
    expect(visit?.km).toBe("48210 km");
    expect(visit?.dealer).toBe("AUDI Zentrum Riga");
    expect(visit?.extra).toContain("06L115562");
  });

  it("prefers raw purchase events over the condensed service table", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      { date: "12.04.2019", odometer: "48210", location: "Riga", works: "Apkope" },
    ];
    const bundle = emptyOutvinDataBundle("WAUZZZF22KN121142");
    bundle.purchases = [
      {
        historyType: 1,
        fetchedAt: "2026-09-07T00:00:00.000Z",
        payload: {
          data: {
            history: {
              events: [
                {
                  date: "2019-04-12",
                  mileage: { value: 48210, unit: "km" },
                  type: "Maintenance",
                  orderNumber: "WO-88",
                },
              ],
            },
          },
        },
      },
    ];
    block.outvin = bundle;
    const visits = collectOemDealerVisits(block, bundle);
    expect(visits).toHaveLength(1);
    expect(visits[0]?.orderNumber).toBe("WO-88");
    const html = buildOemDealerDocumentHtml({
      vin: "WAUZZZF22KN121142",
      makeModel: "Audi A7",
      autoRecords: { ...createDefaultSourceBlocks().auto_records, ...block },
    });
    expect(html).toContain("WAUZZZF22KN121142");
    expect(html).toContain("WO-88");
    expect(html).toContain("Order no.");
    expect(html).toContain("oem-masthead");
    expect(html).toContain("Official dealer data");
    expect(html).toContain("A4 portrait");
    expect(html).toContain("210mm");
    expect(html).toContain("297mm");
    expect(html).toContain("original language");
    expect(html).not.toContain("PROVIN DĪLERIS");
    expect(html).not.toContain("PROVIN.LV");
    expect(html).not.toContain("Modelis");
  });

  it("does not use LV-translated serviceWorks rows for the OEM extract", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      { date: "12.04.2019", odometer: "48210", location: "Riga", works: "Eļļas maiņa un filtri" },
    ];
    const bundle = emptyOutvinDataBundle("WAUZZZF22KN121142");
    block.outvin = bundle;
    const visits = collectOemDealerVisits(
      { ...createDefaultSourceBlocks().auto_records, ...block },
      bundle,
    );
    expect(visits).toHaveLength(0);
  });
});
