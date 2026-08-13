import { describe, expect, it } from "vitest";

import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { extractAutodnaReport } from "@/lib/autodna-report-extract";
import { extractCarverticalReport } from "@/lib/carvertical-report-extract";
import { convertAmountTextToEur } from "@/lib/currency-eur-convert";
import { parseVendorPdfAgentPayload } from "@/lib/vendor-pdf-agent-payload";
import {
  buildVendorCopilotActions,
  mergeVendorReportExtracts,
  resolveExtractCountries,
} from "@/lib/vendor-pdf-agent-merge";
import { emptyVendorReportExtract } from "@/lib/vendor-report-extract";
import { formatVendorServiceHistoryText } from "@/lib/vendor-service-history";
import { collectWorkspaceCountryTimeline } from "@/lib/workspace-country-timeline";

const AUTODNA_TEXT = `Transportlīdzekļa vēsture
13.10.2025
Veikta tehniskā apskate
Odometra rādījums
254 941 km
Valsts Latvija
04.2020
Ziņots par odometra rādījumu
Odometra rādījums
169 751 km
06.2023
Transportlīdzekļa zaudējumu apjoms
Summa 510 000 - 520 000 CZK
Valsts Čehijas Republika
24.10.2019
Pārdošanai piedāvātas automašīnas
Odometra rādījums
159 383 km
Virsbūves krāsa Melns
Cena 29 380 EUR
Valsts Čehijas Republika
Datu interpretācijas noteikumi
`;

const AUTODNA_SERVICE_TEXT = `Transportlīdzekļa vēsture
12.2023
Transportlīdzekļu apkalpošana vai apskate
Odometra rādījums
47 521 km
Regulārā apkope
Salona gaisa filtra maiņa
Dzinēja gaisa filtra maiņa
Auto Vēstures Atskaite autoDNA TMBJJ7NX9NY019543
Pārbaudiet ziņojuma oriģinalitāti — noskenējiet galvenē redzamo QR kodu.
TMBJJ7NX9NY019543
Eļļas maiņa
Valsts Latvija
10.01.2026
Veikta tehniskā apskate
Odometra rādījums
91 038 km
Rezultāts Izgāja
Atrašanās vieta Rīga
Valsts Latvija
01.2022
Transportlīdzekļu apkalpošana vai apskate
Pirms piegādes sagatavošana
Valsts Latvija
Datu interpretācijas noteikumi
`;

const CARVERTICAL_TEXT = `Odometra rādījumu ieraksti
11.2019. 159 394 km
10.2025. 254 827 km
Bojājumu ieraksti
02.2019.Vācija
Novērtējums
Aptuvenā iepriekš gūto bojājumu vērtība
8501 € – 9000 €
Transportlīdzekļa specifikācija
Modelis
A6
Dzinēja kods
CVUA
Transmisijas tips
Automātiskā ātrumkārba
Krāsa
Melns
Laikposms
11.2019. Čehija
10.2025. Latvija
LY8X/Havana Black Metallic/Havana Black Metallic
N5DValcona leather
G1G8-speed automatic transmission for four-wheel drive
WAUZZZ4GXGN052397
`;

describe("currency → EUR", () => {
  it("konvertē CZK diapazonu un noapaļo", () => {
    expect(convertAmountTextToEur("510 000 - 520 000 CZK")?.display).toBe("20 400 - 20 800 €");
  });

  it("EUR summu atstāj precīzi kā atskaitē", () => {
    expect(convertAmountTextToEur("8501 € – 9000 €")?.display).toBe("8 501 - 9 000 €");
  });

  it("tekstu bez cipariem neizdomā", () => {
    expect(convertAmountTextToEur("nav datu")).toBeNull();
  });
});

describe("AutoDNA deterministiskā ekstrakcija", () => {
  const extract = extractAutodnaReport(AUTODNA_TEXT);

  it("izvelk nobraukumu ar datumu DD.MM.YYYY un valsti", () => {
    expect(extract.mileage).toEqual([
      { date: "13.10.2025", odometer: "254941", country: "Latvija" },
      { date: "01.04.2020", odometer: "169751", country: "" },
      { date: "24.10.2019", odometer: "159383", country: "Čehija" },
    ]);
  });

  it("negadījuma summu pārrēķina uz EUR", () => {
    expect(extract.incidents).toEqual([
      { csngDate: "01.06.2023", lossAmount: "20 400 - 20 800 €", incidentNo: "Čehija" },
    ]);
  });

  it("cenas ierakstu neuzskata par negadījumu", () => {
    expect(extract.incidents.some((r) => r.lossAmount.includes("29 380"))).toBe(false);
    expect(extract.notes.some((n) => n.includes("29 380 EUR"))).toBe(true);
  });
});

describe("AutoDNA apkopes → Servisa vēsture", () => {
  const extract = extractAutodnaReport(AUTODNA_SERVICE_TEXT);

  it("saglabā visus darbus, arī pāri lappuses pārrāvumam", () => {
    expect(extract.serviceHistory).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        country: "Latvija",
        category: "Regulārā apkope",
        location: "",
        works: [
          "Salona gaisa filtra maiņa",
          "Dzinēja gaisa filtra maiņa",
          "Eļļas maiņa",
        ],
      },
      {
        date: "01.01.2022",
        odometer: "",
        country: "Latvija",
        category: "",
        location: "",
        works: ["Pirms piegādes sagatavošana"],
      },
    ]);
  });

  it("neiekļauj tehniskās apskates", () => {
    expect(extract.serviceHistory.some((e) => e.date === "10.01.2026")).toBe(false);
  });

  it("formatē rindas laukam „Servisa vēsture”", () => {
    expect(formatVendorServiceHistoryText(extract.serviceHistory)).toBe(
      [
        "01.12.2023 | 47 521 km | Regulārā apkope: Salona gaisa filtra maiņa, Dzinēja gaisa filtra maiņa, Eļļas maiņa",
        "01.01.2022 | Pirms piegādes sagatavošana",
      ].join("\n"),
    );
  });

  it("aizpilda strukturēto servisa tabulu, nevis rezerves teksta lauku", () => {
    const actions = buildVendorCopilotActions(extract, "autodna");
    const first = applyCopilotActions(createDefaultSourceBlocks(), actions, { onlyAuto: false });
    const rows = first.sourceBlocks.auto_records.serviceWorks;
    expect(rows).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "",
        works:
          "Regulārā apkope: Salona gaisa filtra maiņa, Dzinēja gaisa filtra maiņa, Eļļas maiņa",
      },
      { date: "01.01.2022", odometer: "", location: "", works: "Pirms piegādes sagatavošana" },
    ]);
    expect(first.sourceBlocks.auto_records.serviceHistoryNotes).toBe("");
  });

  it("atkārtota augšupielāde nedublē rindas", () => {
    const actions = buildVendorCopilotActions(extract, "autodna");
    const first = applyCopilotActions(createDefaultSourceBlocks(), actions, { onlyAuto: false });
    const again = applyCopilotActions(first.sourceBlocks, actions, { onlyAuto: false });
    expect(again.sourceBlocks.auto_records.serviceWorks).toEqual(
      first.sourceBlocks.auto_records.serviceWorks,
    );
    expect(again.skipped.map((s) => s.reason)).toContain("service_work_row_exists");
  });

  it("Gemini „tehniskā apskate” kategoriju atmet, apkopi pieņem", () => {
    const payload = parseVendorPdfAgentPayload(
      JSON.stringify({
        vendor: "autodna",
        mileage: [],
        incidents: [],
        countryTimeline: [],
        serviceHistory: [
          { date: "10.01.2026", category: "Veikta tehniskā apskate", works: ["Rezultāts Izgāja"] },
          {
            date: "05.2025",
            odometer: "75 634 km",
            category: "Regulārā apkope",
            location: "Rīga",
            works: ["Eļļas maiņa"],
          },
        ],
      }),
      "autodna",
    );
    expect(payload.serviceHistory).toEqual([
      {
        date: "01.05.2025",
        odometer: "75634",
        country: "",
        category: "Regulārā apkope",
        location: "Rīga",
        works: ["Eļļas maiņa"],
      },
    ]);
  });

  it("dīlera atbildē servisa punkts nonāk vietas laukā, ne darbos", () => {
    const payload = parseVendorPdfAgentPayload(
      JSON.stringify({
        vendor: "dealer",
        mileage: [],
        incidents: [],
        countryTimeline: [],
        serviceHistory: [
          {
            date: "23.10.2014",
            odometer: "120 475 km",
            location: "Niederlassung Bonn BMW AG, Bonn",
            works: ["Set oil-filter element", "Vehicle check"],
          },
        ],
      }),
      "dealer",
    );
    expect(payload.serviceHistory).toEqual([
      {
        date: "23.10.2014",
        odometer: "120475",
        country: "",
        category: "",
        location: "Niederlassung Bonn BMW AG, Bonn",
        works: ["Eļļas filtra komplekts", "Tehniskā pārbaude servisā"],
      },
    ]);
  });
});

describe("CarVertical deterministiskā ekstrakcija", () => {
  const extract = extractCarverticalReport(CARVERTICAL_TEXT);

  it("izvelk odometra rindas bez valsts kolonnas", () => {
    expect(extract.mileage.map((r) => `${r.date}|${r.odometer}`)).toEqual([
      "01.10.2025|254827",
      "01.11.2019|159394",
    ]);
  });

  it("aizpilda valstis no „Laikposms” laika skalas", () => {
    const resolved = resolveExtractCountries(extract);
    expect(resolved.mileage).toEqual([
      { date: "01.10.2025", odometer: "254827", country: "Latvija" },
      { date: "01.11.2019", odometer: "159394", country: "Čehija" },
    ]);
  });

  it("dīlera laukos ņem garāko apzīmējumu ar kodu", () => {
    expect(extract.vehicleInfo.color).toBe("Havana Black Metallic (LY8X)");
    expect(extract.vehicleInfo.interior).toBe("Valcona leather (N5D)");
    expect(extract.vehicleInfo.engineCode).toBe("CVUA");
    expect(extract.vehicleInfo.vinCode).toBe("WAUZZZ4GXGN052397");
    expect(extract.vehicleInfo.transmission).toContain("G1G");
  });
});

describe("Gemini payload → extract", () => {
  it("pārrēķina summu no norādītās valūtas un normalizē datumus", () => {
    const extract = parseVendorPdfAgentPayload(
      JSON.stringify({
        vendor: "autodna",
        mileage: [{ date: "05.2021", odometer: "199 163 km", country: "Čehijas Republika" }],
        incidents: [{ date: "12.2022", amountRaw: "1 500 - 2 000", currency: "CZK", country: "" }],
        countryTimeline: [{ date: "10.2025", country: "Latvija" }],
        vehicleInfo: { color: "Havana Black Metallic (LY8X)", engineCode: "-" },
      }),
      "autodna",
    );
    expect(extract.mileage).toEqual([
      { date: "01.05.2021", odometer: "199163", country: "Čehija" },
    ]);
    expect(extract.incidents).toEqual([
      { csngDate: "01.12.2022", lossAmount: "60 - 80 €", incidentNo: "" },
    ]);
    expect(extract.countryTimeline).toEqual([{ date: "01.10.2025", country: "Latvija" }]);
    expect(extract.vehicleInfo).toEqual({ color: "Havana Black Metallic (LY8X)" });
  });

  it("nederīgu JSON neapstrādā klusi", () => {
    expect(() => parseVendorPdfAgentPayload("nav json", "carvertical")).toThrow("gemini_invalid_json");
  });
});

describe("merge + darbības", () => {
  it("Gemini rindas pievieno, bet deterministiskā summa vienam datumam paliek", () => {
    const local = emptyVendorReportExtract("autodna");
    local.mileage = [{ date: "13.10.2025", odometer: "254941", country: "Latvija" }];
    local.incidents = [{ csngDate: "01.06.2023", lossAmount: "20 400 - 20 800 €", incidentNo: "Čehija" }];

    const ai = emptyVendorReportExtract("autodna");
    ai.mileage = [
      { date: "13.10.2025", odometer: "254941", country: "" },
      { date: "07.10.2025", odometer: "254827", country: "Latvija" },
    ];
    ai.incidents = [{ csngDate: "01.06.2023", lossAmount: "20 000 €", incidentNo: "Čehija" }];

    const merged = mergeVendorReportExtracts(local, ai);
    expect(merged.mileage).toHaveLength(2);
    expect(merged.incidents).toEqual(local.incidents);
  });

  it("veido nobraukuma, negadījumu un dīlera darbības", () => {
    const extract = emptyVendorReportExtract("carvertical");
    extract.mileage = [{ date: "01.10.2025", odometer: "254827", country: "Latvija" }];
    extract.incidents = [{ csngDate: "01.02.2019", lossAmount: "8 501 - 9 000 €", incidentNo: "Vācija" }];
    extract.vehicleInfo = { color: "Havana Black Metallic (LY8X)" };

    const actions = buildVendorCopilotActions(extract, "carvertical");
    expect(actions.map((a) => a.type)).toEqual([
      "upsert_mileage",
      "upsert_incident",
      "set_dealer_vehicle_info",
    ]);
    expect(actions.every((a) => a.confidence === "high")).toBe(true);
  });
});

describe("dīlera lauku piemērošana", () => {
  it("aizpilda tukšo un pārraksta tikai ar precīzāku kodu", () => {
    const blocks = createDefaultSourceBlocks();
    const first = applyCopilotActions(
      blocks,
      [
        {
          type: "set_dealer_vehicle_info",
          source: "auto_records",
          vehicleInfo: { color: "BROWN", engineCode: "CVUA" },
          confidence: "high",
        },
      ],
      { onlyAuto: false },
    );
    expect(first.sourceBlocks.auto_records.outvinReport?.vehicleInfo.color).toBe("BROWN");

    const second = applyCopilotActions(
      first.sourceBlocks,
      [
        {
          type: "set_dealer_vehicle_info",
          source: "auto_records",
          vehicleInfo: { color: "Havana Black Metallic (LY8X)", engineCode: "CVUB" },
          confidence: "high",
        },
      ],
      { onlyAuto: false },
    );
    const info = second.sourceBlocks.auto_records.outvinReport?.vehicleInfo;
    expect(info?.color).toBe("Havana Black Metallic (LY8X)");
    expect(info?.engineCode).toBe("CVUA");
  });

  it("parsē Gemini `set_dealer_vehicle_info` darbību", () => {
    const parsed = parseCopilotGeminiPayload(
      JSON.stringify({
        reply: "ok",
        clarificationNeeded: "",
        actions: [
          {
            type: "set_dealer_vehicle_info",
            source: "auto_records",
            vehicleInfo: { interior: "Valcona leather (N5D)", color: "" },
            confidence: "high",
          },
        ],
      }),
    );
    expect(parsed.actions).toEqual([
      {
        type: "set_dealer_vehicle_info",
        source: "auto_records",
        vehicleInfo: { interior: "Valcona leather (N5D)" },
        confidence: "high",
      },
    ]);
  });
});

describe("valstu pierādījumi no jau aizpildītajiem avotiem", () => {
  it("savāc datumu + valsts pārus un aizpilda tukšo rindu", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.serviceHistory = [{ date: "13.10.2025", odometer: "254941", country: "Latvija" }];
    blocks.ltab.rows = [{ csngDate: "01.02.2019", lossAmount: "8 501 €", incidentNo: "Vācija" }];

    const timeline = collectWorkspaceCountryTimeline(blocks);
    expect(timeline).toEqual([
      { date: "13.10.2025", country: "Latvija" },
      { date: "01.02.2019", country: "Vācija" },
    ]);

    const extract = emptyVendorReportExtract("carvertical");
    extract.mileage = [{ date: "13.10.2025", odometer: "254941", country: "" }];
    const resolved = resolveExtractCountries(extract, timeline);
    expect(resolved.mileage[0]?.country).toBe("Latvija");
  });
});
