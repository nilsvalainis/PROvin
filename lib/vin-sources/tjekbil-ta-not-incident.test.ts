/**
 * 21.11 (dīlera datu / PRO pasūtījums, VW Passat 2.0 TDI 176 kW universālis, DK → LV):
 * 1) neizturēta Dānijas TA (22.01.2025, bremžu diski) nonāca negadījumos - jābūt TA notikumam laika joslā;
 * 2) „Toldsyn export” 15.09.2026 (pēc „Afmeldt” 28.08.2026) bija „Muitas apskate (imports)” - jābūt eksportam;
 * 3) DMR 1 dzenošā ass - AI nedrīkst rakstīt 4Motion / AWD, ja pilnpiedziņa ir tikai sludinājumā / car.info.
 * Fiksācija: reāla tjekbil.dk atbilde bez personas datiem (scripts/vin-scan-refresh-fixtures.mjs `scrub`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeSourceBlocksWithDefaults,
  repairVinRegistryBlock,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
} from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions, extractCanonicalFactsFromPrompt } from "@/lib/comment-contradiction-check";
import { computeReportIncidentCount } from "@/lib/damage-evidence";
import { extractRegistryDrivetrain, findDrivetrainContradictions } from "@/lib/registry-drivetrain";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import {
  firstRegistrationIsDanish,
  mapTjekbilPayload,
  type TjekbilDmrResponse,
  type TjekbilInspection,
  type TjekbilMileageLog,
} from "@/lib/vin-sources/tjekbil-map";
import { vinSourceResultToBlock } from "@/lib/vin-sources/to-block";

const VIN = "WVWZZZ3CZFE516690";
const FIX = path.join(process.cwd(), "lib/vin-scan/__fixtures__/tjekbil");
const load = (name: string) => JSON.parse(readFileSync(path.join(FIX, `${name}.json`), "utf8")).body;
const dmr = load(VIN) as TjekbilDmrResponse;
const mileagelogs = load(`${VIN}.mileagelogs`) as TjekbilMileageLog[];
const mapped = mapTjekbilPayload({ dmr, mileagelogs });

function tjekbilBlocks() {
  const blocks = mergeSourceBlocksWithDefaults({});
  blocks.tjekbil = vinSourceResultToBlock({
    source: "tjekbil",
    vin: VIN,
    found: true,
    message: mapped.message,
    mileage: mapped.mileage,
    incidents: mapped.incidents,
    timeline: mapped.timeline,
    ownersSummary: mapped.ownersSummary,
    statusRecords: mapped.statusRecords,
    notes: mapped.notes,
    raw: JSON.stringify({ dmr, mileagelogs }),
    fetchedAt: "2026-11-21T15:10:44.000Z",
  });
  return blocks;
}

describe("tjekbil.dk: neizturēta TA ir tehniskā apskate, ne negadījums", () => {
  it("negadījumu nav; 22.01.2025 laika joslā kā neizturēta TA ar latvisku trūkumu", () => {
    expect(mapped.incidents).toEqual([]);
    expect(mapped.timeline.find((r) => r.date === "2025-01-22")).toEqual({
      date: "2025-01-22",
      odometer: "244501",
      country: "Dānija",
      event:
        "Tehniskā apskate: Neizturēta (periodiskā apskate), jāveic atkārtota apskate · Dekra Bilsyn · " +
        "Trūkumi: Bremžu iekārta, stāvoklis un darbība: bremžu disks, bremžu virsma korozija - iekšpusē - abās pusēs - 1. ass - būtisks trūkums",
    });
    expect(mapped.timeline.find((r) => r.date === "2025-02-03")?.event).toBe("Periodiskā apskate: Izturēta · Dekra Bilsyn");
    expect(mapped.notes).toContain("Neizturētas apskates: 1.");
  });

  it("PDF: negadījumu skaits 0, laika joslā TA kartīte ar brīdinājuma toni", () => {
    const manualVendorBlocks = toPdfManualVendorBlocks(tjekbilBlocks());
    expect(computeReportIncidentCount({ manualVendorBlocks }).count).toBe(0);
    const events = buildVehicleLifecycleEvents({ manualVendorBlocks });
    expect(events.some((e) => e.kind === "incident")).toBe(false);
    const ta = events.find((e) => e.date === "22.01.2025" && e.kind === "inspection");
    expect(ta).toMatchObject({ title: "Tehniskā apskate", tone: "warn" });
    expect(`${ta?.detail} ${ta?.body ?? ""}`).toMatch(/^Neizturēta .*Trūkumi: Bremžu iekārta/);
  });

  it("vecais saglabātais bloks (TA negadījumos) pēc ielādes pārnests uz laika joslu", () => {
    const legacy = repairVinRegistryBlock({
      ...tjekbilBlocks().tjekbil,
      incidents: [
        {
          date: "2025-01-22",
          amount: "",
          country: "Dānija",
          note: 'Apskate nav izturēta, jāveic atkārtota apskate - da: "Bremseudstyr, tilstand og virkemåde: Bremseskive"',
        },
      ],
      timeline: [
        {
          date: "2025-01-22",
          odometer: "244501",
          country: "Dānija",
          event: "Periodiskā apskate: Nav izturēta, jāveic atkārtota apskate · Dekra Bilsyn",
        },
      ],
    });
    expect(legacy.incidents.every((r) => !r.note.trim())).toBe(true);
    expect(legacy.timeline[0]?.event).toBe(
      'Periodiskā apskate: Nav izturēta, jāveic atkārtota apskate · Dekra Bilsyn · Trūkumi: da: "Bremseudstyr, tilstand og virkemåde: Bremseskive"',
    );
    const blocks = mergeSourceBlocksWithDefaults({});
    // PDF ceļš lasa bloku bez `repair` - pārnešana arī tur.
    blocks.tjekbil = {
      ...blocks.tjekbil,
      incidents: [{ date: "2025-01-22", amount: "", country: "Dānija", note: "Apskate nav izturēta - Bremzes" }],
      timeline: [],
    };
    const manualVendorBlocks = toPdfManualVendorBlocks(blocks);
    const dk = manualVendorBlocks.find((b) => b.title === SOURCE_BLOCK_LABELS.tjekbil);
    expect(dk?.incidentRows ?? []).toEqual([]);
    expect(dk?.vehicleHistoryTimeline?.[0]?.description).toBe("Tehniskā apskate: nav izturēta · Trūkumi: Bremzes");
    expect(computeReportIncidentCount({ manualVendorBlocks }).count).toBe(0);
  });
});

describe("tjekbil.dk: Toldsyn export / Afmeldt ir eksports, ne imports", () => {
  it("15.09.2026 - eksporta apskate, nevis „imports”; 28.08.2026 - noņemts no uzskaites", () => {
    const day = mapped.timeline.filter((r) => r.date === "2026-09-15").map((r) => r.event);
    expect(day).toEqual([
      "Reģistrācijas apskate eksportam: Izturēta · Hørning Bilsyn v/Amin Dabbas",
      "Eksporta apskate (muita, izvešana no Dānijas): Stāvoklis vidējs · Hørning Bilsyn v/Amin Dabbas",
    ]);
    expect(day.join(" ")).not.toMatch(/import/i);
    expect(mapped.timeline.find((r) => r.date === "2026-08-28" && /statuss/.test(r.event))?.event).toBe(
      "Reģistrācijas statuss: Noņemts no uzskaites",
    );
    // 2020. gada imports paliek imports.
    expect(mapped.timeline.find((r) => r.date === "2020-07-16" && /Muitas/.test(r.event))?.event).toBe(
      "Muitas apskate (imports): Stāvoklis vidējs · Jysk-Bilsyn ApS",
    );
    expect(mapped.mileage.find((r) => r.date === "2026-09-15")?.origin).toContain("eksporta muitas apskate");
  });

  it("eksporta reģistrācijas apskate nav jauns Dānijas īpašnieks: līzings + privātais = 2", () => {
    expect(mapped.ownersSummary).toBe("Īpašnieku skaits Dānijā: 2.");
  });

  it("PDF laika joslā 15.09.2026 nav importa notikuma", () => {
    const events = buildVehicleLifecycleEvents({ manualVendorBlocks: toPdfManualVendorBlocks(tjekbilBlocks()) });
    const sep = events.filter((e) => e.date === "15.09.2026");
    expect(sep.length).toBeGreaterThan(0);
    expect(sep.some((e) => e.kind === "import")).toBe(false);
    expect(sep.map((e) => `${e.title} ${e.detail} ${e.body ?? ""}`).join(" ")).not.toMatch(/import/i);
  });

  it("Dānijā pirmoreiz reģistrēts auto ar eksporta toldsyn paliek „pirmā reģistrācija Dānijā”", () => {
    const dkOnly: TjekbilDmrResponse = { basic: { foersteRegistreringDato: "2015-07-03T00:00:00+02:00" } };
    const exportOnly: TjekbilInspection[] = [
      { synsdato: "15-09-2026", kategori: "Toldsyn export", synstype: "Første syn", synsresultat: "Middel" },
      { synsdato: "15-09-2026", kategori: "Registreringssyn", synstype: "Første syn", synsresultat: "Godkendt" },
    ];
    expect(firstRegistrationIsDanish(dkOnly, exportOnly)).toBe(true);
    expect(firstRegistrationIsDanish(dkOnly, [{ ...exportOnly[0]!, kategori: "Toldsyn import" }])).toBe(false);
  });
});

describe("piedziņa: DMR 1 dzenošā ass pret 4Motion / AWD", () => {
  it("statusā un faktu lapā reģistra piedziņa ar prioritāti un pretrunas brīdinājumu", () => {
    expect(mapped.statusRecords).toContain("Dzenošās asis (DMR): 1 (viena ass, nav pilnpiedziņa)");
    const blocks = tjekbilBlocks();
    expect(extractRegistryDrivetrain(blocks)).toEqual({
      drivenAxles: 1,
      awd: false,
      sourceLabel: SOURCE_BLOCK_LABELS.tjekbil,
    });
    blocks.carinfo = { ...blocks.carinfo, statusRecords: "Piedziņa: AWD (4Motion)" };
    const facts = buildCanonicalFacts({ sourceBlocks: blocks, vin: VIN });
    expect(facts.sheet).toMatch(/Piedziņa \(oficiālais reģistrs .*\): 1 dzenošā ass - NAV pilnpiedziņa/);
    expect(facts.sheet).toContain("PRETRUNA: sludinājums / citi avoti min pilnpiedziņu");
    // No prompta nolasītā lapa saglabā piedziņu (pārbaude bez avotu blokiem).
    expect(extractCanonicalFactsFromPrompt(facts.sheet)?.drivetrain).toEqual({
      drivenAxles: 1,
      awd: false,
      sourceLabel: SOURCE_BLOCK_LABELS.tjekbil,
    });
  });

  it("vecais bloks bez statusa rindas: piedziņa no saglabātā RAW JSON", () => {
    const blocks = tjekbilBlocks();
    blocks.tjekbil = { ...blocks.tjekbil, statusRecords: "" };
    expect(extractRegistryDrivetrain(blocks)?.drivenAxles).toBe(1);
  });

  it("komentārs ar 4Motion / Haldex - kļūda; noliegums un pretrunas pieminēšana - nav", () => {
    const blocks = tjekbilBlocks();
    const facts = buildCanonicalFacts({ sourceBlocks: blocks, vin: VIN });
    const flags = checkCommentContradictions({
      text: "Auto ir 2.0 TDI ar DSG. 4Motion pilnpiedziņas Haldex sajūgam jāpārbauda eļļas maiņa.",
      field: "technical_risks",
      facts,
      sourceBlocks: blocks,
    });
    expect(flags.find((f) => f.id === "drivetrain_awd")).toMatchObject({ level: "E", sentence: expect.stringMatching(/4Motion/) });
    const dt = extractRegistryDrivetrain(blocks);
    expect(findDrivetrainContradictions("Reģistrā auto nav pilnpiedziņa (1 dzenošā ass).", dt)).toEqual([]);
    expect(findDrivetrainContradictions("Sludinājumā minētais 4Motion neatbilst reģistram.", dt)).toEqual([]);
  });
});
