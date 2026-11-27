import { describe, expect, it } from "vitest";

import {
  combineCtrDocs,
  ctrAiContext,
  ctrRawText,
  ctrServiceHistoryRows,
  ctrServiceWorkRows,
  groupCtrPdfRows,
  parseCtrPdfItems,
  type CtrPdfTextItem,
} from "@/lib/checkthisreg-pdf-parse";

/** Anonimizēts paraugs: izdomāts VIN, kodi un apraksti - tikai izdrukas struktūra kā Renault / BMW PDF. */
const VIN = "VF1TEST0000000001";
const BMW_VIN = "WBATEST0000000002";

type Cell = [x: number, text: string];

function rows(page: number, lines: Array<[y: number, cells: Cell[]]>): CtrPdfTextItem[] {
  const out: CtrPdfTextItem[] = [];
  for (const [y, cells] of lines) {
    for (const [x, text] of cells) out.push({ page, x, y, w: text.length * 4, str: text });
  }
  return out;
}

function renaultOperation(opts: { date?: string; km?: string; withHeader?: boolean; coverage?: string[] }): CtrPdfTextItem[] {
  const cov = opts.coverage ?? ["0%", "0%", "0%", "0%", "0%"];
  const lines: Array<[number, Cell[]]> = [
    [763, [[40, "Kangoo X (Y11), 1.5 DCI DIESEL ENGINE"]]],
    [749, [[40, VIN]]],
    [692, [[40, "Operation Detail"]]],
  ];
  if (opts.withHeader !== false) {
    lines.push(
      [671, [[45, "Date"], [99, "km"], [138, "OTS no."], [177, "Operation Description"], [316, "Renault"], [365, "DREU"], [414, "SIGMA"], [463, "Dealership"], [512, "Other"]]],
      [661, [[316, "Incident"]]],
      [644, [[47, opts.date ?? "2020-05-04"], [101, opts.km ?? "120000"], [189, "CONTROLS UNDER STEERING"], [326, cov[0]], [380, cov[1]], [429, cov[2]], [478, cov[3]], [527, cov[4]]]],
      [634, [[229, "WHEEL"]]],
      [611, [[78, "Symptom"], [154, "Noise when turning"]]],
      [594, [[58, "Customer Complaint"], [154, "SQUEAK"]]],
      [576, [[64, "Customer Record"], [154, "OTS"]]],
      [559, [[64, "Repair Diagnostic"], [154, "WORN PART"]]],
    );
  }
  lines.push(
    [533, [[45, "Code (labour / parts)"], [174, "Time"], [233, "Quantity"], [292, "Descriptions (operation and parts)"]]],
    [515, [[94, "12345"], [188, "13.2 h"], [392, "BODY WORK"]]],
    [498, [[96, "0025"], [190, "0.1 h"], [303, "RXFNZF FORFAIT LLD REVISION RENAULT - SO Replace cabin filter"]]],
    [480, [[80, "11 22 333 444"], [250, "1.00"], [387, "DOOR TRIM RH"]]],
    [463, [[80, "11 22 333 555"], [245, "000200"], [387, "STOP-DOOR,FR"]]],
    [446, [[80, "11 22 333 666"], [248, "- 0.00"], [387, "RETURNED PART"]]],
    [429, [[97, "DM1"], [250, "1.00"], [386, "ECOPARTICIPATION"]]],
    [24, [[404, "Friday, 27-Nov-2026 4:58:42 PM"]]],
  );
  return rows(1, lines);
}

function renaultMaintenance(): CtrPdfTextItem[] {
  return rows(1, [
    [763, [[45, "Kangoo X (Y11),1.5 DCI DIESEL ENGINE"]]],
    [746, [[45, VIN]]],
    [666, [[255, "MAINTENANCE PROGRAM"]]],
    [634, [[45, "The maintenance programme, the intervals"], [284, "KM"], [430, "Year"]]],
    [618, [[45, "period and apply in the country"], ...Array.from({ length: 12 }, (_, i): Cell => [330 + i * 19, String(i + 1)])]],
    [587, [[45, "Renault Service"], [279, "30000"]]],
    [542, [[45, "Replace the oil filter"], [279, "30000"]]],
    [520, [[45, "Drain the engine oil"], [279, "30000"]]],
    [433, [[45, "Replace the brake fluid"], [279, "120000"]]],
    [400, [[45, "THE FOLLOWING OPERATIONS MUST BE CARRIED OUT DURING THE SERVICE:"]]],
    [380, [[45, "Check the wiper blades"]]],
    [300, [[45, "FLUIDS: Please observe the manufacturer's recommendations carefully"]]],
    [280, [[45, "NORME : RN 0720 Average capacity: 7.70 Litres"]]],
  ]);
}

function bmwHistory(): CtrPdfTextItem[] {
  return [
    ...rows(1, [
      [737, [[38, "BMW F 11"]]],
      [722, [[38, "MODEL SERIES"], [171, "VIN"], [304, "VEHICLE TYPE"], [438, "TRANSMISSION"]]],
      [711, [[38, "F 11"], [171, "WBATE ST000 00 00002"], [304, "XX 81"], [438, "AUT"]]],
      [697, [[38, "STEERING"], [171, "ENGINE"], [304, "ENGINE NUMBER"], [438, "BODY"]]],
      [686, [[38, "LL"], [171, "N 53"], [304, "99999999"], [438, "TOU"]]],
      [563, [[38, "Specifications & Options"]]],
      [541, [[40, "Code"], [76, "Description"], [306, "Code"], [341, "Description"]]],
      [528, [[40, "0205"], [76, "Automatic transmission"], [306, "08 KA"], [341, "Oil service interval 24 mths / 30,000 km"]]],
      [194, [[38, "Service History"]]],
      [172, [[38, "No service history found ."]]],
    ]),
    ...rows(2, [
      [805, [[38, "Key Read History"]]],
      [782, [[47, "09/11/2022"], [114, "87,449 mi / 140,735 km"]]],
      [765, [[60, "Icon"], [177, "Component"], [320, "Status"], [379, "Due Date"], [456, "Remaining Distance"]]],
      [706, [[180, "Engine oil"], [318, "Not due"], [375, "26/12/2023"], [475, "11806 mi"]]],
    ]),
    ...rows(3, [
      [519, [[38, "Repair History"]]],
      [496, [[47, "11/11/2025"], [114, "87,452 mi / 140,740 km"], [212, "Dealer ID : 00000-1"], [294, "Order : 000000"]]],
      [480, [[51, "Part Name"], [321, "Part Number"], [486, "Quantity"]]],
      [466, [[51, "O - ring"], [321, "11000000001"], [499, "1"]]],
      [365, [[47, "21/07/2014"], [114, "23,161 mi / 37,274 km"], [212, "Autohaus Test GmbH , Teststadt"], [347, "Order : 000001"]]],
      [348, [[51, "Part Name"], [291, "Part Number"], [480, "Quantity"]]],
      [335, [[51, "Ignition coil"], [291, "12000000002"], [492, "6"]]],
    ]),
  ];
}

describe("groupCtrPdfRows", () => {
  it("atdala kolonnas pēc atstarpes un salīmē pieskarošos elementus", () => {
    const r = groupCtrPdfRows([
      { page: 1, x: 47, y: 644, w: 40, str: "2018-07-19" },
      { page: 1, x: 101, y: 644.5, w: 26, str: "163451" },
      { page: 1, x: 386, y: 521, w: 8, str: "B/" },
      { page: 1, x: 394, y: 521, w: 18, str: "POST" },
    ]);
    expect(r[0].cells.map((c) => c.text)).toEqual(["2018-07-19", "163451"]);
    expect(r[1].cells.map((c) => c.text)).toEqual(["B/POST"]);
  });
});

describe("parseCtrPdfItems - Renault Operation Detail", () => {
  it("nolasa datumu, km, segumu, piezīmes, darbus un detaļas", () => {
    const doc = parseCtrPdfItems("2020-05-04.pdf", renaultOperation({ coverage: ["100%", "0%", "0%", "0%", "0%"] }));
    expect(doc.format).toBe("renault_operation");
    expect(doc.vin).toBe(VIN);
    expect(doc.vehicleLine).toContain("Kangoo X");
    expect(doc.visits).toHaveLength(1);
    const v = doc.visits[0];
    expect(v.date).toBe("2020-05-04");
    expect(v.km).toBe(120000);
    expect(v.titles).toEqual(["CONTROLS UNDER STEERING WHEEL"]);
    expect(v.coverage?.renault).toBe(100);
    expect(v.notes.find((n) => n.label === "record")?.value).toBe("");
    expect(v.labour).toEqual([
      { code: "12345", hours: "13.2", desc: "BODY WORK" },
      { code: "0025", hours: "0.1", desc: "RXFNZF FORFAIT LLD REVISION RENAULT - SO Replace cabin filter" },
    ]);
    expect(v.parts.map((p) => [p.partNo, p.qty])).toEqual([
      ["11 22 333 444", 1],
      ["11 22 333 555", 2],
      ["11 22 333 666", -0],
      ["DM1", 1],
    ]);
  });

  it("rindas tekstā: bez atgrieztām detaļām un eko maksas, apmaksa latviski", () => {
    const c = combineCtrDocs([parseCtrPdfItems("2020-05-04.pdf", renaultOperation({}))]);
    const [row] = ctrServiceWorkRows(c, "Renault dīleris");
    expect(row).toMatchObject({ date: "04.05.2020", odometer: "120000", location: "Renault dīleris" });
    expect(row.works).toContain("BODY WORK (12345, 13,2 h)");
    expect(row.works).toContain("Replace cabin filter (0025, 0,1 h)");
    expect(row.works).toContain("STOP-DOOR,FR x2 (11 22 333 555)");
    expect(row.works).toContain("Simptoms: Noise when turning");
    expect(row.works).toContain("Apmaksāja klients (ražotāja garantija nesedza)");
    expect(row.works).not.toContain("RETURNED PART");
    expect(row.works).not.toContain("ECOPARTICIPATION");
    expect(ctrServiceHistoryRows(c)).toEqual([{ date: "04.05.2020", odometer: "120000", country: "" }]);
  });

  it("bez datuma rindas - datums no faila nosaukuma, km tukšs; vienas dienas PDF -> viena rinda", () => {
    const a = parseCtrPdfItems("2021-03-02 (1).pdf", renaultOperation({ withHeader: false }));
    const b = parseCtrPdfItems("2021-03-02 (2).pdf", renaultOperation({ date: "2021-03-02", km: "50100" }));
    expect(a.visits[0]).toMatchObject({ date: "2021-03-02", km: null });
    const rowsOut = ctrServiceWorkRows(combineCtrDocs([a, b]), "Renault dīleris");
    expect(rowsOut).toHaveLength(1);
    expect(rowsOut[0].odometer).toBe("50100");
  });
});

describe("parseCtrPdfItems - Renault Maintenance program", () => {
  it("ražotāja intervāli km un eļļas intervāls", () => {
    const doc = parseCtrPdfItems("Maintenance program - X.pdf", renaultMaintenance());
    expect(doc.format).toBe("renault_maintenance");
    expect(doc.maintenance?.items.map((i) => [i.label, i.km])).toEqual([
      ["Renault Service", 30000],
      ["Replace the oil filter", 30000],
      ["Drain the engine oil", 30000],
      ["Replace the brake fluid", 120000],
    ]);
    const c = combineCtrDocs([doc]);
    expect(c.oilInterval).toEqual({ km: 30000, months: null });
    expect(ctrAiContext(c, { make: "Renault", receivedDmy: "27.11.2026" })).toContain("Drain the engine oil ik 30 000 km");
  });
});

describe("parseCtrPdfItems - BMW vehicle history", () => {
  it("auto dati, eļļas intervāls, atslēgas nolasījumi un remonti", () => {
    const doc = parseCtrPdfItems("BMW - X.pdf", bmwHistory());
    expect(doc.format).toBe("bmw_vehicle_history");
    expect(doc.vin).toBe(BMW_VIN);
    expect(doc.vehicleInfo.some((i) => /ENGINE NUMBER/.test(i.label))).toBe(false);
    expect(doc.oilInterval).toEqual({ months: 24, km: 30000 });
    expect(doc.mileage).toContainEqual({ date: "2022-11-09", km: 140735 });
    expect(doc.cbs[0].lines[0]).toContain("Engine oil");
    const c = combineCtrDocs([doc]);
    const out = ctrServiceWorkRows(c, "BMW dīleris");
    expect(out.map((r) => [r.date, r.odometer, r.location])).toEqual([
      ["11.11.2025", "140740", "BMW dīleris"],
      ["21.07.2014", "37274", "Autohaus Test GmbH, Teststadt"],
    ]);
    expect(out[0].works).toContain("O-ring (11000000001)");
    expect(out[1].works).toContain("Ignition coil x6 (12000000002)");
    const raw = ctrRawText(c, { make: "BMW", receivedDmy: "27.11.2026" });
    expect(raw).toContain("Servisa statusi 2022-11-09");
    // Klienta tekstos avota nosaukums netiek rakstīts.
    expect(raw.toLowerCase()).not.toContain("checkthisreg");
    expect(ctrAiContext(c, { make: "BMW", receivedDmy: "27.11.2026" }).toLowerCase()).not.toContain("checkthisreg");
  });
});

describe("parseCtrPdfItems - nezināms formāts", () => {
  it("unknown + teksts saglabājas RAW", () => {
    const doc = parseCtrPdfItems("x.pdf", rows(1, [[700, [[40, "Some other dealer printout"]]]]));
    expect(doc.format).toBe("unknown");
    const c = combineCtrDocs([doc]);
    expect(c.unknownDocs).toEqual(["x.pdf"]);
    expect(ctrRawText(c, { make: "Audi", receivedDmy: "01.12.2026" })).toContain("Some other dealer printout");
  });
});
