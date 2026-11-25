import { describe, expect, it } from "vitest";

import {
  createDefaultSourceBlocks,
  mergeSourceBlocksWithDefaults,
  mergeVendorBlocksPlain,
  SOURCE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  carfaxDateToLv,
  carfaxNumberLv,
  carfaxTextLines,
  looksLikeCarfaxReport,
  parseCarfaxReportText,
} from "@/lib/carfax-report-parse";
import {
  CARFAX_FIXTURE_DE,
  CARFAX_FIXTURE_IT,
  CARFAX_FIXTURE_SE,
  CARFAX_FIXTURE_US,
} from "@/lib/carfax-report-parse.fixtures";
import {
  applyCarfaxReportToBlock,
  carfaxPdfFactTexts,
  carfaxReportToPlainText,
  carfaxReportToVendorRows,
  carfaxTimelineDescription,
  normalizeCarfaxReport,
} from "@/lib/carfax-report";
import { mileageSourceLabelToPdfKey } from "@/lib/pdf-mileage-source";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { synthesizeOwnerCountsFromBlocks } from "@/lib/owner-count-synthesis";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { sourceBlockPlainTextExcludingComments } from "@/lib/admin-source-comment-blocks";
import { orderHasSourceDataForAi } from "@/lib/admin-ai-data-availability";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";
import { sanitizeAttachmentFileNameForReport } from "@/lib/report-pdf-standards";

const NOW = new Date("2026-11-25T08:00:00.000Z");

function parse(text: string) {
  const r = parseCarfaxReportText(normalizePdfExtractedText(text), { now: NOW });
  if (!r) throw new Error("parse failed");
  return r;
}

function blocksWithCarfax(text: string): WorkspaceSourceBlocks {
  const blocks = createDefaultSourceBlocks();
  const applied = applyCarfaxReportToBlock(blocks.carfax, normalizePdfExtractedText(text), { now: NOW });
  if (!applied) throw new Error("apply failed");
  return { ...blocks, carfax: applied.block };
}

describe("carfax palīgi", () => {
  it("datumi un skaitļi LV formātā", () => {
    expect(carfaxDateToLv("2026-05-27")).toBe("27.05.2026");
    expect(carfaxDateToLv("09.11.2026")).toBe("09.11.2026");
    expect(carfaxDateToLv("12/2010")).toBe("12.2010");
    expect(carfaxDateToLv("08.2026")).toBe("08.2026");
    expect(carfaxDateToLv("2017")).toBe("2017");
    expect(carfaxNumberLv("1,995 kg")).toBe("1 995 kg");
    expect(carfaxNumberLv("4.233 mm")).toBe("4 233 mm");
    expect(carfaxNumberLv("5.1 l/100km")).toBe("5,1 l/100km");
    expect(carfaxNumberLv("e1*2007/46*0436*29")).toBe("e1*2007/46*0436*29");
  });

  it("izmet pārlūka drukas galvenes un kājenes", () => {
    const lines = carfaxTextLines(CARFAX_FIXTURE_DE);
    expect(lines.some((l) => l.includes("carfax.eu/vhr"))).toBe(false);
    expect(lines.some((l) => /^11\/9\/26/.test(l))).toBe(false);
  });

  it("atpazīst tikai CARFAX atskaiti", () => {
    expect(looksLikeCarfaxReport(CARFAX_FIXTURE_SE)).toBe(true);
    expect(looksLikeCarfaxReport("AutoDNA atskaite VIN WBA0000")).toBe(false);
    expect(parseCarfaxReportText("CarVertical report")).toBeNull();
  });
});

describe("parseCarfaxReportText - Zviedrija", () => {
  const r = parse(CARFAX_FIXTURE_SE);

  it("galvene", () => {
    expect(r.vin).toBe("WAUZZZ4G0JN000001");
    expect(r.vehicleTitle).toBe("2018 AUDI A6");
    expect(r.modelYear).toBe("2018");
    expect(r.reportCreatedAt).toBe("20.11.2026 10:15");
    expect(r.vehicle).toEqual(
      expect.arrayContaining([
        { label: "Krāsa", value: "melna" },
        { label: "Virsbūve", value: "universālis" },
        { label: "Kopējā jauda", value: "140 kW / 190 hp" },
        { label: "Ātrumkārba", value: "automātiskā" },
      ]),
    );
  });

  it("ātrā pārbaude - visi 6 punkti kārtībā", () => {
    expect(r.quickChecks.map((q) => q.title)).toEqual(["Mileage", "Stolen", "Identity check", "Import", "Taxi", "Recalls"]);
    expect(r.quickChecks.every((q) => q.status === "ok")).toBe(true);
    expect(r.quickChecks.find((q) => q.title === "Stolen")?.textLv).toBe("Nav ziņots par zādzību");
  });

  it("bojājumi, nobraukuma pārbaude, apkopes, tehniskie dati", () => {
    expect(r.noDamageReported).toBe(true);
    expect(r.damages).toEqual([]);
    expect(r.mileageCheck).toMatchObject({
      status: "ok",
      lastReadingKm: "210500",
      lastReadingDate: "10.05.2026",
      projectionKm: "216000",
      projectionSimilarKm: "180000",
    });
    expect(r.maintenance.vehicleAge).toBe("9 g. 4 mēn.");
    expect(r.technical).toEqual(
      expect.arrayContaining([
        { label: "Degviela", value: "dīzelis" },
        { label: "Pašmasa", value: "1 995 kg" },
        { label: "Degvielas patēriņš (jauktais cikls)", value: "5,1 l/100km" },
        { label: "EK kategorija", value: "M1" },
      ]),
    );
  });

  it("vēsture: km salīp ar notikumu, vairāki notikumi vienā datumā, detaļas", () => {
    const withKm = r.history.filter((e) => e.odometerKm);
    expect(withKm.map((e) => [e.date, e.odometerKm])).toEqual([
      ["01.04.2020", "90100"],
      ["04.01.2023", "150200"],
      ["10.05.2026", "210500"],
    ]);
    expect(r.history[0]).toMatchObject({ date: "2017", kind: "manufactured" });
    const reg = r.history.filter((e) => e.date === "12.07.2017");
    expect(reg.map((e) => e.kind)).toEqual(["registered", "owner"]);
    expect(reg[1]!.country).toBe("Zviedrija");
    expect(reg[1]!.details).toEqual(["īpašnieka tips: dīleris"]);
    const last = r.history.find((e) => e.date === "10.05.2026")!;
    expect(last.details).toEqual(["kārtējā", "derīga līdz 31.07.2027"]);
    expect(r.history.some((e) => e.kind === "leasing")).toBe(true);
    expect(r.history.at(-1)).toMatchObject({ date: "24.10.2026", kind: "insured" });
  });
});

describe("parseCarfaxReportText - DE lokāle, bojājums, komplektācija", () => {
  const r = parse(CARFAX_FIXTURE_DE);

  it("bojājums ar EUR diapazonu (punkts kā tūkstošu atdalītājs)", () => {
    expect(r.quickChecks.find((q) => q.title === "Damage")).toMatchObject({ status: "attention", textLv: "Ziņots par bojājumu" });
    expect(r.damages).toEqual([
      { date: "08.2026", country: "Vācija", cause: "", areas: [], components: [], repairCost: "3 000 - 4 000 €", severity: "" },
    ]);
    expect(r.reportCreatedAt).toBe("09.11.2026 20:31");
  });

  it("komplektācija bez Highlights dublikāta un bez markas rindas; cena LV formātā", () => {
    expect(r.equipment).toEqual([
      "engine 1,9 liter - 77 kW TDI",
      "Type of drive: front-wheel drive",
      "metallic paintwork",
      "Winter package; seat heating front; windshield washer jets heated",
    ]);
    expect(r.originalPrice).toEqual({ base: "27 850 €", options: "2 003 €", total: "29 853 €" });
    expect(r.technical).toEqual(
      expect.arrayContaining([
        { label: "CO2 izmeši (jauktais cikls)", value: "165 g/km" },
        { label: "Garums", value: "4 233 mm" },
      ]),
    );
  });

  it("vēsture pāri lapas kājenei", () => {
    expect(r.history.map((e) => [e.date, e.kind])).toEqual([
      ["09.2007", "registered"],
      ["08.2026", "damage"],
    ]);
  });
});

describe("parseCarfaxReportText - ASV / imports", () => {
  const r = parse(CARFAX_FIXTURE_US);

  it("jūdzes + km: ņem km, glabā jūdzes", () => {
    const odo = r.history.filter((e) => e.kind === "odometer");
    expect(odo.map((e) => [e.date, e.odometerKm, e.odometerMiles])).toEqual([
      ["22.08.1995", "882", "548"],
      ["30.08.2019", "165245", "102679"],
      ["10.05.2022", "337322", "209603"],
    ]);
  });

  it("salvage, apdrošināšana, imports; paskaidrojošais teksts nav notikums", () => {
    const kinds = r.history.map((e) => e.kind);
    expect(kinds).toEqual(["odometer", "odometer", "damage", "insurance_claim", "salvage", "odometer", "import"]);
    const imp = r.history.at(-1)!;
    expect(imp).toMatchObject({ date: "06.2022", country: "Igaunija", eventLv: "Importēts no ASV uz Igaunija" });
    expect(r.damages[0]).toMatchObject({ date: "02.05.2022", country: "ASV", cause: "sadursme" });
  });
});

describe("parseCarfaxReportText - Itālija: īpašnieki, zonas, smagums", () => {
  const r = parse(CARFAX_FIXTURE_IT);

  it("Owners BETA", () => {
    expect(r.owners).toEqual([
      { index: 1, country: "Itālija", purchaseYear: "2011", lengthOfUse: "4 g. 10 mēn.", ownerType: "" },
      { index: 2, country: "Itālija", purchaseYear: "2016", lengthOfUse: "mazāk par mēnesi", ownerType: "uzņēmums" },
      { index: 3, country: "Itālija", purchaseYear: "2016", lengthOfUse: "", ownerType: "privātpersona" },
    ]);
  });

  it("bojājumi ar zonām, komponentēm, smagumu un izmaksu diapazonu", () => {
    expect(r.damages).toEqual([
      {
        date: "05.2024",
        country: "Itālija",
        cause: "",
        areas: ["Priekša"],
        components: ["External Lighting"],
        repairCost: "250 - 500 €",
        severity: "vidējs",
      },
      {
        date: "12.2024",
        country: "Itālija",
        cause: "pilnīga bojāeja (total loss)",
        areas: ["Kreisā puse", "Priekša kreisā"],
        components: [],
        repairCost: "līdz 250 €",
        severity: "vidējs līdz smags",
      },
    ]);
  });

  it("ātrā pārbaude: total loss, nav datu, ACI", () => {
    expect(r.quickChecks.map((q) => [q.title, q.status])).toEqual([
      ["Damage", "attention"],
      ["Import", "unavailable"],
      ["Vincoli", "unavailable"],
    ]);
  });

  it("vēsture: spilveni, total loss, sludinājums ar km, apskate izturēta", () => {
    expect(r.history.map((e) => e.kind)).toEqual(["registered", "owner", "inspection", "damage", "airbag", "total_loss", "listing"]);
    expect(r.history.find((e) => e.kind === "inspection")!.details).toEqual(["izturēta"]);
    expect(r.history.find((e) => e.kind === "listing")).toMatchObject({ date: "12.2024", odometerKm: "2845" });
  });
});

describe("carfaxReportToVendorRows / bloks", () => {
  it("nobraukums, negadījumi, laikposms, bojājumu detaļas", () => {
    const rows = carfaxReportToVendorRows(parse(CARFAX_FIXTURE_IT));
    expect(rows.serviceHistory.map((r) => [r.date, r.odometer])).toEqual([
      ["01.12.2024", "2845"],
      ["04.09.2017", "194280"],
    ]);
    expect(rows.incidents).toEqual([
      { csngDate: "05.2024", lossAmount: "Dati nav pieejami", incidentNo: "Itālija" },
      { csngDate: "12.2024", lossAmount: "Dati nav pieejami", incidentNo: "Itālija" },
    ]);
    expect(rows.damageDetails[0]).toEqual({
      date: "05.2024",
      country: "Itālija",
      lossAmount: "",
      damagedSides: "Priekša",
      damageGroups: "Komponentes: External Lighting; Smagums: vidējs",
    });
    const listing = rows.vehicleHistoryTimeline.find((t) => t.description.startsWith("Piedāvāts pārdošanai"))!;
    expect(listing.includeInPdf).toBe(false);
    expect(rows.vehicleHistoryTimeline.find((t) => t.description === "Reģistrēts")).toMatchObject({
      country: "Itālija",
      includeInPdf: true,
    });
  });

  it("dīleris nav īpašnieks; citi - ar tipu", () => {
    const r = parse(CARFAX_FIXTURE_SE);
    const owners = r.history.filter((e) => e.kind === "owner").map(carfaxTimelineDescription);
    expect(owners).toEqual(["Dīleris kā īpašnieks", "Ziņots jaunais īpašnieks (uzņēmums)", "Ziņots jaunais īpašnieks (privātpersona)"]);
  });

  it("bez bojājumu pārskata - negadījums no vēstures ar «Dati nav pieejami»", () => {
    const r = parse(CARFAX_FIXTURE_SE);
    const rows = carfaxReportToVendorRows({
      ...r,
      history: [...r.history, { date: "03.2025", odometerKm: "", event: "Damage reported in Sweden", eventLv: "Ziņots par bojājumu", country: "Zviedrija", details: [], kind: "damage" }],
    });
    expect(rows.incidents).toEqual([{ csngDate: "03.2025", lossAmount: "Dati nav pieejami", incidentNo: "Zviedrija" }]);
  });

  it("ielase blokā: operatora rindas paliek, dublikāti netiek pievienoti", () => {
    const base = createDefaultSourceBlocks().carfax;
    const prev = {
      ...base,
      serviceHistory: [{ date: "01.01.2015", odometer: "50000", country: "Itālija" }],
      comments: "Operatora komentārs",
    };
    const first = applyCarfaxReportToBlock(prev, CARFAX_FIXTURE_IT, { now: NOW })!;
    expect(first.block.comments).toBe("Operatora komentārs");
    expect(first.block.serviceHistory.map((r) => r.odometer)).toEqual(expect.arrayContaining(["50000", "194280", "2845"]));
    expect(first.summary).toContain("CARFAX WBAUT31000F000004");
    const again = applyCarfaxReportToBlock(first.block, CARFAX_FIXTURE_IT, { now: NOW })!;
    expect(again.block.serviceHistory.length).toBe(first.block.serviceHistory.length);
    expect(again.block.incidents.length).toBe(first.block.incidents.length);
    expect(again.block.vehicleHistoryTimeline!.length).toBe(first.block.vehicleHistoryTimeline!.length);
  });

  it("ne-CARFAX teksts → null", () => {
    expect(applyCarfaxReportToBlock(createDefaultSourceBlocks().carfax, "Some other PDF")).toBeNull();
  });
});

describe("CARFAX darbvirsmas integrācija", () => {
  it("atslēga, nosaukums, PDF redzamība", () => {
    expect(SOURCE_BLOCK_KEYS).toContain("carfax");
    expect(SOURCE_BLOCK_LABELS.carfax).toBe("CARFAX");
    expect(mergePdfVisibility({}).carfax).toBe(true);
    expect(mergePdfVisibility({ carfax: false }).carfax).toBe(false);
  });

  it("report saglabājas melnraksta JSON roundtrip; bojāts report neizraisa kļūdu", () => {
    const blocks = blocksWithCarfax(CARFAX_FIXTURE_SE);
    const restored = mergeSourceBlocksWithDefaults(JSON.parse(JSON.stringify(blocks)));
    expect(restored.carfax.report?.vin).toBe("WAUZZZ4G0JN000001");
    expect(restored.carfax.report?.history.length).toBe(blocks.carfax.report?.history.length);
    expect(mergeSourceBlocksWithDefaults({ carfax: { report: "x", serviceHistory: [] } }).carfax.report).toBeUndefined();
    expect(normalizeCarfaxReport({ vin: 5, history: [null, { date: "2020" }] })?.history).toHaveLength(1);
  });

  it("klienta PDF bloks: nobraukums vienotajā vēsturē ar avotu CARFAX, negadījumi, faktu karte", () => {
    const blocks = blocksWithCarfax(CARFAX_FIXTURE_IT);
    const vendor = toPdfManualVendorBlocks(blocks).find((b) => b.title === "CARFAX")!;
    expect(vendor).toBeTruthy();
    expect(vendor.ownersSummary).toContain("Īpašnieku skaits: 3 (Itālija)");
    expect(vendor.statusRecords).toContain("Bojājumi: Ziņots par pilnīgu bojāeju (total loss)");
    expect(vendor.autoNotes).toContain("Drošības spilveni nostrādājuši: 05.2024 Itālija");
    const mileage = collectUnifiedMileageRows({ manualVendorBlocks: [vendor] });
    expect(mileage.some((r) => r.sourceLabel === "CARFAX" && r.odometer.replace(/\D/g, "") === "194280")).toBe(true);
    expect(mileageSourceLabelToPdfKey("CARFAX")).toBe("carfax");
    const incidents = collectUnifiedIncidentRows({ manualVendorBlocks: [vendor] });
    expect(incidents.filter((r) => r.sourceLabel === "CARFAX")).toHaveLength(2);
  });

  it("īpašnieku skaits no CARFAX Owners", () => {
    const blocks = blocksWithCarfax(CARFAX_FIXTURE_IT);
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.candidates.some((c) => c.source === "CARFAX" && c.count === 3)).toBe(true);
  });

  it("AI konteksts: avota komentāram un kopējam kontekstam visi lauki", () => {
    const blocks = blocksWithCarfax(CARFAX_FIXTURE_IT);
    const forComment = sourceBlockPlainTextExcludingComments("carfax", blocks);
    expect(forComment).toContain("ĀTRĀ PĀRBAUDE");
    expect(forComment).toContain("zonas Kreisā puse, Priekša kreisā");
    expect(forComment).toContain("ĪPAŠNIEKI (CARFAX BETA)");
    expect(mergeVendorBlocksPlain(blocks)).toContain("【CARFAX】");
    expect(orderHasSourceDataForAi(blocks)).toBe(true);
    expect(carfaxReportToPlainText(blocks.carfax.report)).toContain("VĒSTURE (CARFAX)");
    // Nila likums: remontu EUR summas ne klienta PDF, ne AI komentāra kontekstā.
    for (const t of [forComment, mergeVendorBlocksPlain(blocks), carfaxReportToPlainText(blocks.carfax.report)]) {
      expect(t).not.toMatch(/250 - 500|līdz 250|remonta aplēse/);
    }
    // Admin datos aplēse paliek.
    expect(blocks.carfax.report?.damages[0]?.repairCost).toBe("250 - 500 €");
  });

  it("faktu teksti bez report - tukši", () => {
    expect(carfaxPdfFactTexts(undefined)).toEqual({ ownersSummary: "", statusRecords: "", autoNotes: "" });
  });

  it("CARFAX nosaukums netiek rādīts pielikuma faila nosaukumā klienta PDF sarakstā", () => {
    expect(sanitizeAttachmentFileNameForReport("CARFAX - WBAUT31000F000004.pdf")).toBe("vēstures atskaite - WBAUT31000F000004.pdf");
  });
});
