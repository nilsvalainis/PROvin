import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";
import {
  buildPreviousInspectionBlockHtml,
  formatInspectionOdometer,
  formatSmokeCoefficient,
} from "@/lib/csdd-inspection-history-html";
import { translateDealerVehicleValue } from "@/lib/dealer-vehicle-value-i18n";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import { formatLtabCentsAsEur, formatLtabCertificateAmountEur } from "@/lib/ltab-report-extract";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import { translateTextLv } from "@/lib/vin-sources/translate-lv";

/** PRO audits 06.11 (GLE TESTS PDF): atlikušās formāta kļūdas. */
describe("summas ar centiem - decimālkomats", () => {
  it("LTAB zaudējumu summas un kopsumma ar komatu", () => {
    expect(formatLtabCertificateAmountEur("0.00")).toBe("0,00 €");
    expect(formatLtabCertificateAmountEur("2778.22")).toBe("2 778,22 €");
    expect(formatLtabCertificateAmountEur("2 778,22 €")).toBe("2 778,22 €");
    expect(formatLtabCentsAsEur(437722)).toBe("4 377,22 €");
  });

  it("vecie saglabātie punkta formāti drukājot kļūst par komatu", () => {
    expect(normalizeLossAmountEurDisplay("2 930.00 €")).toBe("2 930,00 €");
    expect(normalizeLossAmountEurDisplay("1500 EUR")).toBe("1 500 €");
  });
});

describe("CSDD apskates rinda", () => {
  it("grupē nobraukumu un dūmainību raksta ar komatu", () => {
    expect(formatInspectionOdometer("145254")).toBe("145 254");
    expect(formatInspectionOdometer("145 254")).toBe("145 254");
    expect(formatSmokeCoefficient("0.35")).toBe("0,35");
    expect(formatSmokeCoefficient("0,35")).toBe("0,35");

    const html = buildPreviousInspectionBlockHtml(
      {
        inspectionType: "Periodiskā apskate",
        inspectionDateText: "12.05.2025",
        odometer: "145254",
        nextInspectionDateText: "",
        ratingLabel: "0",
        smokeCoefficient: "0.35",
        defects: [],
      } as unknown as Parameters<typeof buildPreviousInspectionBlockHtml>[0],
      "12.05.2025",
    );
    expect(html).toContain("145 254 km");
    expect(html).not.toContain("145254");
  });
});

describe("dīlera dati - jauda", () => {
  it("„180 KW” kļūst par „180 kW”, krieviski „кВт”", () => {
    expect(translateDealerVehicleValue("power", "180 KW", "lv")).toBe("180 kW");
    expect(translateDealerVehicleValue("power", "180 kw / 245 PS", "lv")).toBe("180 kW / 245 ZS");
    expect(translateDealerVehicleValue("power", "180 KW", "ru")).toBe("180 кВт");
  });
});

describe("Igaunijas reģistra teksti", () => {
  it("tulko norakstīšanu un reģ. apliecības maiņu", () => {
    expect(translateTextLv("Majanduslikus mõttes hävinenud", "et")).toBe(
      "ekonomiski neizdevīgi remontēt (norakstīts)",
    );
    expect(translateTextLv("Reg.tunnistuse vahetus", "et")).toBe("reģistrācijas apliecības maiņa");
  });

  it("laika joslā vecie netulkotie EE notikumi parādās latviski", () => {
    const blocks = createDefaultSourceBlocks();
    const events = buildVehicleLifecycleEvents({
      csddForm: blocks.csdd,
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.mnt_ee,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "14.03.2019", country: "Igaunija", odometer: "", description: "Majanduslikus mõttes hävinenud" },
            { date: "02.04.2020", country: "Igaunija", odometer: "", description: "Reg.tunnistuse vahetus" },
          ],
        },
      ],
    } as unknown as Parameters<typeof buildVehicleLifecycleEvents>[0]);
    const text = JSON.stringify(events);
    expect(text).not.toMatch(/hävinenud|tunnistuse/i);
    expect(text).toContain("Ekonomiski neizdevīgi remontēt (norakstīts)");
    expect(text).toContain("Reģistrācijas apliecības maiņa");
  });
});

describe("faktu pārbaude - īpašnieku maiņas nav īpašnieku skaits", () => {
  function facts() {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...blocks.csdd,
      makeModel: "Mercedes-Benz GLE",
      firstRegistration: "01.03.2016",
      previousRegistrationCountry: "Vācija",
      ownerCountLatvia: "4",
      mileageHistory: [{ date: "01.08.2019", odometer: "120000", country: "Latvija" }],
    };
    return buildCanonicalFacts({ sourceBlocks: blocks, notes: "" });
  }

  it("„3 īpašnieku maiņas” pie 4 īpašniekiem nav kļūda", () => {
    const f = facts();
    expect(f.owners.totalCount).toBe(4);
    const flags = checkCommentContradictions({
      text: "Latvijā reģistrēti 4 īpašnieki, tātad 3 īpašnieku maiņas.",
      field: "source",
      facts: f,
    });
    expect(flags.filter((x) => x.kind === "owner_count")).toEqual([]);
    expect(flags.filter((x) => x.kind === "owner_changes")).toEqual([]);
  });

  it("nepareizs īpašnieku skaits joprojām tiek atrasts", () => {
    const flags = checkCommentContradictions({
      text: "Auto bijuši 3 īpašnieki.",
      field: "source",
      facts: facts(),
    });
    expect(flags.some((x) => x.kind === "owner_count")).toBe(true);
  });
});
