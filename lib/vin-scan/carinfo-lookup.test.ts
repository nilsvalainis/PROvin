import { describe, expect, it } from "vitest";

import {
  CARINFO_SEARCH_LOCALES,
  carinfoSvVinUrl,
  carinfoSwedenPlateUrl,
  carinfoSwedenVinUrl,
} from "@/lib/vin-sources/carinfo-search";
import { runCarinfoLookup } from "@/lib/vin-scan/carinfo-lookup";

const VIN = "YV1LW5522V2348444";

/** Saīsināts no dzīvās lapas https://www.car.info/en-se/vin/S/YV1LW5522V2348444 (Volvo V70, BMX837). */
const VOLVO_V70_HTML = `
<html><head><title>BMX837 - Volvo V70 2.5 20V Manual, 170hp, 1997</title></head><body>
<p>BMX837 is a green Volvo V70 from 1997 with a 170 hp petrol engine and manual transmission.</p>
<dl>
<dt>In Traffic</dt><dd>No</dd>
<dt>Domestic</dt><dd>Yes</dd>
<dt>Colour</dt><dd>Green</dd>
<dt>Number of Owners</dt><dd>12</dd>
<dt>Mileage</dt><dd>523,710 km</dd>
<dt>Engine</dt><dd>Petrol, 2.4 I5 (170 hp)</dt>
<dt>Transmission</dt><dd>Manual, 5-speed</dt>
<dt>Drivetrain</dt><dd>FWD</dt>
</dl>
<h2>Mileage history</h2>
<table>
<tr><th>Reported odometer readings</th><th></th></tr>
<tr><td>Inspection 523,710 km</td><td>2017-10-10</td></tr>
<tr><td>Inspection 514,280 km</td><td>2016-10-25</td></tr>
<tr><td>Inspection 505,360 km</td><td>2015-11-20</td></tr>
</table>
<h2>Vehicle history</h2>
<p>2019-02-26</p>
<p>Scrapping in Sweden</p>
<p>2018-12-27</p>
<p>Not in traffic</p>
<p>Information from Transportstyrelsen (The Swedish Transport Agency) was last updated 2026-10-13.</p>
</body></html>
`;

describe("car.info VIN adreses", () => {
  it("servera ceļš ir /sv-se/vin/S/, operatora saite paliek /en-se/vin/S/", () => {
    expect(carinfoSvVinUrl(VIN)).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
    expect(carinfoSwedenVinUrl(VIN)).toBe(`https://www.car.info/en-se/vin/S/${VIN}`);
    expect(carinfoSwedenVinUrl(VIN)).not.toContain("search?q=");
    expect(carinfoSvVinUrl(` ${VIN.toLowerCase()} `)).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
    expect(carinfoSwedenPlateUrl("bmx 837")).toBe("https://www.car.info/en-se/license-plate/S/BMX837");
  });
});

const SV_XC60_HTML = `
<html><head><title>KWW569 - Volvo XC60 D3 Manuell, 163hk, 2011</title></head><body>
<p>KWW569 är en svart Volvo XC60 från 2011 med en 163 hk dieselmotor och manuell växellåda. I trafik: Nej.</p>
<div><span>Antal ägare</span> 7</div>
<table>
<tr><th>Händelse</th><th>Mil</th><th>Datum</th></tr>
<tr><td>Kontrollbesiktning</td><td>47 732 mil</td><td>2026-01-08</td></tr>
</table>
<p>Information från Transportstyrelsen</p>
</body></html>
`;

function superSearchLocales(calls: string[]): string[] {
  return calls
    .filter((url) => url.includes("/search/super/"))
    .map((url) => /\/([a-z]{2}-[a-z]{2})\/search\/super\//.exec(url)?.[1] ?? "");
}

const EMPTY_SUPER = JSON.stringify({ hits: { idents: [] }, hits_html: "" });

describe("runCarinfoLookup", () => {
  it("sv-se VIN lapa pietiek, en-se un numuru neprasa", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(VIN, "", async (url) => {
      calls.push(url);
      return { status: 200, text: VOLVO_V70_HTML };
    });
    expect(calls).toEqual([`https://www.car.info/sv-se/vin/S/${VIN}`]);
    expect(parsed.status).toBe("found");
    expect(parsed.openUrl).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
    expect(parsed.summary).toBe("Volvo V70, 1997, 523 710 km, 12 īpašnieki");
    expect(parsed.vehicle).toEqual({ make: "Volvo", model: "V70", year: "1997" });
    expect(parsed.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2017-10-10", odometer: "523710" }),
        expect.objectContaining({ date: "2016-10-25", odometer: "514280" }),
        expect.objectContaining({ date: "2015-11-20", odometer: "505360" }),
      ]),
    );
    expect(parsed.detail).toMatch(/Satiksmē: nē/);
    expect(parsed.detail).toMatch(/Krāsa: zaļa/);
    expect(parsed.detail).toMatch(/Dzinējs: benzīns, 2\.4 I5 170 ZS/);
    expect(parsed.detail).not.toMatch(/Transmission/);
    expect(parsed.detail).toMatch(/Norakstīts Zviedrijā \(26\.02\.2019\)/);
    expect(parsed.flags?.registrationCountry).toBe("SE");
  });

  it("404 uz VIN meklē super-search, tad numuru", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(VIN, "BMX837", async (url) => {
      calls.push(url);
      if (url.includes("/license-plate/")) return { status: 200, text: VOLVO_V70_HTML };
      if (url.includes("/search/super/")) {
        return { status: 200, text: EMPTY_SUPER };
      }
      return { status: 404, text: "not found" };
    });
    expect(calls[0]).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
    expect(calls[1]).toBe(`https://www.car.info/en-se/vin/S/${VIN}`);
    expect(superSearchLocales(calls)).toEqual([...CARINFO_SEARCH_LOCALES]);
    expect(calls.at(-1)).toBe("https://www.car.info/en-se/license-plate/S/BMX837");
    expect(calls.some((url) => url.includes("search?q="))).toBe(false);
    expect(calls.some((url) => url.includes("/sv-se/license-plate/"))).toBe(false);
    expect(parsed.status).toBe("found");
    expect(parsed.openUrl).toBe("https://www.car.info/en-se/license-plate/S/BMX837");
  });

  it("bez numura 404 paliek none", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(VIN, "", async (url) => {
      calls.push(url);
      if (url.includes("/search/super/")) {
        return { status: 200, text: EMPTY_SUPER };
      }
      return { status: 404, text: "" };
    });
    expect(calls).toHaveLength(2 + CARINFO_SEARCH_LOCALES.length);
    expect(superSearchLocales(calls)).toEqual([...CARINFO_SEARCH_LOCALES]);
    expect(parsed).toMatchObject({ status: "none", summary: "car.info šo VIN neatrada" });
  });

  it("403 uz visām tiešajām lapām ir bloķēts, numuru vairs nemeklē", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(VIN, "BMX837", async (url) => {
      calls.push(url);
      return { status: 403, text: "<html><title>403 Forbidden</title></html>" };
    });
    expect(calls.slice(0, 2)).toEqual([
      `https://www.car.info/sv-se/vin/S/${VIN}`,
      `https://www.car.info/en-se/vin/S/${VIN}`,
    ]);
    expect(superSearchLocales(calls)).toEqual([...CARINFO_SEARCH_LOCALES]);
    expect(calls.some((url) => url.includes("/license-plate/"))).toBe(false);
    expect(parsed.status).toBe("blocked");
    expect(parsed.summary).toBe("car.info bloķē serveri - atver pārlūkā");
    expect(parsed.openUrl).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
  });

  it("sv-se lapa ar mil nolasa km un auto, en-se netiek saukts", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup("YV1DZ5251B2146640", "", async (url) => {
      calls.push(url);
      return { status: 200, text: SV_XC60_HTML };
    });
    expect(calls).toEqual(["https://www.car.info/sv-se/vin/S/YV1DZ5251B2146640"]);
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("Volvo XC60");
    expect(parsed.summary).toContain("2011");
    expect(parsed.summary).toContain("477 320 km");
    expect(parsed.mileage?.[0]).toMatchObject({ date: "2026-01-08", odometer: "477320" });
    expect(parsed.detail).toMatch(/Satiksmē: nē/);
    expect(parsed.flags?.registrationCountry).toBe("SE");
  });

  it("sv-se 403 turpina uz en-se un neapstājas", async () => {
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(VIN, "", async (url) => {
      calls.push(url);
      if (url.includes("/sv-se/")) return { status: 403, text: "<html><title>403 Forbidden</title></html>" };
      return { status: 200, text: VOLVO_V70_HTML };
    });
    expect(calls[0]).toBe(`https://www.car.info/sv-se/vin/S/${VIN}`);
    expect(calls[1]).toBe(`https://www.car.info/en-se/vin/S/${VIN}`);
    expect(calls.some((url) => url.includes("/search/super/"))).toBe(false);
    expect(parsed.status).toBe("found");
    expect(parsed.openUrl).toBe(`https://www.car.info/en-se/vin/S/${VIN}`);
  });

  it("DK super-search atrod VIN, ko Zviedrijas lapas neredz", async () => {
    const dkVin = "VF12RFL1H49621453";
    const dkPage = `https://www.car.info/en-dk/vin/DK/${dkVin}`;
    const calls: string[] = [];
    const parsed = await runCarinfoLookup(dkVin, "", async (url) => {
      calls.push(url);
      if (url.includes("/en-dk/search/super/")) {
        return {
          status: 200,
          text: JSON.stringify({
            hits: {
              idents: [{ country: "DK", vin: dkVin, secondary_name_blurred: "Renault Captur" }],
            },
            hits_html: `<a href="${dkPage}">`,
          }),
        };
      }
      if (url === dkPage) {
        return {
          status: 200,
          text: `
            <html><body>
            <p>AB12345 is a Renault Captur from 2014.</p>
            <dl>
            <dt>In Traffic</dt><dd>Yes</dd>
            <dt>Number of Owners</dt><dd>3</dd>
            <dt>Mileage</dt><dd>80,000 km</dd>
            </dl>
            <table>
            <tr><th>Reported odometer readings</th><th></th></tr>
            <tr><td>Inspection 80,000 km</td><td>2024-05-01</td></tr>
            </table>
            </body></html>
          `,
        };
      }
      if (url.includes("/search/super/")) return { status: 200, text: EMPTY_SUPER };
      return { status: 404, text: "not found" };
    });
    expect(calls[0]).toBe(`https://www.car.info/sv-se/vin/S/${dkVin}`);
    expect(calls[1]).toBe(`https://www.car.info/en-se/vin/S/${dkVin}`);
    const dkLocaleAt = CARINFO_SEARCH_LOCALES.indexOf("en-dk");
    expect(superSearchLocales(calls)).toEqual([...CARINFO_SEARCH_LOCALES].slice(0, dkLocaleAt + 1));
    expect(calls.at(-1)).toBe(dkPage);
    expect(parsed.status).toBe("found");
    expect(parsed.openUrl).toBe(dkPage);
    expect(parsed.summary).toContain("Renault Captur");
    expect(parsed.summary).toContain("2014");
    expect(parsed.flags?.registrationCountry).toBeUndefined();
  });
});
