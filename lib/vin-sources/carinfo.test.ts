import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const scanFetch = vi.fn();
const applyVinScanRelayIfBlocked = vi.fn();
const applyCarinfoSuperSearchHttp = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/vin-sources/browser", () => ({ isVinSourcesBrowserAllowed: () => false }));
vi.mock("@/lib/vin-scan/http", () => ({ scanFetch: (...args: unknown[]) => scanFetch(...args) }));
vi.mock("@/lib/vin-scan/listings-page-relay", () => ({
  applyVinScanRelayIfBlocked: (...args: unknown[]) => applyVinScanRelayIfBlocked(...args),
  applyCarinfoSuperSearchHttp: (...args: unknown[]) => applyCarinfoSuperSearchHttp(...args),
  isCarinfoSuperSearchUrl: (url: string) => String(url).includes("/search/super/"),
}));

import { carinfoResultFromHtml, fetchCarInfo } from "@/lib/vin-sources/carinfo";

/**
 * Saīsināta dzīvā lapa https://www.car.info/en-se/vin/S/{VIN} bez konta (24.11.2026):
 * BMW 530i xDrive Touring 2019, Zviedrijas auto ar jaunāku Dānijas numuru. Numuri aizstāti.
 */
const PAGE = readFileSync(
  join(process.cwd(), "lib/__fixtures__/carinfo/se-vin-page-registered-abroad.html"),
  "utf8",
);
const VIN = "WBAZZZ00000000001";
const EN_URL = `https://www.car.info/en-se/vin/S/${VIN}`;
const FORBIDDEN = "<html><head><title>403 Forbidden</title></head><body>nginx</body></html>";
const EMPTY_SUPER = JSON.stringify({ hits: { idents: [] }, hits_html: "" });

afterEach(() => {
  scanFetch.mockReset();
  applyVinScanRelayIfBlocked.mockReset();
  applyCarinfoSuperSearchHttp.mockReset();
});

describe("carinfoResultFromHtml", () => {
  const result = carinfoResultFromHtml(VIN, EN_URL, PAGE);

  it("nolasa publiskos laukus: īpašnieki, piedziņa, dzinējs, kārba, krāsa, satiksme, apskates", () => {
    expect(result?.found).toBe(true);
    expect(result?.ownersSummary.split("\n")).toEqual([
      "3 īpašnieki",
      "Īpašnieku skaits nav pilnīgs: trūkst laika, kad auto bija reģistrēts ārvalstīs",
    ]);
    const status = result?.statusRecords.split("\n") ?? [];
    expect(status).toContain("Satiksmē: nē");
    expect(status).toContain("Krāsa: melna");
    expect(status).toContain("Dzinējs: benzīns, 2.0 I4 252 ZS");
    expect(status).toContain("Ātrumkārba: automātiskā");
    expect(status).toContain("Piedziņa: AWD");
    expect(status).toContain("Pēdējā apskate: 03.03.2026");
    expect(status).toContain("Apskate derīga līdz: 03.03.2028");
  });

  it("aprēķinātais odometrs ir atzīmēts kā aprēķins un nav nobraukuma vēsturē kā atsevišķs rādījums", () => {
    expect(result?.statusRecords).toMatch(/Aprēķinātais nobraukums \(car\.info aprēķins, nav rādījums\): 133\s820 km/);
    expect(result?.mileage).toEqual([
      { date: "2026-03-03", odometer: "133820", country: "Zviedrija", origin: "car.info, apskate" },
      { date: "2023-02-09", odometer: "69000", country: "Zviedrija", origin: "car.info, apskate" },
    ]);
  });

  it("jaunākais numurs citā valstī nonāk statusā un piezīmēs", () => {
    expect(result?.statusRecords).toContain("Pēdējais zināmais reģistrācijas numurs: DK XY12345 (Dānija)");
    expect(result?.notes).toContain("Pēdējais zināmais reģistrācijas numurs: DK XY12345 (Dānija).");
  });

  it("vēstures notikumi latviski ar datumiem", () => {
    expect(result?.timeline).toEqual([
      { date: "2026-05-27", odometer: "", country: "Zviedrija", event: "Līzings beidzies" },
      { date: "2026-05-27", odometer: "", country: "Zviedrija", event: "Noņemts no satiksmes" },
      { date: "2026-03-03", odometer: "", country: "Zviedrija", event: "Līzingā līdz 02.03.2027" },
      { date: "2026-03-03", odometer: "", country: "Zviedrija", event: "Satiksmē" },
      { date: "2026-03-03", odometer: "", country: "Zviedrija", event: "Reģistrēts: Dānija, numurs DK XY12345" },
    ]);
  });

  it("ziņojumā ir, cik ierakstu car.info slēpj aiz konta", () => {
    expect(result?.message).toBe(
      `Nolasīts no ${EN_URL} (2 nobraukuma ieraksti, 5 notikumi; car.info kopā ir 6 nobraukuma ieraksti un 34 vēstures notikumi, bez konta redzami tikai jaunākie)`,
    );
  });

  it("tukša lapa nav rezultāts", () => {
    expect(carinfoResultFromHtml(VIN, EN_URL, "<html><body><p>car.info</p></body></html>")).toBeNull();
  });
});

describe("fetchCarInfo (pasūtījuma avota bloks)", () => {
  it("serveris dabū 403, relejs atdod lapu: bloks ir aizpildīts, nevis 'VIN nav atrasts'", async () => {
    scanFetch.mockResolvedValue({ status: 403, text: FORBIDDEN, cookie: "" });
    applyVinScanRelayIfBlocked.mockImplementation(async (url: string) =>
      url === EN_URL ? { status: 200, text: PAGE } : { status: 403, text: FORBIDDEN },
    );
    const result = await fetchCarInfo(VIN);
    expect(scanFetch).toHaveBeenCalledTimes(1);
    expect(applyVinScanRelayIfBlocked).toHaveBeenCalledTimes(1);
    expect(applyCarinfoSuperSearchHttp).not.toHaveBeenCalled();
    expect(result.found).toBe(true);
    expect(result.mileage).toHaveLength(2);
    expect(result.timeline).toHaveLength(5);
    expect(result.message).toContain(EN_URL);
  });

  it("tiešais fetch strādā: releju nesauc", async () => {
    scanFetch.mockResolvedValue({ status: 200, text: PAGE, cookie: "" });
    const result = await fetchCarInfo(VIN);
    expect(result.found).toBe(true);
    expect(applyVinScanRelayIfBlocked).not.toHaveBeenCalled();
  });

  it("VIN nav nevienā reģistrā: skaidrs 'neatrada'", async () => {
    scanFetch.mockImplementation(async (url: string) =>
      url.includes("/search/super/")
        ? { status: 200, text: EMPTY_SUPER, cookie: "" }
        : { status: 404, text: "<html><title>Car.info</title></html>", cookie: "" },
    );
    const result = await fetchCarInfo(VIN);
    expect(result.found).toBe(false);
    expect(result.message).toBe("car.info šo VIN neatrada (Zviedrija, Dānija, Norvēģija, Somija)");
  });

  it("serveris un relejs bloķēti: ziņo par bloķēšanu ar releja iemeslu, nevis 'neatrada'", async () => {
    scanFetch.mockResolvedValue({ status: 403, text: FORBIDDEN, cookie: "" });
    const blocked = { status: 403, text: FORBIDDEN, challengeReason: "Relejs aizņemts (rinda pilna)" };
    applyVinScanRelayIfBlocked.mockResolvedValue(blocked);
    applyCarinfoSuperSearchHttp.mockResolvedValue(blocked);
    const result = await fetchCarInfo(VIN);
    expect(result.found).toBe(false);
    expect(result.message).toBe(
      `car.info bloķē servera pieprasījumus (Relejs aizņemts (rinda pilna)) - atver ${EN_URL} pārlūkā`,
    );
  });
});
