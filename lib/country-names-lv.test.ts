import { describe, expect, it } from "vitest";
import {
  countryLabelToIso2,
  iso2ToLvDisplayName,
  normalizeCountryNameLv,
} from "@/lib/country-names-lv";
import { ISO3_TO_ISO2 } from "@/lib/iso3166-alpha3";
import { parseAutodnaMileagePaste } from "@/lib/autodna-mileage-paste-parse";
import { parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";
import { parseCarverticalTimelineFromText } from "@/lib/carvertical-pdf-parse";
import { pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";

const DISPLAY_LOCALES = [
  "lv",
  "en",
  "lt",
  "de",
  "fr",
  "pl",
  "ru",
  "es",
  "it",
  "nl",
  "da",
  "sv",
  "fi",
  "cs",
  "sk",
  "hu",
  "ro",
  "bg",
  "uk",
  "et",
  "pt",
  "el",
  "tr",
  "nb",
  "hr",
  "sl",
] as const;

function countryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function discoverIso2Codes(): string[] {
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const out: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const iso = String.fromCharCode(a, b);
      const name = dn.of(iso);
      if (name && name !== iso) out.push(iso);
    }
  }
  return out;
}

describe("countryLabelToIso2 US states and CA provinces", () => {
  it("maps Louisiana forms to US, never Laos", () => {
    expect(countryLabelToIso2("Luiziāna (LA)")).toBe("US");
    expect(countryLabelToIso2("Louisiana (LA)")).toBe("US");
    expect(countryLabelToIso2("Baton Rouge, LA")).toBe("US");
    expect(countryLabelToIso2("LA 70817")).toBe("US");
    expect(countryLabelToIso2("LA")).toBe("US");
    expect(countryLabelToIso2("Louisiana")).toBe("US");
    expect(normalizeCountryNameLv("LA")).toBe("ASV");
    expect(normalizeCountryNameLv("Luiziāna (LA)")).toBe("ASV");
  });

  it("maps USA markers even when CarVertical text is noisy", () => {
    expect(countryLabelToIso2("Copart (ASV)")).toBe("US");
    expect(countryLabelToIso2("USA")).toBe("US");
    expect(countryLabelToIso2("United States")).toBe("US");
    expect(countryLabelToIso2("ASV, LA")).toBe("US");
  });

  it("maps Canadian provinces to CA; standalone CA stays Canada", () => {
    expect(countryLabelToIso2("Ontario")).toBe("CA");
    expect(countryLabelToIso2("Toronto, ON")).toBe("CA");
    expect(countryLabelToIso2("Kvebeka")).toBe("CA");
    expect(countryLabelToIso2("CA")).toBe("CA");
    expect(countryLabelToIso2("Kanāda")).toBe("CA");
  });

  it("keeps real ISO countries and rejects unknown 2-letter codes", () => {
    expect(countryLabelToIso2("DE")).toBe("DE");
    expect(countryLabelToIso2("LV")).toBe("LV");
    expect(countryLabelToIso2("XX")).toBeNull();
    expect(countryLabelToIso2("LAOS")).toBe("LA");
    expect(countryLabelToIso2("LA")).toBe("US");
  });
});

describe("world country names → ISO2 + LV form", () => {
  it("normalizes United States variants in LV/EN/LT/DE/FR/PL/RU and ISO3", () => {
    const labels = [
      "Amerikas Savienotās Valstis",
      "United States",
      "United States of America",
      "USA",
      "US",
      "Jungtinės Valstijos",
      "Vereinigte Staaten",
      "États-Unis",
      "Stany Zjednoczone",
      "Соединенные Штаты",
      "США",
    ];
    for (const label of labels) {
      expect(countryLabelToIso2(label), label).toBe("US");
      expect(normalizeCountryNameLv(label), label).toBe("ASV");
    }
    expect(pdfCountryFlagEmoji("Jungtinės Valstijos")).toBe("🇺🇸");
  });

  it("normalizes Canada variants including ISO3 CAN", () => {
    for (const label of ["Kanāda", "Canada", "Kanada", "Канада", "CAN", "CA"]) {
      expect(countryLabelToIso2(label), label).toBe("CA");
      expect(normalizeCountryNameLv(label), label).toBe("Kanāda");
    }
  });

  it("maps ISO2/ISO3 and language variants for other countries", () => {
    expect(countryLabelToIso2("GBR")).toBe("GB");
    expect(countryLabelToIso2("DEU")).toBe("DE");
    expect(countryLabelToIso2("FRA")).toBe("FR");
    expect(countryLabelToIso2("POL")).toBe("PL");
    expect(countryLabelToIso2("LTU")).toBe("LT");
    expect(countryLabelToIso2("Vokietija")).toBe("DE");
    expect(countryLabelToIso2("Deutschland")).toBe("DE");
    expect(countryLabelToIso2("Allemagne")).toBe("DE");
    expect(countryLabelToIso2("Niemcy")).toBe("DE");
    expect(countryLabelToIso2("Германия")).toBe("DE");
    expect(normalizeCountryNameLv("Vokietija")).toBe("Vācija");
    expect(normalizeCountryNameLv("Lietuva")).toBe("Lietuva");
    expect(normalizeCountryNameLv("Litwa")).toBe("Lietuva");
    expect(countryLabelToIso2("California (ASV)")).toBe("US");
    expect(countryLabelToIso2("California")).toBe("US");
    expect(countryLabelToIso2("ASV")).toBe("US");
    expect(countryLabelToIso2("USA")).toBe("US");
    expect(countryLabelToIso2("US")).toBe("US");
    expect(countryLabelToIso2("LT")).toBe("LT");
    expect(countryLabelToIso2("Lietuva")).toBe("LT");
    expect(countryLabelToIso2("Lithuania")).toBe("LT");
    expect(countryLabelToIso2("Copart")).toBeNull();
    expect(normalizeCountryNameLv("California (ASV)")).toBe("ASV");
    expect(normalizeCountryNameLv("Lithuania")).toBe("Lietuva");
    expect(iso2ToLvDisplayName("JP")).toBeTruthy();
    expect(countryLabelToIso2("Japan")).toBe("JP");
    expect(countryLabelToIso2("Japonija")).toBe("JP");
    expect(countryLabelToIso2("Japon")).toBe("JP");
    expect(countryLabelToIso2("Japonia")).toBe("JP");
    expect(countryLabelToIso2("Япония")).toBe("JP");
  });

  it("covers a world ISO2 via Intl.DisplayNames English official name", () => {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of("BR");
    expect(name).toBeTruthy();
    expect(countryLabelToIso2(name!)).toBe("BR");
    expect(countryLabelToIso2("BRA")).toBe("BR");
    expect(normalizeCountryNameLv("Brazil")).toBe(iso2ToLvDisplayName("BR"));
  });

  it("maps every ISO3 code and every Intl name in LV/EN/LT/DE/FR/PL/RU", () => {
    const iso2s = discoverIso2Codes();
    expect(iso2s.length).toBeGreaterThan(200);
    expect(Object.keys(ISO3_TO_ISO2).length).toBeGreaterThan(240);

    for (const [iso3, iso2] of Object.entries(ISO3_TO_ISO2)) {
      expect(countryLabelToIso2(iso3), iso3).toBe(iso2);
      expect(countryLabelToIso2(iso3.toLowerCase()), iso3).toBe(iso2);
    }

    for (const iso of iso2s) {
      for (const locale of DISPLAY_LOCALES) {
        let name: string | undefined;
        try {
          name = new Intl.DisplayNames([locale], { type: "region" }).of(iso);
        } catch {
          continue;
        }
        if (!name || name === iso) continue;
        const resolved = countryLabelToIso2(name);
        if (resolved !== iso) {
          const key = countryKey(name);
          let collision = false;
          for (const loc of DISPLAY_LOCALES) {
            let otherName: string | undefined;
            try {
              otherName = new Intl.DisplayNames([loc], { type: "region" }).of(resolved!);
            } catch {
              continue;
            }
            if (otherName && countryKey(otherName) === key) {
              collision = true;
              break;
            }
          }
          expect(collision, `${locale}:${name} -> ${resolved} not ${iso}`).toBe(true);
        }
        const stripped = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (stripped !== name) {
          const ascii = countryLabelToIso2(stripped);
          expect(ascii === iso || ascii === resolved, `${locale} ascii:${stripped}`).toBe(true);
        }
      }
      const lv = iso2ToLvDisplayName(iso);
      expect(lv.length).toBeGreaterThan(0);
      expect(countryLabelToIso2(lv) || countryLabelToIso2(iso), `lv-form:${lv}`).toBeTruthy();
      expect(pdfCountryFlagEmoji(iso).length).toBeGreaterThan(0);
    }
  });

  it("keeps Georgia the country distinct from Georgia the US state", () => {
    expect(countryLabelToIso2("Georgia")).toBe("GE");
    expect(countryLabelToIso2("Gruzija")).toBe("GE");
    expect(countryLabelToIso2("GEO")).toBe("GE");
    expect(normalizeCountryNameLv("Georgia")).toBe(iso2ToLvDisplayName("GE"));
    expect(countryLabelToIso2("Georgia (GA)")).toBe("US");
    expect(countryLabelToIso2("Atlanta, GA")).toBe("US");
  });

  it("does not treat United States Virgin Islands as ASV", () => {
    expect(countryLabelToIso2("United States Virgin Islands")).toBe("VI");
    expect(countryLabelToIso2("U.S. Virgin Islands")).toBe("VI");
    expect(countryLabelToIso2("ASV Virdžīnas")).toBe("VI");
  });
});

describe("parsers normalize country at import", () => {
  it("AutoDNA Valsts line maps official long names to ASV", () => {
    const rows = parseAutodnaMileagePaste(`
TRANSPORTLĪDZEKĻA VĒSTURE
12.03.2023
Odometra rādījums 90900 km
Valsts Amerikas Savienotās Valstis
01.06.2016
Odometra rādījums 61000 km
Valsts Jungtinės Valstijos
`);
    expect(rows.map((r) => r.country)).toEqual(["ASV", "ASV"]);
  });

  it("AutoDNA damage Valsts United States becomes ASV", () => {
    const raw = `
03.2023 Transportlīdzekļa zaudējumu apjoms
Summa 4 200 EUR
Valsts United States of America
`;
    const rows = parseAutodnaDamageEvents(raw);
    expect(rows[0]?.incidentNo).toBe("ASV");
  });

  it("CarVertical timeline leading country becomes the LV form", () => {
    const rows = parseCarverticalTimelineFromText(
      `Transportlīdzekļa ierakstu laikposms
12.2013. Amerikas Savienotās Valstis Mainītas īpašumtiesības
01.06.2014. United States Ražots
`,
    );
    expect(rows.some((r) => r.country === "ASV")).toBe(true);
    expect(rows.every((r) => r.country !== "Amerikas Savienotās Valstis")).toBe(true);
    expect(rows.every((r) => r.country !== "United States")).toBe(true);
  });

  it("CarVertical leading ISO3 USA becomes ASV", () => {
    const rows = parseCarverticalTimelineFromText(
      `Transportlīdzekļa ierakstu laikposms
12.2013. USA Mainītas īpašumtiesības
`,
    );
    expect(rows.some((r) => r.country === "ASV")).toBe(true);
  });
});
