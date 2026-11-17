import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scanFetch = vi.fn();
vi.mock("@/lib/vin-scan/http", () => ({
  scanFetch: (...args: unknown[]) => scanFetch(...args),
  scanFetchSmart: vi.fn(),
  scanChallengeReason: vi.fn(() => ""),
}));

import { vinScanCatalogItem } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds, isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { dvsaOdometerKm, parseCzRsv, parseDvsaMot } from "@/lib/vin-scan/parse-cz-uk";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { sourceNeedsInput, vinScanProbeFor } from "@/lib/vin-scan/probes";
import { probeCzRsv, probeDvsaMot, resetDvsaMotTokenCache } from "@/lib/vin-scan/probes-cz-uk";

/** lv-LV tūkstošu atdalītājs ir nedalāmā atstarpe. */
const sp = (s: string | undefined) => (s ?? "").replace(/[  ]/g, " ");

function fixture(name: string): { status: number; text: string } {
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__", name), "utf8")) as {
    _meta: { status: number };
    body: unknown;
  };
  return { status: raw._meta.status, text: JSON.stringify(raw.body) };
}

const ctx = (uk = "") => ({ vin: "TMBJH9NP9N7043581", plates: { ...emptyVinScanPlates(), uk }, listingUrl: "" });

const DVSA_ENV = {
  DVSA_MOT_CLIENT_ID: "test-client",
  DVSA_MOT_CLIENT_SECRET: "test-secret",
  DVSA_MOT_API_KEY: "test-api-key",
  DVSA_MOT_TOKEN_URL: "https://login.example.test/tenant/oauth2/v2.0/token",
};

beforeEach(() => {
  scanFetch.mockReset();
  resetDvsaMotTokenCache();
  vi.stubEnv("CZ_RSV_API_KEY", "");
  for (const k of [...Object.keys(DVSA_ENV), "DVSA_MOT_SCOPE"]) vi.stubEnv(k, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("CZ Datová kostka RSV parseris", () => {
  it("dokumentācijas piemērs: marka, modelis, gads, īpašnieki, apskate", () => {
    const { status, text } = fixture("cz-rsv/docs-example.json");
    const parsed = parseCzRsv(status, text);
    expect(parsed.status).toBe("found");
    expect(parsed.vehicle).toEqual({ make: "ŠKODA", model: "FELICIA COMBI", year: "1997" });
    expect(parsed.summary).toBe("ŠKODA FELICIA COMBI, pirmā reģ. 1997-03-21, īpašnieki 1, PROVOZOVANÉ");
    expect(parsed.detail).toContain("Turētāju skaits: 4");
    expect(parsed.detail).toContain("Tehniskā apskate derīga līdz: 2013-12-06");
    expect(parsed.flags?.registrationCountry).toBe("CZ");
  });

  it("imports: pirmā reģistrācija ārzemēs atšķiras no CZ datuma", () => {
    const parsed = parseCzRsv(
      200,
      JSON.stringify({
        Status: 1,
        Data: {
          TovarniZnacka: "BMW",
          ObchodniOznaceni: "330I",
          DatumPrvniRegistrace: "2020-02-01T00:00:00",
          DatumPrvniRegistraceVCr: "2023-05-10T00:00:00",
        },
      }),
    );
    expect(parsed.summary).toContain("CZ no 2023-05-10");
  });

  it("bez atslēgas (reālā 401 atbilde), limits, nav atrasts", () => {
    const missingKey = JSON.stringify({ Message: "Missing API key", Type: 2, Success: false, Data: null });
    expect(parseCzRsv(401, missingKey).status).toBe("config_missing");
    expect(parseCzRsv(429, "").status).toBe("unknown");
    expect(
      parseCzRsv(200, JSON.stringify({ Message: "Pro Váš klíč dosažen maximální počet požadavků. Zkuste to prosím později." }))
        .summary,
    ).toMatch(/limits/);
    expect(parseCzRsv(404, "").status).toBe("none");
    expect(parseCzRsv(200, JSON.stringify({ Status: 1, Data: null })).status).toBe("none");
    expect(parseCzRsv(200, "<html>").status).toBe("unknown");
  });
});

describe("UK DVSA MOT parseris", () => {
  it("dokumentācijas piemērs: jūdzes pārrēķinātas uz km, ieteikumi saskaitīti", () => {
    const { status, text } = fixture("dvsa-mot/docs-example.json");
    const parsed = parseDvsaMot(status, text);
    expect(parsed.status).toBe("found");
    expect(parsed.vehicle).toEqual({ make: "", model: "", year: "2003" });
    expect(parsed.mileage?.map((r) => ({ ...r, odometer: sp(r.odometer) }))).toEqual([
      { date: "2015-03-11", odometer: "214 413 km" },
    ]);
    expect(parsed.inspections?.map((r) => [r.date, r.result, sp(r.odometer)])).toEqual([
      ["2015-03-11", "izturēta (2 ieteikumi)", "214 413 km"],
    ]);
    expect(sp(parsed.summary)).toBe("1 MOT apskates, pēdējā 2015-03-11, izturēta, 214 413 km");
  });

  it("neizturēta apskate ar defektiem, km vienība un nenolasīts odometrs", () => {
    const parsed = parseDvsaMot(
      200,
      JSON.stringify({
        registration: "AB12CDE",
        make: "FORD",
        model: "FOCUS",
        manufactureDate: "2016-04-01",
        motTests: [
          {
            completedDate: "2024-05-02T10:00:00.000Z",
            testResult: "FAILED",
            odometerValue: "90000",
            odometerUnit: "KM",
            odometerResultType: "READ",
            defects: [
              { type: "MAJOR", text: "brake", dangerous: false },
              { type: "DANGEROUS", text: "tyre", dangerous: true },
              { type: "MINOR", text: "lamp", dangerous: false },
            ],
          },
          {
            completedDate: "2025-05-03T10:00:00.000Z",
            testResult: "PASSED",
            odometerValue: "",
            odometerUnit: null,
            odometerResultType: "NO_ODOMETER",
            defects: [],
          },
        ],
      }),
    );
    expect(parsed.vehicle).toEqual({ make: "FORD", model: "FOCUS", year: "2016" });
    expect(parsed.inspections?.map((r) => [r.date, r.result, sp(r.odometer)])).toEqual([
      ["2025-05-03", "izturēta", ""],
      ["2024-05-02", "nav izturēta (1 bīstami, 1 būtiski, 1 nebūtiski)", "90 000 km"],
    ]);
    expect(parsed.mileage?.map((r) => r.date)).toEqual(["2024-05-02"]);
    expect(parsed.summary).toBe("FORD FOCUS. 2 MOT apskates (1 neizturētas), pēdējā 2025-05-03, izturēta");
  });

  it("odometra pārrēķins", () => {
    expect(dvsaOdometerKm("1000", "mi", "READ")).toBe(1609);
    expect(dvsaOdometerKm("1000", "KM", "READ")).toBe(1000);
    expect(dvsaOdometerKm("1000", "mi", "NO_ODOMETER")).toBeNull();
    expect(dvsaOdometerKm("", "mi", "READ")).toBeNull();
  });

  it("HTTP statusi", () => {
    expect(parseDvsaMot(404, "").status).toBe("none");
    expect(parseDvsaMot(403, "").status).toBe("config_missing");
    expect(parseDvsaMot(429, "").status).toBe("unknown");
    expect(parseDvsaMot(500, "").status).toBe("unknown");
  });
});

describe("CZ RSV zonde", () => {
  it("bez CZ_RSV_API_KEY: config_missing un bez tīkla", async () => {
    const row = await probeCzRsv(ctx());
    expect(row.status).toBe("config_missing");
    expect(row.summary).toContain("CZ_RSV_API_KEY");
    expect(scanFetch).not.toHaveBeenCalled();
  });

  it("ar atslēgu sūta API_KEY galvenē un parsē atbildi", async () => {
    vi.stubEnv("CZ_RSV_API_KEY", "cz-test-key");
    scanFetch.mockResolvedValueOnce(fixture("cz-rsv/docs-example.json"));
    const row = await probeCzRsv(ctx());
    expect(row.status).toBe("found");
    expect(row.label).toBe("Datová kostka RSV");
    const [url, init] = scanFetch.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2?vin=TMBJH9NP9N7043581");
    expect(init.headers.API_KEY).toBe("cz-test-key");
  });
});

describe("UK DVSA MOT zonde", () => {
  const token = (accessToken: string, expiresIn = 1199) => ({
    status: 200,
    text: JSON.stringify({ token_type: "Bearer", expires_in: expiresIn, access_token: accessToken }),
  });

  it("bez env: config_missing un bez tīkla", async () => {
    const row = await probeDvsaMot(ctx("AB12CDE"));
    expect(row.status).toBe("config_missing");
    expect(row.summary).toMatch(/DVSA/);
    expect(scanFetch).not.toHaveBeenCalled();
  });

  it("bez UK numura: needs_input", async () => {
    for (const [k, v] of Object.entries(DVSA_ENV)) vi.stubEnv(k, v);
    expect((await probeDvsaMot(ctx())).status).toBe("needs_input");
    expect(sourceNeedsInput("dvsa_mot", ctx())?.status).toBe("needs_input");
    expect(sourceNeedsInput("dvsa_mot", ctx("AB12CDE"))).toBeNull();
    expect(scanFetch).not.toHaveBeenCalled();
  });

  it("OAuth tokens tiek kešots līdz derīguma beigām, tad pieprasīts no jauna", async () => {
    for (const [k, v] of Object.entries(DVSA_ENV)) vi.stubEnv(k, v);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
    const mot = fixture("dvsa-mot/docs-example.json");
    scanFetch.mockImplementation(async (url: string) => {
      if (url === DVSA_ENV.DVSA_MOT_TOKEN_URL) {
        return token(`tok-${scanFetch.mock.calls.filter((c) => c[0] === url).length}`);
      }
      return mot;
    });

    const first = await probeDvsaMot(ctx("se38 guw"));
    expect(first.status).toBe("found");
    await probeDvsaMot(ctx("SE38GUW"));
    const tokenCalls = () => scanFetch.mock.calls.filter((c) => c[0] === DVSA_ENV.DVSA_MOT_TOKEN_URL);
    expect(tokenCalls()).toHaveLength(1);

    const [tokenUrl, tokenInit] = tokenCalls()[0] as [string, { method: string; body: string }];
    expect(tokenUrl).toBe(DVSA_ENV.DVSA_MOT_TOKEN_URL);
    expect(tokenInit.method).toBe("POST");
    const form = new URLSearchParams(tokenInit.body);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("scope")).toBe("https://tapi.dvsa.gov.uk/.default");

    const apiCall = scanFetch.mock.calls.find((c) => String(c[0]).startsWith("https://history.mot.api.gov.uk/")) as [
      string,
      { headers: Record<string, string> },
    ];
    expect(apiCall[0]).toBe("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/SE38GUW");
    expect(apiCall[1].headers.authorization).toBe("Bearer tok-1");
    expect(apiCall[1].headers["X-API-Key"]).toBe("test-api-key");

    vi.setSystemTime(new Date("2026-11-17T10:20:00Z"));
    await probeDvsaMot(ctx("SE38GUW"));
    expect(tokenCalls()).toHaveLength(2);
    const lastApi = scanFetch.mock.calls.at(-1) as [string, { headers: Record<string, string> }];
    expect(lastApi[1].headers.authorization).toBe("Bearer tok-2");
  });

  it("tokena kļūda: config_missing, API netiek saukts", async () => {
    for (const [k, v] of Object.entries(DVSA_ENV)) vi.stubEnv(k, v);
    scanFetch.mockResolvedValueOnce({ status: 401, text: "{}" });
    const row = await probeDvsaMot(ctx("SE38GUW"));
    expect(row.status).toBe("config_missing");
    expect(scanFetch).toHaveBeenCalledTimes(1);
  });
});

describe("jaunie avoti katalogā", () => {
  it("ir bezmaksas, ir zonde un pareizās prasības", () => {
    for (const id of ["cz_rsv", "dvsa_mot"] as const) {
      expect(isFreeVinScanSourceId(id)).toBe(true);
      expect(freeVinScanSourceIds()).toContain(id);
      expect(vinScanProbeFor(id)).toBeTypeOf("function");
    }
    expect(vinScanCatalogItem("cz_rsv").needs).toEqual(["vin"]);
    expect(vinScanCatalogItem("dvsa_mot").needs).toEqual(["uk"]);
    expect(vinScanCatalogItem("dvsa_mot").openUrl("X", { ...emptyVinScanPlates(), uk: "SE38 GUW" })).toBe(
      "https://www.check-mot.service.gov.uk/results?registration=SE38GUW",
    );
  });
});
