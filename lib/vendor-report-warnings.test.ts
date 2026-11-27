import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { emptyVendorAvotuBlock, type VendorAvotuBlockState } from "@/lib/admin-source-blocks";
import { extractAutodnaReport } from "@/lib/autodna-report-extract";
import { extractCarverticalReport } from "@/lib/carvertical-report-extract";
import { readVendorPdfAiContextText, upsertVendorPdfAiContext } from "@/lib/vendor-ai-context-fill";
import {
  biggestMileageDrop,
  insertedArchivePhotoCount,
  reportPhotoCountFromText,
  vendorReportSummary,
  vendorReportWarnings,
} from "@/lib/vendor-report-warnings";

const fx = (p: string) => readFileSync(join(__dirname, "__fixtures__", p), "utf8");

function blockFrom(source: "autodna" | "carvertical", text: string): VendorAvotuBlockState {
  const ex = source === "autodna" ? extractAutodnaReport(text) : extractCarverticalReport(text);
  const base: VendorAvotuBlockState = {
    ...emptyVendorAvotuBlock(),
    serviceHistory: ex.mileage,
    incidents: ex.incidents,
    vehicleHistoryTimeline: ex.vehicleHistoryTimeline ?? [],
  };
  return upsertVendorPdfAiContext(base, text, { sourceLabel: source === "autodna" ? "AutoDNA" : "CarVertical", dateLabel: "27.11.2026" });
}

const keys = (b: VendorAvotuBlockState, text: string) => vendorReportWarnings(b, text).map((w) => w.key);

describe("readVendorPdfAiContextText", () => {
  it("atgriež tikai marķēto PDF tekstu", () => {
    const b = upsertVendorPdfAiContext({ ...emptyVendorAvotuBlock(), aiContextRaw: "operatora piezīme" }, "PDF rinda 1\nPDF rinda 2", {
      sourceLabel: "AutoDNA",
      dateLabel: "27.11.2026",
    });
    expect(readVendorPdfAiContextText(b, "AutoDNA")).toBe("PDF rinda 1\nPDF rinda 2");
    expect(readVendorPdfAiContextText(b, "CarVertical")).toBe("");
  });
});

describe("vendorReportWarnings - fikstūras", () => {
  it("Grandland CarVertical: 1 bojājums, bez totālās bojāejas no veidnes teksta", () => {
    const text = fx("grandland-W0VZCYHZXN6843259/carvertical.txt");
    const b = blockFrom("carvertical", text);
    const w = vendorReportWarnings(b, text);
    const damage = w.find((x) => x.key === "damage");
    expect(damage?.level).toBe("red");
    expect(damage?.text).toMatch(/^Negadījumi \/ bojājumi: 1/);
    expect(w.map((x) => x.key)).not.toContain("total_loss");
    expect(w.map((x) => x.key)).not.toContain("repair_cost");
    expect(w.map((x) => x.key)).not.toContain("mileage");
  });

  it("Grandland AutoDNA: 2 zaudējumu ieraksti; «Nav pilnīgu zaudējumu» / «Nav odometra neatbilstības» nav brīdinājumi", () => {
    const text = fx("grandland-W0VZCYHZXN6843259/autodna.txt");
    const b = blockFrom("autodna", text);
    const w = vendorReportWarnings(b, text);
    expect(w.find((x) => x.key === "damage")?.text).toMatch(/^Negadījumi \/ bojājumi: 2/);
    expect(w.map((x) => x.key)).not.toContain("total_loss");
    expect(w.map((x) => x.key)).not.toContain("mileage");
  });

  it("AutoDNA lapu pārrāvums: 3 negadījumi ar datumiem no teksta", () => {
    const text = fx("autodna-damage-page-break/autodna-lv.txt");
    const b = blockFrom("autodna", text);
    expect(vendorReportWarnings(b, text).find((x) => x.key === "damage")?.text).toBe("Negadījumi / bojājumi: 3 · 03.2019, 08.2020, 11.2021");
  });
});

describe("vendorReportWarnings - kategorijas", () => {
  const b = emptyVendorAvotuBlock();
  it("pozitīvi statusi -> brīdinājumi, negācijas -> nekas", () => {
    const text = [
      "Vēstures pārskats",
      "Kopējie zaudējumi - Reģistrēts",
      "Zādzība - Reģistrēts",
      "Odometra neatbilstība - Reģistrēts",
      "Taksometrs",
      "Reģistrēts",
      "Līzings / ķīla",
      "Atrasts",
      "Atsaukšanas kampaņas",
      "2 ieraksti",
      "Īpašnieku skaits: 4",
    ].join("\n");
    const k = keys(b, text);
    expect(k).toEqual(expect.arrayContaining(["total_loss", "theft", "mileage", "taxi", "lien", "recall", "owners"]));
    const w = vendorReportWarnings(b, text);
    expect(w.find((x) => x.key === "recall")?.text).toBe("Atsaukšanas kampaņas: 2");
    // Sarkanie pirms oranžajiem.
    const firstOrange = w.findIndex((x) => x.level === "orange");
    expect(w.slice(firstOrange).every((x) => x.level === "orange")).toBe(true);
  });

  it("negācijas un veidnes teikumi nedod brīdinājumus", () => {
    const text = [
      "Nav pilnīgu zaudējumu",
      "Nav odometra neatbilstības",
      "Kopējie zaudējumi - Ieraksti netika atrasti",
      "Zādzība",
      "Ieraksti netika atrasti",
      "Taksometrs",
      "Nav datu",
      "Juridiskais statuss",
      "Nav datu par to, ka šis transportlīdzeklis būtu atzīmēts kā utilizēts.",
      "Kad remonta izmaksas tuvojas vai pārsniedz lielu daļu no vērtības, tas var norādīt uz potenciālu pilnīgu zaudējumu.",
      "Īpašnieku skaits: 2",
    ].join("\n");
    expect(keys(b, text)).toEqual([]);
  });

  it("CarVertical augsts remonta izmaksu reitings -> oranžs ar %", () => {
    const text = ["Remonta izmaksu reitings", "Augsts", "64 % no transportlīdzekļa vērtības tajā laikā"].join("\n");
    const w = vendorReportWarnings(b, text);
    expect(w).toEqual([{ key: "repair_cost", level: "orange", text: "Augstas remonta izmaksas · 64 % no vērtības" }]);
  });

  it("nobraukuma kritums no tabulas, izsoles un valstis no laikposma", () => {
    const block: VendorAvotuBlockState = {
      ...emptyVendorAvotuBlock(),
      serviceHistory: [
        { date: "01.03.2018", odometer: "120 000", country: "Vācija" },
        { date: "01.05.2020", odometer: "95 000", country: "Vācija" },
        { date: "01.06.2022", odometer: "130 000", country: "Latvija" },
      ],
      vehicleHistoryTimeline: [{ date: "04.2020", country: "Vācija", description: "Izsoles ieraksts" }],
    };
    const w = vendorReportWarnings(block, "");
    expect(w.find((x) => x.key === "mileage")?.text).toBe("Nobraukuma kritums: -25 000 km · 01.05.2020");
    expect(w.find((x) => x.key === "auction")?.text).toBe("Izsoļu ieraksti: 1");
    expect(w.find((x) => x.key === "import")?.text).toBe("Valstis: Vācija → Latvija");
  });

  it("biggestMileageDrop ignorē mazas nobīdes", () => {
    expect(
      biggestMileageDrop([
        { date: "01.2020", odometer: "50000", country: "" },
        { date: "02.2020", odometer: "49500", country: "" },
      ]),
    ).toBeNull();
  });
});

describe("foto skaits", () => {
  it("AutoDNA «Fotogrāfijas N» summa arhīva sadaļā, CarVertical «atradām N fotogrāfijas»", () => {
    const dna = ["Transportlīdzekļa arhīva fotogrāfijas", "12.11.2024", "Fotogrāfijas 20", "03.02.2021", "Fotogrāfijas: 6"].join("\n");
    expect(reportPhotoCountFromText("autodna", dna)).toBe(26);
    expect(reportPhotoCountFromText("carvertical", "Fotogrāfijas\nMēs atradām 38 fotogrāfijas")).toBe(38);
    expect(reportPhotoCountFromText("carvertical", "Nekā")).toBeNull();
  });

  it("ievietotās foto skaita pēc grupas archive.source", () => {
    const blocks = {
      tirgus: {
        photoGroups: [
          { id: "a", title: "", photos: [{}, {}, {}], archive: { source: "autodna", date: "12.11.2024", via: "pdf" } },
          { id: "b", title: "", photos: [{}], archive: { source: "carvertical", date: "07.2020", via: "pdf" } },
          { id: "c", title: "", photos: [{}, {}] },
        ],
      },
      cc_vin: { photoGroups: [{ id: "d", title: "", photos: [{}, {}], archive: { source: "autodna", date: "2021", via: "pdf" } }] },
    } as never;
    expect(insertedArchivePhotoCount(blocks, "autodna")).toBe(5);
    expect(insertedArchivePhotoCount(blocks, "carvertical")).toBe(1);
  });

  it("vendorReportSummary: bez PDF teksta - nav atskaites, priekšpārbaudes foto kā rezerves skaits", () => {
    const s = vendorReportSummary({ source: "autodna", block: emptyVendorAvotuBlock(), precheckPhotos: 26 });
    expect(s).toEqual({ hasReport: false, warnings: [], photos: { inReport: 26, inserted: 0 } });
  });
});
