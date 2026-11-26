/**
 * 26.11 VIN SCAN avotu audita labojums 4 (zurnals/vin-scan-avotu-audits-2026-11-26.md):
 * dati, kas avotos jau bija, bet VIN SCAN / «Ātrā pārbaude» tos izmeta.
 */
import { describe, expect, it } from "vitest";

import { atraVisibleFacts, buildAtraFacts, type AtraFactRow } from "@/lib/atra-parbaude-facts";
import { carinfoScanFromPage } from "@/lib/vin-scan/carinfo-lookup";
import { parseVinSourceScan } from "@/lib/vin-scan/parse";
import { vinScanParseFromCarfax } from "@/lib/vin-scan/parse-carfax-eu";
import { tjekbilScanWithExtras } from "@/lib/vin-scan/tjekbil-scan";
import { emptyVinSourceResult } from "@/lib/vin-sources/types";
import type { VinScanParse } from "@/lib/vin-scan/types";

const VOLVO_VIN = "YV1FW7BCDE1234567";
const VW_DE_VIN = "WVWZZZ3CZEE123456";
const US_VIN = "1FTFW1ET5DFC10312";

function row(id: string, label: string, country: string, parsed: VinScanParse): AtraFactRow {
  return { id, label, country, ...parsed, openUrl: parsed.openUrl ?? undefined };
}

function factsFor(vin: string, rows: AtraFactRow[]) {
  return buildAtraFacts({ vin, plate: "", title: "", year: "", rows, dealer: null, csdd: null, hasListing: false });
}

describe("4. dati, kas avotos ir, bet UI tos izmeta", () => {
  it("lkf.ee OCTA atlīdzības -> kartīte «Negadījumi»", () => {
    const lkf = {
      ...emptyVinSourceResult("lkf_ee", VOLVO_VIN, ""),
      found: true,
      message: "Atrasti 1 OCTA atlīdzības gadījumi",
      incidents: [{ date: "2021-06-14", amount: "1 250 EUR", country: "Igaunija", note: "OCTA atlīdzība" }],
    };
    const parsed = parseVinSourceScan(lkf);
    expect(parsed.incidents).toEqual([{ date: "2021-06-14", summary: "OCTA atlīdzība, 1 250 EUR, Igaunija" }]);
    const f = factsFor(VOLVO_VIN, [row("lkf_ee", "lkf.ee", "EE", parsed)]);
    expect(f.incidents.count).toBe(1);
    expect(f.incidents.sources).toEqual(["lkf.ee"]);
    expect(atraVisibleFacts(f)).toContain("incidents");
  });

  it("mnt.ee reģistra notikumi un īpašnieki redzami, apskates -> «Tehniskā apskate», valsts EE", () => {
    const mnt = {
      ...emptyVinSourceResult("mnt_ee", VOLVO_VIN, ""),
      found: true,
      message: "Atrasts Igaunijas reģistrā (1 nobraukuma ieraksti)",
      mileage: [{ date: "2023-05-02", odometer: "182000", country: "Igaunija" }],
      timeline: [
        { date: "2019-03-11", odometer: "", country: "Igaunija", event: "Īpašnieka maiņa" },
        { date: "2023-05-02", odometer: "182000", country: "Igaunija", event: "Tehniskā apskate (Korraline): Izturēta, Tallinn" },
      ],
      ownersSummary: "Igaunijas reģ. nr. / modelis: 123ABC - VOLVO V60",
    };
    const parsed = parseVinSourceScan(mnt);
    expect(parsed.detail).toContain("Igaunijas reģ. nr. / modelis: 123ABC - VOLVO V60");
    expect(parsed.detail).toContain("Reģistra notikumi:");
    expect(parsed.detail).toContain("11.03.2019 Īpašnieka maiņa");
    expect(parsed.inspections).toEqual([{ date: "2023-05-02", result: "Izturēta, Tallinn", odometer: "182000" }]);
    expect(parsed.flags?.registrationCountry).toBe("EE");
    const f = factsFor(VOLVO_VIN, [row("mnt_ee", "mnt.ee", "EE", parsed)]);
    expect(atraVisibleFacts(f)).toEqual(expect.arrayContaining(["inspection", "countries", "mileage"]));
    expect(f.inspection.sources).toEqual(["mnt.ee"]);
    expect(f.countries).toEqual(["EE"]);
  });

  it("tjekbil VIN SCAN: nobraukuma žurnāls, meklēšanā un RAPEX atsaukumi", () => {
    const dmr = {
      basic: { maerkeTypeNavn: "VW", modelTypeNavn: "Passat", regNr: "AB12345", koeretoejId: 9001, foersteRegistreringDato: "2015-03-01" },
    };
    const base = { status: "found" as const, summary: "VW Passat, 2015, AB12345", vehicle: { make: "VW", model: "Passat", year: "2015" } };
    const parsed = tjekbilScanWithExtras(base, dmr, {
      mileagelogs: [{ mileage: 150000, mileageAt: "2020-05-01", origin: 10 }],
      wanted: [{ date: "2022-01-01" }],
      rapex: [{ title: "Gaisa spilvens", date: "2021-02-03" }],
    });
    expect(parsed.mileage).toEqual([{ date: "2020-05-01", odometer: "150000" }]);
    expect(parsed.flags).toMatchObject({ registrationCountry: "DK", wanted: true, recallCount: 1 });
    expect(parsed.recalls).toEqual([{ title: "Gaisa spilvens", date: "2021-02-03" }]);
    expect(parsed.vehicle).toEqual(base.vehicle);
    const f = factsFor(VW_DE_VIN, [row("tjekbil", "tjekbil.dk", "DK", parsed)]);
    expect(f.wanted).toEqual(["tjekbil.dk"]);
    expect(f.recalls.count).toBe(1);
    expect(atraVisibleFacts(f)).toEqual(expect.arrayContaining(["mileage", "wanted", "recalls"]));
    // Nav atrasts DMR - nekas netiek pievienots.
    expect(tjekbilScanWithExtras({ status: "none", summary: "x" }, dmr, { mileagelogs: null, wanted: null, rapex: null })).toEqual({
      status: "none",
      summary: "x",
    });
  });

  it("car.info: marka «Audi A7 Sportback» (nevis «A7»/«Sportback») un apskate -> «Tehniskā apskate»", () => {
    const html = `<html><body>
<p>ABC123 is a black Audi A7 Sportback from 2012 with a 204 hp diesel engine.</p>
<div>Number of Owners</div><div>3</div>
<div>Inspected</div><div>2025-04-10</div>
<div>Inspection valid to</div><div>2026-06-30</div>
<p>Information from Transportstyrelsen</p>
</body></html>`;
    const parsed = carinfoScanFromPage(200, html);
    expect(parsed.status).toBe("found");
    expect(parsed.vehicle).toEqual({ make: "Audi", model: "A7 Sportback", year: "2012" });
    expect(parsed.inspections).toEqual([{ date: "2025-04-10", result: "derīga līdz 30.06.2026" }]);
    const f = factsFor("WAUZZZ4G1CN123456", [row("carinfo", "car.info", "SE", parsed)]);
    expect(atraVisibleFacts(f)).toContain("inspection");
    expect(f.inspection.last).toBe("10.04.2025 · derīga līdz 30.06.2026");
  });

  it("car.info: VW Passat Variant un zviedru teksts", () => {
    expect(carinfoScanFromPage(200, `<p>XYZ is a white Volkswagen Passat Variant from 2016.</p><p>Number of Owners 2</p>`).vehicle).toEqual({
      make: "Volkswagen",
      model: "Passat Variant",
      year: "2016",
    });
    expect(carinfoScanFromPage(200, `<p>KWW569 är en svart Volvo XC60 från 2011. Antal ägare 7</p>`).vehicle).toEqual({
      make: "Volvo",
      model: "XC60",
      year: "2011",
    });
  });

  it("CARFAX.eu valstis -> kartīte «Valstis» (bez «EU» kopsummas)", () => {
    const parsed = vinScanParseFromCarfax(
      "found",
      { recordCheck: { displayRecords: 30, recordsPerCountry: { nl: 25, de: 4, eu: 1 }, presentCountry: "lv" } },
      "https://www.carfax.eu",
    );
    expect(parsed.flags?.countries).toEqual(["NL", "DE", "LV"]);
    const f = factsFor(VW_DE_VIN, [row("carfax_eu", "CARFAX.eu", "EU", parsed)]);
    expect(f.countries).toEqual(["DE", "LV", "NL"]);
    expect(atraVisibleFacts(f)).toContain("countries");
  });

  it("atsaukumi (ES Safety Gate modeļa līmenī, NHTSA) -> kartīte «Atsaukumi»; markas līmenis nē", () => {
    const sg: AtraFactRow = {
      id: "eu_safety_gate",
      label: "ES Safety Gate",
      country: "EU",
      status: "found",
      summary: "ES Safety Gate: 1 modeļa līmeņa brīdinājums - VOLVO V60 (…)",
      recalls: [{ title: "A12/00123/24, V60, traumu risks", date: "2024-03-01" }],
    };
    const nhtsa: AtraFactRow = {
      id: "nhtsa_recalls",
      label: "NHTSA",
      country: "US",
      status: "found",
      summary: "NHTSA: 1 atsaukums",
      recalls: [{ title: "AIR BAGS", date: "2019-07-01" }],
    };
    const f = factsFor(US_VIN, [sg, nhtsa]);
    expect(f.recalls.count).toBe(2);
    expect(f.recalls.items[0]).toBe("01.03.2024 A12/00123/24, V60, traumu risks");
    expect(f.recalls.sources).toEqual(["ES Safety Gate", "NHTSA"]);
    expect(atraVisibleFacts(f)).toContain("recalls");
    const brandOnly = factsFor(VOLVO_VIN, [{ ...sg, summary: "ES Safety Gate: 3 markas līmeņa brīdinājumi - VOLVO, modelis nav zināms" }]);
    expect(brandOnly.recalls.count).toBe(0);
    expect(atraVisibleFacts(brandOnly)).not.toContain("recalls");
  });

  it("CARFAX.eu dod marku/modeli (VIN SCAN auto nosaukumam, ne vPIC)", () => {
    const parsed = vinScanParseFromCarfax(
      "found",
      { recordCheck: { displayRecords: 3, recordsPerCountry: { se: 2 }, make: "VOLVO", model: "V60" } },
      "https://www.carfax.eu",
    );
    expect(parsed.vehicle).toEqual({ make: "VOLVO", model: "V60", year: "" });
  });
});
