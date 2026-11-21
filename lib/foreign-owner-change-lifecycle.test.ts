import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyCsddFields,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { applyClientReportDynamicTranslations } from "@/lib/client-report-dynamic-i18n";
import { buildPdfLifecycleTimelineHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { buildVehicleLifecycleEvents, type LifecycleEvent } from "@/lib/vehicle-lifecycle-timeline";

/**
 * 21.11 (Nils): ārvalstu īpašnieku maiņas „Vēstures kopsavilkumā” kā CSDD „Īpašnieka maiņa” kartītes.
 * Latvija tikai CSDD; reģistrs dominē; AutoDNA/CarVertical tikai ar ķeksi „iekļaut PDF”; tikai-carVertical → kopkartīte.
 */

const L = SOURCE_BLOCK_LABELS;

type Row = { date: string; country: string; description: string; includeInPdf?: boolean; odometer?: string };

function vendorBlock(title: string, rows: Row[], extra: Partial<ClientManualVendorBlockPdf> = {}): ClientManualVendorBlockPdf {
  return {
    title,
    mileageRows: [],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: rows.map((r) => ({ includeInPdf: true, odometer: "", ...r })),
    ...extra,
  } as ClientManualVendorBlockPdf;
}

function csdd(patch: Partial<CsddFormFields>): CsddFormFields {
  return { ...emptyCsddFields(), ...patch };
}

function owners(events: LifecycleEvent[]): string[] {
  return events
    .filter((e) => e.kind === "owner_change")
    .map((e) => [e.date, e.title, e.detail, e.country, e.odometer, e.sources.join("+")].join(" | "));
}

const LV_CSDD = csdd({
  firstRegistration: "2016-12-16",
  firstRegistrationLatvia: "2026-05-28",
  previousRegistrationCountry: "SOMIJA",
  ownerRegistrationEvents: [
    { date: "28.05.2026", label: "Pirmā reģistrācija Latvijā" },
    { date: "15.08.2026", label: "Īpašnieka maiņa" },
  ],
});

describe("ārvalstu īpašnieku maiņas laikposmā", () => {
  it("Latvija tikai CSDD: carVertical/AutoDNA maiņas Latvijā un Latvijas periodā nerāda", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.carvertical, [
          { date: "01.06.2026", country: "Latvija", description: "Mainītas īpašumtiesības" },
          { date: "01.08.2026", country: "Somija", description: "Mainītas īpašumtiesības" },
        ]),
        vendorBlock(L.autodna, [{ date: "15.08.2026", country: "Latvija", description: "Ziņots jaunais īpašnieks" }]),
      ],
    });
    expect(owners(ev)).toEqual([]);
    expect(ev.filter((e) => e.title === "Īpašnieka maiņa" && e.sources.includes("CSDD")).map((e) => e.detail)).toEqual([
      "2. īpašnieks Latvijā",
    ]);
    expect(ev.some((e) => /Mainītas īpašumtiesības|Ziņots jaunais/.test(e.title))).toBe(false);
  });

  it("admin ķeksis: izslēgta AutoDNA/carVertical rinda kartīti nedod", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.autodna, [
          { date: "29.12.2021", country: "Nīderlande", description: "Ziņots jaunais īpašnieks", includeInPdf: false },
        ]),
      ],
    });
    expect(owners(ev)).toEqual([]);
  });

  it("dedup: AutoDNA diena un carVertical mēnesis vienā kartītē; reģistrācijas mēnesis nav maiņa", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.autodna, [
          { date: "16.12.2016", country: "Nīderlande", description: "Ziņots jaunais īpašnieks" },
          { date: "29.12.2021", country: "Nīderlande", description: "Ziņots jaunais īpašnieks" },
        ]),
        vendorBlock(L.carvertical, [
          { date: "01.12.2016", country: "Nīderlande", description: "Mainītas īpašumtiesības" },
          { date: "01.12.2021", country: "Nīderlande", description: "Mainītas īpašumtiesības" },
        ]),
      ],
    });
    expect(owners(ev)).toEqual(["29.12.2021 | Īpašnieka maiņa |  | Nīderlande |  | CarVertical+AutoDNA"]);
  });

  it("reģistrs dominē: valstij ar finnik datiem carVertical/AutoDNA neņem; numurs no saraksta", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: csdd({}),
      manualVendorBlocks: [
        vendorBlock(L.finnik, [
          { date: "18.05.2016", country: "Nīderlande", description: "Pirmā reģistrācija" },
          { date: "11.05.2016", country: "Nīderlande", description: "Īpašnieks" },
          { date: "03.02.2021", country: "Nīderlande", description: "Īpašnieks" },
          { date: "07.07.2026", country: "Nīderlande", description: "Īpašnieks" },
          { date: "27.07.2026", country: "Nīderlande", description: "Īpašnieks" },
        ]),
        vendorBlock(L.carvertical, [{ date: "01.09.2022", country: "Nīderlande", description: "Mainītas īpašumtiesības" }]),
      ],
    });
    expect(owners(ev)).toEqual([
      "03.02.2021 | Īpašnieka maiņa | 2. īpašnieks Nīderlandē | Nīderlande |  | NĪDERLANDES REĢISTRI",
      "07.07.2026 | Īpašnieka maiņa | 3. īpašnieks Nīderlandē | Nīderlande |  | NĪDERLANDES REĢISTRI",
      "27.07.2026 | Īpašnieka maiņa | 4. īpašnieks Nīderlandē | Nīderlande |  | NĪDERLANDES REĢISTRI",
    ]);
  });

  it("divi īpašnieki vienā dienā (finnik periodi) → „2. un 3. īpašnieks”", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: csdd({}),
      manualVendorBlocks: [
        vendorBlock(
          L.finnik,
          [
            { date: "18.05.2016", country: "Nīderlande", description: "Pirmā reģistrācija" },
            { date: "07.12.2020", country: "Nīderlande", description: "Īpašnieks" },
          ],
          {
            ownersSummary:
              "11.05.2016-18.05.2016 Līzinga uzņēmums\n07.12.2020-07.12.2020 Autosalons\n07.12.2020-03.02.2021 Juridiska persona\n03.02.2021-šobrīd Autosalons",
          },
        ),
      ],
    });
    expect(owners(ev).map((s) => s.split(" | ").slice(0, 3).join(" | "))).toEqual([
      "07.12.2020 | Īpašnieka maiņa | 2. un 3. īpašnieks Nīderlandē",
      "03.02.2021 | Īpašnieka maiņa | 4. īpašnieks Nīderlandē",
    ]);
  });

  it("tikai carVertical valstī: >1 maiņa → viena kopkartīte, 1 maiņa → parasta kartīte ar mēnesi", () => {
    const many = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.carvertical, [
          { date: "01.03.2022", country: "Somija", description: "Reģistrēts", includeInPdf: false },
          { date: "01.03.2022", country: "Somija", description: "Mainītas īpašumtiesības" },
          { date: "01.08.2022", country: "Somija", description: "Mainītas īpašumtiesības" },
          { date: "01.10.2022", country: "Somija", description: "Mainītas īpašumtiesības" },
          { date: "01.04.2023", country: "Somija", description: "Mainītas īpašumtiesības" },
        ]),
      ],
    });
    expect(owners(many)).toEqual([
      "08.2022 | 3 īpašnieku maiņas Somijā | 08.2022-04.2023 (carVertical) | Somija |  | CarVertical",
    ]);
    const one = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.carvertical, [{ date: "01.08.2022", country: "Somija", description: "Mainītas īpašumtiesības" }]),
      ],
    });
    expect(owners(one)).toEqual(["08.2022 | Īpašnieka maiņa |  | Somija |  | CarVertical"]);
  });

  it("AutoDNA apstiprinājums valstī → bez kopkartītes (atsevišķas kartītes)", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.carvertical, [
          { date: "01.08.2022", country: "Somija", description: "Mainītas īpašumtiesības" },
          { date: "01.10.2022", country: "Somija", description: "Mainītas īpašumtiesības" },
        ]),
        vendorBlock(L.autodna, [{ date: "12.10.2022", country: "Somija", description: "Ziņots jaunais īpašnieks" }]),
      ],
    });
    expect(owners(ev).map((s) => s.split(" | ")[0])).toEqual(["08.2022", "12.10.2022"]);
  });

  it("AutoDNA „Transportlīdzekļa pārreģistrācija” nav īpašnieka maiņa", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: LV_CSDD,
      manualVendorBlocks: [
        vendorBlock(L.autodna, [{ date: "02.11.2021", country: "Igaunija", description: "Transportlīdzekļa pārreģistrācija" }]),
      ],
    });
    expect(owners(ev)).toEqual([]);
  });

  it("km tikai no tās pašas dienas; personu vārdi nekad", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: csdd({ mileageHistory: [{ date: "20.03.2021", odometer: "123456" }] as CsddFormFields["mileageHistory"] }),
      manualVendorBlocks: [
        vendorBlock(L.finnik, [
          { date: "18.05.2016", country: "Nīderlande", description: "Pirmā reģistrācija" },
          { date: "03.03.2021", country: "Nīderlande", description: "Īpašnieks: Jānis Bērziņš" },
          { date: "27.07.2026", country: "Nīderlande", description: "Īpašnieks", odometer: "225620" },
        ]),
      ],
    });
    const list = owners(ev);
    expect(list.map((s) => s.split(" | ")[4])).toEqual(["", "225620"]);
    expect(JSON.stringify(ev)).not.toMatch(/Jānis|Bērziņš/);
  });

  it("mnt.ee „Võõrandamisest teatamine” → Īpašnieka maiņa Igaunijā (bez numura)", () => {
    const ev = buildVehicleLifecycleEvents({
      csddForm: csdd({ firstRegistrationLatvia: "2023-03-01", previousRegistrationCountry: "IGAUNIJA" }),
      manualVendorBlocks: [
        vendorBlock(L.mnt_ee, [{ date: "2023-01-11", country: "Igaunija", description: "Võõrandamisest teatamine" }]),
      ],
    });
    expect(owners(ev)).toEqual(["11.01.2023 | Īpašnieka maiņa |  | Igaunija |  | MNT.EE - Igaunijas reģistrs"]);
  });
});

describe("etaloni (21.11)", () => {
  const DIR = path.join(__dirname, "__fixtures__", "mileage-etalons");
  function lifecycleOf(vin: string, includeOwnerRows = false): LifecycleEvent[] {
    const fx = JSON.parse(readFileSync(path.join(DIR, `${vin}.json`), "utf8")) as {
      listingUrl: string | null;
      sourceBlocks: WorkspaceSourceBlocks;
    };
    if (includeOwnerRows) {
      for (const k of ["autodna", "carvertical"] as const) {
        for (const r of fx.sourceBlocks[k]?.vehicleHistoryTimeline ?? []) {
          if (/īpaš/i.test(r.description)) r.includeInPdf = true;
        }
      }
    }
    const b = mergeSourceBlocksWithDefaults(fx.sourceBlocks);
    return buildVehicleLifecycleEvents({
      csddForm: b.csdd,
      autoRecordsBlock: b.auto_records,
      oneautoBlock: b.oneauto,
      ccVinBlock: b.cc_vin,
      asvBlock: b.asv,
      manualVendorBlocks: toPdfManualVendorBlocks(b),
      citiAvoti: b.citi_avoti,
      tirgusForm: b.tirgus,
      listingUrl: fx.listingUrl,
    });
  }

  it("BMW 330e (finnik): 6 maiņas ar numuriem, 07.07.2026 vairs nepazūd", () => {
    expect(owners(lifecycleOf("WBA8E11090K416588")).map((s) => s.split(" | ").slice(0, 3).join(" | "))).toEqual([
      "07.12.2020 | Īpašnieka maiņa | 2. un 3. īpašnieks Nīderlandē",
      "03.02.2021 | Īpašnieka maiņa | 4. īpašnieks Nīderlandē",
      "16.01.2026 | Īpašnieka maiņa | 5. īpašnieks Nīderlandē",
      "25.02.2026 | Īpašnieka maiņa | 6. īpašnieks Nīderlandē",
      "07.07.2026 | Īpašnieka maiņa | 7. īpašnieks Nīderlandē",
      "27.07.2026 | Īpašnieka maiņa | 8. īpašnieks Nīderlandē",
    ]);
  });

  it("GLE (mnt.ee): viena maiņa Igaunijā; carVertical Latvijā nekad", () => {
    const ev = lifecycleOf("WDC1671191A002835", true);
    expect(owners(ev).map((s) => s.split(" | ").slice(0, 4).join(" | "))).toEqual([
      "11.01.2023 | Īpašnieka maiņa |  | Igaunija",
    ]);
    expect(ev.some((e) => e.title === "Mainītas īpašumtiesības")).toBe(false);
  });

  it("E350e: bez ķekša nekā; ar ķeksi NL 2 kartītes + Somijas kopkartīte", () => {
    expect(owners(lifecycleOf("WDD2130501A166423"))).toEqual([]);
    expect(owners(lifecycleOf("WDD2130501A166423", true)).map((s) => s.split(" | ").slice(0, 4).join(" | "))).toEqual([
      "29.12.2021 | Īpašnieka maiņa |  | Nīderlande",
      "06.01.2022 | Īpašnieka maiņa |  | Nīderlande",
      "08.2022 | 6 īpašnieku maiņas Somijā | 08.2022-04.2023 (carVertical) | Somija",
    ]);
  });
});

describe("PDF un i18n", () => {
  it("klienta PDF: tāda pati kartīte kā CSDD (bez maketa atzīmēm)", () => {
    const payload = {
      vin: "WBA8E11090K416588",
      csddForm: csdd({}),
      manualVendorBlocks: [
        vendorBlock(L.finnik, [
          { date: "18.05.2016", country: "Nīderlande", description: "Pirmā reģistrācija" },
          { date: "11.05.2016", country: "Nīderlande", description: "Īpašnieks" },
          { date: "03.02.2021", country: "Nīderlande", description: "Īpašnieks" },
        ]),
      ],
    } as unknown as ClientReportPayload;
    const html = buildPdfLifecycleTimelineHtml(payload);
    const card = html.match(/<li class="pdf-life-item[^"]*">(?:(?!<\/li>)[\s\S])*?Īpašnieka maiņa[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(card).toContain("2. īpašnieks Nīderlandē");
    expect(card).toContain("pdf-life-item--info");
    expect(card).not.toMatch(/JAUNS|data-life-kind|pdf-life-country--unverified/);
  });

  it("EN/DE/RU: numurs, valsts un kopkartīte", () => {
    const html = `<body><p>2. un 3. īpašnieks Nīderlandē</p><p>4. īpašnieks Somijā</p><p>6 īpašnieku maiņas Somijā</p></body>`;
    expect(applyClientReportDynamicTranslations(html, "en")).toBe(
      "<body><p>Owner no. 2 and 3 (Netherlands)</p><p>Owner no. 4 (Finland)</p><p>6 changes of ownership (Finland)</p></body>",
    );
    expect(applyClientReportDynamicTranslations(html, "de")).toBe(
      "<body><p>2. und 3. Halter (Niederlande)</p><p>4. Halter (Finnland)</p><p>6 Halterwechsel (Finnland)</p></body>",
    );
    expect(applyClientReportDynamicTranslations(html, "ru")).toBe(
      "<body><p>Владелец № 2 и 3 (Нидерланды)</p><p>Владелец № 4 (Финляндия)</p><p>Смен владельца: 6 (Финляндия)</p></body>",
    );
  });
});
