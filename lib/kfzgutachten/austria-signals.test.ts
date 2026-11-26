import { describe, expect, it } from "vitest";

import { kfzAtPushLine, kfzAtViewState, vinScanAustriaSignals } from "@/lib/kfzgutachten/austria-signals";

const VIN = "WDB2200261A291096";
const kfzRow = (date = "") => ({
  id: "kfz_at",
  status: date ? "browser_only" : "needs_input",
  summary: "",
  openUrl: `https://kfzgutachten.at/?vin=${VIN}&date=${date}`,
});

describe("Austrijas pazīmes", () => {
  it("CSDD iepriekšējā valsts, sludinājums .at, CARFAX valstis, izsole Austrijā", () => {
    expect(vinScanAustriaSignals({ rows: [], previousCountry: "AUSTRIJA" })).toEqual(["CSDD iepriekšējā valsts Austrija"]);
    expect(vinScanAustriaSignals({ rows: [], listingUrl: "https://www.willhaben.at/iad/gebrauchtwagen/d/auto/1" })).toEqual([
      "sludinājums Austrijā",
    ]);
    expect(
      vinScanAustriaSignals({ rows: [{ id: "carfax_eu", status: "found", flags: { countries: ["DE", "AT"] } }] }),
    ).toEqual(["vēsturē Austrija"]);
    expect(
      vinScanAustriaSignals({ rows: [{ id: "thecarapi_eu", status: "found", auctions: [{ venue: "Autobid · Wien, Österreich" }] }] }),
    ).toEqual(["izsole Austrijā"]);
  });

  it("bez pazīmēm - tukšs (Nila S 320 CDI: CSDD neatrada, nekas nenorāda uz Austriju)", () => {
    expect(
      vinScanAustriaSignals({
        rows: [
          { id: "vin_decode", status: "found", summary: "2001 Mercedes-Benz · Ražots: Vācija" },
          { id: "csdd", status: "none", summary: "CSDD reģistrā šāds numurs netika atrasts" },
          kfzRow(),
        ],
        previousCountry: "",
      }),
    ).toEqual([]);
  });
});

describe("kfz_at stāvoklis visās VIN SCAN vietās", () => {
  it("Austrijas auto bez datuma: sarkans, skaidrs iemesls, push rinda", () => {
    const s = kfzAtViewState({ vin: VIN, rows: [kfzRow()], previousCountry: "Austrija", orderId: "cs_live_test123" });
    expect(s.risk).toBe(true);
    expect(s.status).toBe("nav pārbaudīts");
    expect(s.detail).toMatch(/nav precīza 1\. reģ\. datuma/);
    expect(kfzAtPushLine(s)).toBe("Austrija §57a: vajag precīzu 1. reģ. datumu");
  });

  it("datums no CSDD API (Ātrā pārbaude) vai pasūtījuma blokiem -> saite ar datumu un pasūtījumu", () => {
    const s = kfzAtViewState({ vin: VIN, rows: [kfzRow()], previousCountry: "AT", csddFirstRegIso: "2001-03-15", orderId: "cs_live_test123" });
    expect(s.date).toBe("15.03.2001");
    expect(s.url).toBe(`https://kfzgutachten.at/?vin=${VIN}&date=15.03.2001&provin=cs_live_test123`);
    expect(s.status).toBe("nav pārbaudīts");
    expect(s.detail).toMatch(/izmanto pārlūka joslu/);
    expect(s.risk).toBe(true);
    const fromBlocks = kfzAtViewState({ vin: VIN, rows: [kfzRow("01.02.2003")], firstRegDate: "2004-05-06" });
    expect(fromBlocks.date).toBe("06.05.2004");
    expect(kfzAtViewState({ vin: VIN, rows: [kfzRow("01.02.2003")] }).date).toBe("01.02.2003");
  });

  it("bez Austrijas pazīmēm - nav sarkans; ielasīts saraksts - gatavs", () => {
    const plain = kfzAtViewState({ vin: VIN, rows: [kfzRow()] });
    expect(plain.risk).toBe(false);
    expect(kfzAtPushLine(plain)).toBe("");
    const done = kfzAtViewState({ vin: VIN, rows: [kfzRow()], previousCountry: "AUSTRIJA", listed: 3 });
    expect(done).toMatchObject({ done: true, risk: false, status: "3 apskates ielasītas" });
    expect(kfzAtPushLine(done)).toBe("");
  });
});

describe("kfz_at automātiskā pārbaude (26.11 - visiem auto ar VIN + 1. reģ. datumu)", () => {
  const found = {
    id: "kfz_at",
    status: "found",
    summary: "kfzgutachten.at: 2 atzinumi (13.11.2015, 04.08.2016)",
    openUrl: `https://kfzgutachten.at/?vin=${VIN}&date=20.08.2004`,
    inspections: [{ date: "13.11.2015" }, { date: "04.08.2016" }],
  };

  it("atrasts: skaits + datumi, nav sarkans, push rinda ar skaitu arī bez Austrijas pazīmēm", () => {
    const s = kfzAtViewState({ vin: VIN, rows: [found] });
    expect(s).toMatchObject({ checked: "found", count: 2, status: "2 atzinumi", risk: false, done: true, date: "20.08.2004" });
    expect(s.detail).toContain("13.11.2015, 04.08.2016");
    expect(kfzAtPushLine(s)).toBe("Austrija §57a: 2 atzinumi (atzinumus pērc pats, 1,19 € gab.)");
  });

  it("nav ierakstu: nav sarkans arī Austrijas auto, push neko neprasa", () => {
    const s = kfzAtViewState({
      vin: VIN,
      rows: [{ id: "kfz_at", status: "none", summary: "kfzgutachten.at: nav ierakstu", openUrl: found.openUrl }],
      previousCountry: "AUSTRIJA",
    });
    expect(s).toMatchObject({ checked: "none", status: "nav ierakstu", risk: false });
    expect(kfzAtPushLine(s)).toBe("");
  });

  it("nav pārbaudīts (rindā / reCAPTCHA pauze): iemesls detaļā", () => {
    const s = kfzAtViewState({
      vin: VIN,
      rows: [
        {
          id: "kfz_at",
          status: "browser_only",
          summary: "kfzgutachten.at: nav pārbaudīts (pēc reCAPTCHA atteikuma pauze līdz 21:30) - izmanto pārlūka joslu",
          openUrl: found.openUrl,
        },
      ],
      previousCountry: "AT",
    });
    expect(s.status).toBe("nav pārbaudīts");
    expect(s.detail).toContain("pauze līdz 21:30 - izmanto pārlūka joslu");
    expect(s.risk).toBe(true);
    expect(kfzAtPushLine(s)).toBe("Austrija §57a: nav pārbaudīts - atver sarakstu pasūtījumā");
  });
});
