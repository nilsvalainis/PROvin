import { describe, expect, it } from "vitest";

import { parseOrderVinScanRecord, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { applyBrowserArchiveHtml, preferBrowserArchiveImport } from "@/lib/order-vin-scan-browser-html";
import { parseSwedishVehiclePage, swedishSourceFromUrl } from "@/lib/vin-scan/parse-sweden";
import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

const VIN = "WBA5R1C0XLFH42873";
const OTHER = "YV1SW61R241234567";

function record(): OrderVinScanRecord {
  return {
    at: "2026-10-15T09:00:00.000Z",
    vin: VIN,
    status: "done",
    indicators: [],
  };
}

const BILUPPGIFTER = `<!doctype html><html><body>
  <h1>Volvo V70</h1>
  <dl>
    <dt>Märke</dt><dd>Volvo</dd>
    <dt>Modell</dt><dd>V70</dd>
    <dt>Modellår</dt><dd>2014</dd>
    <dt>Chassinummer</dt><dd>${VIN}</dd>
    <dt>Registreringsnummer</dt><dd>ABC123</dd>
    <dt>Fordonsstatus</dt><dd>I trafik</dd>
  </dl>
  <h2>Mätarställning</h2>
  <table>
    <tr><th>Datum</th><th>Mätarställning</th></tr>
    <tr><td>2024-03-12</td><td>185 000 km</td></tr>
    <tr><td>2022-03-01</td><td>160 000 km</td></tr>
  </table>
  <h2>Besiktning</h2>
  <table>
    <tr><th>Datum</th><th>Resultat</th><th>Mätarställning</th></tr>
    <tr><td>2024-03-12</td><td>Godkänd</td><td>185 000 km</td></tr>
    <tr><td>2022-03-01</td><td>Underkänd</td><td>160 000 km</td></tr>
  </table>
  <h2>Historik</h2>
  <ul>
    <li>2020-01-15 I trafik</li>
    <li>2024-06-01 Avställd</li>
  </ul>
  <p>Lot: 50558298</p>
  <p>Final bid: $5,200</p>
</body></html>`;

const PLATE_ONLY = `<!doctype html><html><body>
  <h1>Fordonsuppgifter</h1>
  <table>
    <tr><th>Registreringsnummer</th><td>ABC123</td></tr>
    <tr><th>Fabrikat</th><td>VOLVO</td></tr>
    <tr><th>Handelsbeteckning</th><td>V70</td></tr>
    <tr><th>Fordonsår</th><td>2014</td></tr>
    <tr><th>Fordonsstatus</th><td>Avställd</td></tr>
  </table>
  <h2>Kontrollbesiktning</h2>
  <p>2024-03-12 Godkänd</p>
  <p>Mätarställning 18 500 mil</p>
</body></html>`;

describe("Zviedrijas reģistra HTML", () => {
  it("atpazīst biluppgifter, Transportstyrelsen un car.info transportlīdzekļa lapu", () => {
    expect(swedishSourceFromUrl("https://biluppgifter.se/fordon/ABC123")).toBe("biluppgifter");
    expect(swedishSourceFromUrl(`https://biluppgifter.se/${VIN}`)).toBe("biluppgifter");
    expect(swedishSourceFromUrl("https://biluppgifter.se/")).toBeNull();
    expect(swedishSourceFromUrl("https://fu-regnr.transportstyrelsen.se/fu-regnr/")).toBe("transportstyrelsen");
    expect(swedishSourceFromUrl("https://www.car.info/en-se/volvo/v70")).toBe("carinfo");
    expect(swedishSourceFromUrl(`https://www.car.info/en-se/vin/${VIN}`)).toBe("carinfo");
    expect(swedishSourceFromUrl("https://carinfo.se/fordon/volvo-v70")).toBe("carinfo");
    expect(swedishSourceFromUrl("https://www.car.info/en-se")).toBeNull();
  });

  it("biluppgifter saglabā marku, gadu, km, besiktning un statusu kā SE", () => {
    const applied = applyBrowserArchiveHtml({
      record: record(),
      id: "biluppgifter",
      html: BILUPPGIFTER,
      pageUrl: `https://biluppgifter.se/fordon/${VIN}`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators.find((item) => item.id === "biluppgifter");
    expect(row?.country).toBe("SE");
    expect(row?.status).toBe("found");
    expect(row?.label).toBe("biluppgifter.se");
    expect(row?.vehicle).toEqual({ make: "Volvo", model: "V70", year: "2014" });
    expect(row?.summary).toContain("Volvo V70, 2014, 185 000 km");
    expect(row?.summary).toContain("Besiktning 12.03.2024: izturēta");
    expect(row?.summary).toContain("Statuss: ekspluatācijā");
    expect(row?.mileage?.map((item) => item.odometer)).toEqual(["185 000 km", "160 000 km"]);
    expect(row?.inspections?.[0]).toMatchObject({ date: "2024-03-12", result: "izturēta", odometer: "185 000 km" });
    expect(row?.inspections?.[1]?.result).toBe("nav izturēta");
    expect(row?.detail).toContain("Reģ. nr. ABC123");
    expect(row?.detail).toContain("Vēsture:");
    expect(row?.detail).toContain("01.06.2024: noņemts no uzskaites");
    expect(row?.flags?.registrationCountry).toBe("SE");
    expect(row?.auctions ?? []).toEqual([]);
    const again = parseOrderVinScanRecord(applied.record);
    expect(again?.indicators.find((item) => item.id === "biluppgifter")?.inspections?.[1]?.result).toBe("nav izturēta");
  });

  it("bez VIN lapā piesien atvērtā pasūtījuma VIN un mil pārrēķina uz km", () => {
    const applied = applyBrowserArchiveHtml({
      record: record(),
      id: "transportstyrelsen",
      html: PLATE_ONLY,
      pageUrl: "https://fu-regnr.transportstyrelsen.se/fu-regnr/?regnr=ABC123",
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators[0];
    expect(row?.id).toBe("transportstyrelsen");
    expect(row?.label).toBe("Transportstyrelsen");
    expect(row?.country).toBe("SE");
    expect(row?.status).toBe("found");
    expect(row?.vehicle).toEqual({ make: "VOLVO", model: "V70", year: "2014" });
    expect(row?.summary).toContain("VOLVO V70, 2014, 185 000 km");
    expect(row?.summary).toContain("Besiktning 12.03.2024: izturēta");
    expect(row?.summary).toContain("Statuss: noņemts no uzskaites");
    expect(row?.mileage?.[0]?.odometer).toBe("185 000 km");
    expect(row?.mileage?.[0]?.source).toBe("Transportstyrelsen");
    expect(applied.record.vin).toBe(VIN);
  });

  it("VIN lapā, kas nesakrīt ar pasūtījumu, tiek noraidīts", () => {
    const applied = applyBrowserArchiveHtml({
      record: record(),
      id: "biluppgifter",
      html: BILUPPGIFTER.replaceAll(VIN, OTHER),
      pageUrl: `https://biluppgifter.se/fordon/${OTHER}`,
      vin: VIN,
    });
    expect(applied).toEqual({ ok: false, error: "vin_mismatch" });
  });

  it("car.info transportlīdzekļa lapa ir found, meklēšanas lapa nav avots", () => {
    const html = `<html><body><dl>
      <dt>Make</dt><dd>Volvo</dd>
      <dt>Model</dt><dd>V70</dd>
      <dt>Year</dt><dd>2014</dd>
      <dt>VIN</dt><dd>${VIN}</dd>
      <dt>Mileage</dt><dd>185000 km</dd>
      <dt>Inspection</dt><dd>Approved 2024-03-12</dd>
    </dl></body></html>`;
    const applied = applyBrowserArchiveHtml({
      record: record(),
      id: "carinfo",
      html,
      pageUrl: "https://www.car.info/en-se/volvo/v70",
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.record.indicators[0]?.country).toBe("SE");
    expect(applied.record.indicators[0]?.summary).toContain("Volvo V70, 2014, 185 000 km");
    expect(applied.record.indicators[0]?.summary).toContain("Besiktning 12.03.2024: izturēta");
    expect(applied.record.indicators[0]?.inspections?.[0]?.result).toBe("izturēta");

    const home = applyBrowserArchiveHtml({
      record: record(),
      id: "carinfo",
      html,
      pageUrl: "https://www.car.info/en-se",
      vin: VIN,
    });
    expect(home).toEqual({ ok: false, error: "unsupported" });
  });

  it("tukšs reģistrs ir none, BankID un Cloudflare nav viltus none", () => {
    const none = parseSwedishVehiclePage(
      "<html><body><p>Fordonet hittades inte</p><p>Inga uppgifter om fordonet.</p></body></html>",
      "https://biluppgifter.se/fordon/ABC123",
    );
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.parsed.status).toBe("none");
    expect(none.parsed.summary).toBe("Zviedrijas reģistrā ieraksta nav");

    const bank = parseSwedishVehiclePage(
      "<html><body><h1>Logga in med BankID</h1><p>Identifiering krävs</p></body></html>",
      "https://fu-regnr.transportstyrelsen.se/",
    );
    expect(bank).toEqual({ ok: false, error: "page_not_ready" });

    const cloud = applyBrowserArchiveHtml({
      record: record(),
      id: "transportstyrelsen",
      html: "<html><body><h1>Just a moment...</h1><p>Cloudflare</p><p>Checking your browser</p></body></html>",
      pageUrl: "https://fu-regnr.transportstyrelsen.se/",
      vin: VIN,
    });
    expect(cloud).toEqual({ ok: false, error: "page_not_ready" });
  });

  it("pilna skenēšana patur Transportstyrelsen rindu, kuras katalogā nav", () => {
    const keptRow = {
      id: "transportstyrelsen" as VinScanSourceId,
      label: "Transportstyrelsen",
      country: "SE",
      status: "found" as const,
      summary: "Volvo V70, 2014",
      detail: "Reģ. nr. ABC123",
      openUrl: "https://fu-regnr.transportstyrelsen.se/",
      inspections: [{ date: "2024-03-12", result: "izturēta" }],
    };
    const incoming = [
      {
        id: "csdd" as const,
        label: "CSDD",
        country: "LV",
        status: "none" as const,
        summary: "Nav",
        detail: "",
        openUrl: null,
      },
    ];
    const kept = preferBrowserArchiveImport([keptRow], incoming);
    expect(kept.map((row) => row.id)).toEqual(["csdd", "transportstyrelsen"]);
    expect(kept[1]?.inspections?.[0]?.result).toBe("izturēta");

    const serverUnknown = preferBrowserArchiveImport(
      [keptRow],
      [{ ...keptRow, status: "unknown", summary: "Cloudflare", inspections: [] }],
    );
    expect(serverUnknown[0]?.status).toBe("found");
    expect(serverUnknown[0]?.inspections?.[0]?.result).toBe("izturēta");
  });
});
