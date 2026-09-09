import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import { emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import { emptyOutvinDataBundle } from "@/lib/outvin-data-bundle";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { PDF_DEALER_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logo-data";
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
    expect(html).toContain("oem-top");
    expect(html).toContain("Official dealer data");
    expect(html).toContain("oem-kicker");
    expect(html).toContain("oem-svc");
    expect(html).toContain("210mm");
    expect(html).toContain("297mm");
    expect(html).not.toContain("Portrait A4");
    expect(html).not.toContain("Source data as provided");
    expect(html).not.toContain("OneAuto ·");
    expect(html).not.toContain("oem-masthead");
    expect(html).not.toContain("PROVIN DĪLERIS");
    expect(html).not.toContain("PROVIN.LV");
    expect(html).not.toContain("Modelis");
  });

  it("omits empty service columns so headers stay aligned", () => {
    const block = emptyAutoRecordsBlock();
    block.oneautoIngest = {
      ...emptyOneautoIngest(),
      lastFetchedVin: "YV1PZ68TCL1106362",
      results: {
        oe_service_history: {
          ok: true,
          payload: {
            success: true,
            result: {
              service_events: [
                {
                  date_of_service_event: "2022-10-13",
                  mileage_observed: 128438,
                  service_actions: ["Engine oil change\nOil filter"],
                },
              ],
            },
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: block,
    });
    expect(html).toContain(">Date<");
    expect(html).toContain(">km<");
    expect(html).toContain(">Work<");
    expect(html).not.toContain(">Type<");
    expect(html).not.toContain(">Guarantee<");
    expect(html).not.toContain(">Dealer<");
    expect(html).not.toContain(">Address<");
    expect(html).not.toContain("Order no.");
  });

  it("does not invent visits when serviceWorks and API payloads are empty", () => {
    const block = emptyAutoRecordsBlock();
    const bundle = emptyOutvinDataBundle("WAUZZZF22KN121142");
    block.outvin = bundle;
    const visits = collectOemDealerVisits(
      { ...createDefaultSourceBlocks().auto_records, ...block },
      bundle,
    );
    expect(visits).toHaveLength(0);
  });

  it("does not invent visits when serviceWorks and API payloads are empty", () => {
    const block = emptyAutoRecordsBlock();
    const bundle = emptyOutvinDataBundle("WAUZZZF22KN121142");
    block.outvin = bundle;
    const visits = collectOemDealerVisits(block, bundle);
    expect(visits).toHaveLength(0);
    const html = buildOemDealerDocumentHtml({
      vin: "WAUZZZF22KN121142",
      makeModel: "Audi A7",
      autoRecords: block,
    });
    expect(html).not.toContain("oem-side");
  });

  it("never shows LV-translated serviceWorks in OEM Service history (original only)", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      {
        date: "13.10.2022",
        odometer: "128482",
        location: "Volvo Partner",
        works: "Automātiskā pārnesumkārba. Automātiskās transmisijas maiņa. Diagnoze: noplūde.",
      },
    ];
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: block,
    });
    expect(html).not.toContain("Automātiskā pārnesumkārba");
    expect(html).not.toContain("128482");
    // Section still renders (not silently vanished) with an honest English status note.
    expect(html).toContain("Service history");
    expect(html).toContain("Reload OE Service History");
  });

  it("prefers raw OneAuto language over LV serviceWorks when both exist", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      {
        date: "21.10.2019",
        odometer: "69343",
        location: "Riga",
        works: "Eļļas maiņa un filtrs.",
      },
    ];
    block.oneautoIngest = {
      ...emptyOneautoIngest(),
      lastFetchedVin: "YV1PZ68TCL1106362",
      results: {
        oe_service_history: {
          ok: true,
          payload: {
            success: true,
            result: {
              service_events: [
                {
                  date_of_service_event: "2019-10-21",
                  mileage_observed: 69343,
                  service_provider: "Volvo Partner",
                  service_actions: ["Engine: oil and filter change."],
                },
              ],
            },
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: block,
    });
    expect(html).toContain("Engine: oil and filter change.");
    expect(html).not.toContain("Eļļas maiņa");
    expect(html).not.toContain("oem-side");
  });

  it("merges outvinReport vehicle fields even when an empty outvin shell exists", () => {
    const block = emptyAutoRecordsBlock();
    block.outvin = emptyOutvinDataBundle("YV1PZ68TCL1106362");
    block.outvinReport = {
      vehicleInfo: {
        ...emptyOutvinVehicleInfo(),
        vinCode: "YV1PZ68TCL1106362",
        model: "XC60",
        engineCode: "D4204T14",
      },
      equipment: [{ code: "000053", description: "Metallic paint" }],
      accidentCheck: "",
      stolenCheck: "",
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: block,
    });
    expect(html).toContain("XC60");
    expect(html).toContain("D4204T14");
    expect(html).toContain("Metallic paint");
  });

  it("renders OneAuto raw payloads when outvin is empty (Volvo VIN logo)", () => {
    const vin = "YV1PZ68TCL1106362";
    const oneauto = emptyOneautoBlock();
    oneauto.lastFetchedVin = vin;
    oneauto.results = {
      oe_build_sheet: {
        ok: true,
        payload: {
          success: true,
          result: {
            manufacturer: "Volvo",
            oem_vehicle_desc: "XC60",
            oem_engine: "D4204T14",
            options: [{ factory_code: "000053", factory_desc: "Metallic paint" }],
          },
        },
      },
      oe_service_history: {
        ok: true,
        payload: {
          success: true,
          result: {
            service_events: [
              {
                date_of_service_event: "2019-10-21",
                mileage_observed: 69343,
                service_provider: "Volvo Partner Riga",
                service_actions: ["Engine: oil and filter change."],
              },
            ],
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin,
      makeModel: "",
      autoRecords: emptyAutoRecordsBlock(),
      oneauto,
    });
    expect(html).toContain(vin);
    expect(html).toContain("Volvo Partner Riga");
    expect(html).toContain("Engine: oil and filter change.");
    expect(html).toContain("Metallic paint");
    expect(html).toContain("oem-eq");
    expect(html).toContain("oem-eq-code");
    expect(html).not.toContain("factory code");
    expect(html).not.toContain("factory desc");
    expect(html).not.toContain("OneAuto ·");
    expect(html).not.toContain("(raw)");
    expect(html).toContain(PDF_DEALER_LOGO_DATA_URI.volvo!);
    expect(html).not.toMatch(/class="oem-logo oem-logo--mono"/);
    expect(html).toMatch(/VOLVO|XC60/i);
    const vehicleIdx = html.indexOf(`>${vin}<`);
    const serviceIdx = html.indexOf(">Service history<");
    const equipIdx = html.indexOf(">Equipment<");
    expect(vehicleIdx).toBeGreaterThan(-1);
    expect(serviceIdx).toBeGreaterThan(vehicleIdx);
    expect(equipIdx).toBeGreaterThan(serviceIdx);
    expect(html).not.toContain(`VIN ${vin}`);
    expect(html).not.toContain("oem-vin");
  });

  it("keeps factory options out of Vehicle and only in compact Equipment", () => {
    const oneauto = emptyOneautoBlock();
    oneauto.results = {
      oe_build_sheet: {
        ok: true,
        payload: {
          success: true,
          result: {
            manufacturer: "Volvo",
            oem_vehicle_desc: "XC60",
            oem_engine: "D4204T23",
            options: [
              { factory_code: "PB02", factory_desc: "MAKEUP LAMP SUNVISOR 2 illuminated sun visors" },
              { factory_code: "KG03", factory_desc: "CRUISE CONTROL Adaptive Cruise Control" },
            ],
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: emptyAutoRecordsBlock(),
      oneauto,
    });
    expect(html).not.toContain("factory code");
    expect(html).not.toContain("factory desc");
    expect(html).toContain("PB02");
    expect(html).toContain("MAKEUP LAMP SUNVISOR");
    expect(html).toContain("oem-eq-item");
    const vehicleBlock = html.slice(html.indexOf(">YV1PZ68TCL1106362<"), html.indexOf(">Equipment<"));
    expect(vehicleBlock).not.toContain("PB02");
    expect(vehicleBlock).not.toContain("MAKEUP LAMP");
  });

  it("uses serviceTimelineOriginal when raw service payload was wiped by a later product fetch", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      {
        date: "13.10.2022",
        odometer: "128482",
        location: "",
        works: "Automātiskā pārnesumkārba. Automātiskās transmisijas maiņa.",
      },
    ];
    block.oneautoIngest = {
      ...emptyOneautoIngest(),
      lastFetchedVin: "YV1PZ68TCL1106362",
      results: {
        oe_build_sheet: {
          ok: true,
          payload: { success: true, result: { manufacturer: "Volvo" } },
        },
      },
      serviceTimelineOriginal: [
        {
          date: "13.10.2022",
          odometer: "128482",
          place: "Volvo Partner",
          works: "Automatikgetriebe. Getriebeölverlust diagnostiziert.",
        },
      ],
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: block,
    });
    expect(html).toContain("Automatikgetriebe");
    expect(html).toContain("Getriebeölverlust");
    expect(html).not.toContain("Automātiskā pārnesumkārba");
    expect(html).toContain("Service history");
  });

  it("reads folded OneAuto payloads from auto_records.oneautoIngest", () => {
    const vin = "YV1PZ68TCL1106362";
    const ar = emptyAutoRecordsBlock();
    ar.oneautoIngest = {
      ...emptyOneautoIngest(),
      lastFetchedVin: vin,
      results: {
        oe_service_history: {
          ok: true,
          payload: {
            success: true,
            result: {
              service_events: [
                {
                  date_of_service_event: "2020-01-15",
                  mileage_observed: 80000,
                  service_provider: "Official dealer",
                  service_actions: ["Brake fluid"],
                },
              ],
            },
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin,
      makeModel: "",
      autoRecords: ar,
      oneauto: emptyOneautoBlock(),
    });
    expect(html).toContain("Official dealer");
    expect(html).toContain("Brake fluid");
    expect(html).toContain(PDF_DEALER_LOGO_DATA_URI.volvo!);
  });

  it("prefers richer service payload over empty ingest stub", () => {
    const ar = emptyAutoRecordsBlock();
    ar.oneautoIngest = {
      ...emptyOneautoIngest(),
      results: {
        oe_service_history: {
          ok: true,
          payload: { success: true, result: { service_events: [] } },
        },
      },
    };
    const oa = emptyOneautoBlock();
    oa.results = {
      oe_service_history: {
        ok: true,
        payload: {
          success: true,
          result: {
            service_events: [
              {
                date_of_service_event: "2021-07-25",
                mileage_observed: 75272,
                service_actions: ["Charge air cooler hose replacement."],
              },
            ],
          },
        },
      },
    };
    const html = buildOemDealerDocumentHtml({
      vin: "YV1PZ68TCL1106362",
      makeModel: "",
      autoRecords: ar,
      oneauto: oa,
    });
    expect(html).toContain("Charge air cooler hose replacement.");
    expect(html).not.toContain("Automātiskā");
  });
});
