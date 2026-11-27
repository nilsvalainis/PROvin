import { describe, expect, it } from "vitest";
import {
  isBatteryElectricVehicle,
  normalizeBevOemLine,
  stripOilChangeContentForBev,
} from "@/lib/vehicle-bev";
import { oilBlockIsBev, oilIntervalNotesWithRequiredNotes } from "@/lib/oil-change-interval-chart";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";

const IX3_EXPECTED_PLAIN = [
  "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).",
  "Regulāro apkopju intervāli",
  "Dīlera datubāzē kopumā fiksēti 6 ieraksti laika posmā no 2021. gada 29. jūnija (14 km) līdz 2024. gada 20. jūnijam (98 671 km).",
  "Datu hronoloģija",
  "Garākais periods bez ierakstiem dīlera datos ir 12 mēneši un 38 358 km: no 2022. gada 15. jūnija līdz 2023. gada 14. jūnijam. Kopš pēdējā dīlera ieraksta ir pagājuši 29 mēneši.",
].join("\n");

const IX3_AI_PLAIN = [
  "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).",
  "Eļļas maiņas ieraksti",
  "Dīlera datos nav fiksēta neviena dzinēja eļļas maiņa. Elektroauto ar elektromotoru dzinēja eļļas maiņa nav paredzēta.",
  "Regulāro apkopju intervāli",
  "Dīlera datubāzē kopumā fiksēti 6 ieraksti laika posmā no 2021. gada 29. jūnija (14 km) līdz 2024. gada 20. jūnijam (98 671 km).",
  "Datu hronoloģija",
  "Garākais periods bez ierakstiem dīlera datos ir 12 mēneši un 38 358 km: no 2022. gada 15. jūnija līdz 2023. gada 14. jūnijam. Kopš pēdējā dīlera ieraksta ir pagājuši 29 mēneši.",
].join("\n");

const IX3_AI_HTML =
  "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).<br><br>" +
  "<strong>Eļļas maiņas ieraksti</strong><br>Dīlera datos nav fiksēta neviena dzinēja eļļas maiņa, jo elektroauto dzinēja eļļas maiņa nav paredzēta.<br><br>" +
  "<strong>Regulāro apkopju intervāli</strong><br>Dīlera datubāzē kopumā fiksēti 6 ieraksti laika posmā no 2021. gada 29. jūnija (14 km) līdz 2024. gada 20. jūnijam (98 671 km).<br><br>" +
  "<strong>Datu hronoloģija</strong><br>Garākais periods bez ierakstiem dīlera datos ir 12 mēneši un 38 358 km. Kopš pēdējā dīlera ieraksta ir pagājuši 29 mēneši.";

function block(partial: Partial<AutoRecordsBlockState>): AutoRecordsBlockState {
  return { serviceWorks: [], serviceHistory: [], comments: "", ...partial } as unknown as AutoRecordsBlockState;
}

describe("isBatteryElectricVehicle", () => {
  it("BEV pēc CSDD degvielas, motora koda, modeļa", () => {
    expect(isBatteryElectricVehicle({ fuel: ["Elektrība"] })).toBe(true);
    expect(isBatteryElectricVehicle({ fuel: ["ELECTRIC"] })).toBe(true);
    expect(isBatteryElectricVehicle({ engineCodes: ["HA0"] })).toBe(true);
    expect(isBatteryElectricVehicle({ engineCodes: ["HA0001N0"] })).toBe(true);
    expect(isBatteryElectricVehicle({ models: ["BMW iX3"] })).toBe(true);
    expect(isBatteryElectricVehicle({ models: ["BMW IX3"] })).toBe(true);
    for (const m of [
      "VW ID.4 Pro",
      "Audi Q4 e-tron",
      "Audi e-tron 55 quattro",
      "Porsche Taycan 4S",
      "Tesla Model 3",
      "Nissan Leaf",
      "Renault Megane E-Tech Electric",
      "Renault Zoe",
      "Mercedes-Benz EQC 400",
      "Hyundai Ioniq 5",
      "Kia EV6",
      "Skoda Enyaq iV 80",
    ]) {
      expect(isBatteryElectricVehicle({ models: [m] }), m).toBe(true);
    }
  });

  it("hibrīdi un iekšdedze NAV BEV", () => {
    expect(isBatteryElectricVehicle({ fuel: ["Benzīns/elektrība"] })).toBe(false);
    expect(isBatteryElectricVehicle({ fuel: ["Plug-in hybrid"], models: ["BMW X5 xDrive45e"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["Audi A3 Sportback e-tron"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["Audi Q7 e-tron quattro"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["BMW i3 REx"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["Toyota RAV4 Hybrid"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["Renault Megane Grandtour E-Tech Plug-in Hybrid"] })).toBe(false);
    expect(isBatteryElectricVehicle({ fuel: ["Dīzelis"], models: ["BMW iX3"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["BMW 320d"], engineCodes: ["B47D20"] })).toBe(false);
    expect(isBatteryElectricVehicle({ models: ["2.0L I4 TDI"] })).toBe(false);
    expect(isBatteryElectricVehicle({})).toBe(false);
  });

  it("eļļas lauka pirmā rinda «nav piemērojams (elektroauto» skaitās", () => {
    expect(isBatteryElectricVehicle({ oilText: "Ražotāja intervāls: nav piemērojams (elektroauto, HA0)." })).toBe(true);
  });
});

describe("stripOilChangeContentForBev", () => {
  it("iX3 (vienkāršs teksts): izmet tikai «Eļļas maiņas ieraksti» bloku, pārējais paliek", () => {
    expect(stripOilChangeContentForBev(IX3_AI_PLAIN)).toBe(IX3_EXPECTED_PLAIN);
  });

  it("iX3 (HTML): izmet eļļas sadaļu, virsraksti un atdalītāji paliek", () => {
    const out = stripOilChangeContentForBev(IX3_AI_HTML);
    expect(out).not.toContain("Eļļas maiņas ieraksti");
    expect(out).not.toMatch(/eļļas maiņa/i);
    expect(out).toBe(
      "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).<br><br>" +
        "<strong>Regulāro apkopju intervāli</strong><br>Dīlera datubāzē kopumā fiksēti 6 ieraksti laika posmā no 2021. gada 29. jūnija (14 km) līdz 2024. gada 20. jūnijam (98 671 km).<br><br>" +
        "<strong>Datu hronoloģija</strong><br>Garākais periods bez ierakstiem dīlera datos ir 12 mēneši un 38 358 km. Kopš pēdējā dīlera ieraksta ir pagājuši 29 mēneši.",
    );
  });

  it("eļļas teikumu citā sadaļā izmet, reduktora eļļu atstāj", () => {
    const text =
      "Ražotāja intervāls: nav piemērojams (elektroauto).\n" +
      "Regulāro apkopju intervāli\n" +
      "Fiksēti 3 apkopes ieraksti. Elektromotoram eļļa nav nepieciešama. 2023. gada 10. maijā nomainīta reduktora eļļa.";
    expect(stripOilChangeContentForBev(text)).toBe(
      "Ražotāja intervāls: nav piemērojams (elektroauto).\n" +
        "Regulāro apkopju intervāli\n" +
        "Fiksēti 3 apkopes ieraksti. 2023. gada 10. maijā nomainīta reduktora eļļa.",
    );
  });

  it("EN / RU / DE eļļas virsraksti", () => {
    expect(
      stripOilChangeContentForBev(
        "<strong>Engine oil change records</strong><br>No oil change is recorded.<br><br><strong>Service intervals</strong><br>6 records.",
      ),
    ).toBe("<strong>Service intervals</strong><br>6 records.");
    expect(
      stripOilChangeContentForBev(
        "<strong>Записи о замене масла</strong><br>Нет записей.<br><br><strong>Хронология</strong><br>6 записей.",
      ),
    ).toBe("<strong>Хронология</strong><br>6 записей.");
    expect(
      stripOilChangeContentForBev(
        "<strong>Ölwechsel</strong><br>Keine Einträge.<br><br><strong>Chronologie</strong><br>6 Einträge.",
      ),
    ).toBe("<strong>Chronologie</strong><br>6 Einträge.");
  });
});

describe("normalizeBevOemLine", () => {
  it("km / mēn. vai «nav droši zināms» -> «nav piemērojams (elektroauto, KODS)»", () => {
    expect(normalizeBevOemLine("Ražotāja intervāls: 30 000 km / 24 mēn. (HA0).<br><br>X.", "HA0")).toBe(
      "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).<br><br>X.",
    );
    expect(normalizeBevOemLine("Ražotāja intervāls: nav droši zināms. Dīlera datos 3 ieraksti.", "")).toBe(
      "Ražotāja intervāls: nav piemērojams (elektroauto). Dīlera datos 3 ieraksti.",
    );
    const ok = "Ražotāja intervāls: nav piemērojams (elektroauto, HA0).\nY";
    expect(normalizeBevOemLine(ok, "HA0")).toBe(ok);
  });
});

describe("oilIntervalNotesWithRequiredNotes - BEV / PHEV", () => {
  it("iX3: eļļas bloks prom, piebildes nepievieno", () => {
    const b = block({ outvinReport: { vehicleInfo: { model: "iX3", engineCode: "HA0" } } as never });
    expect(oilBlockIsBev(b)).toBe(true);
    const out = oilIntervalNotesWithRequiredNotes(b, IX3_AI_PLAIN, "lv");
    expect(out).toBe(IX3_EXPECTED_PLAIN);
    expect(out).not.toMatch(/nenozīmē, ka eļļas maiņa nav veikta/);
  });

  it("BEV pēc eļļas lauka pirmās rindas (bez citiem datiem)", () => {
    expect(oilIntervalNotesWithRequiredNotes(block({}), IX3_AI_PLAIN, "lv")).toBe(IX3_EXPECTED_PLAIN);
  });

  it("PHEV: eļļas analīze paliek", () => {
    const b = block({ outvinReport: { vehicleInfo: { model: "X5 xDrive45e", fuel: "Plug-in hybrid", engineCode: "B58B30" } } as never });
    expect(oilBlockIsBev(b)).toBe(false);
    const text =
      "Ražotāja intervāls: 30 000 km / 24 mēn. (B58B30).<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 3 dzinēja eļļas maiņas.";
    const out = oilIntervalNotesWithRequiredNotes(b, text, "lv");
    expect(out).toContain("Eļļas maiņu regularitāte");
    expect(out).toContain("Fiksētas 3 dzinēja eļļas maiņas.");
  });

  it("Renault Megane E-Tech: tikai apkopju intervāli vai tukšs", () => {
    const b = block({ outvinReport: { vehicleInfo: { model: "Megane E-Tech Electric" } } as never });
    expect(oilBlockIsBev(b)).toBe(true);
    expect(oilIntervalNotesWithRequiredNotes(b, "", "lv")).toBe("");
    const text =
      "Ražotāja intervāls: nav droši zināms.<br><br><strong>Eļļas maiņas ieraksti</strong><br>Eļļas maiņas nav fiksētas.<br><br><strong>Regulāro apkopju intervāli</strong><br>Fiksēti 2 apkopes ieraksti.";
    const out = oilIntervalNotesWithRequiredNotes(b, text, "lv");
    expect(out).toBe(
      "Ražotāja intervāls: nav piemērojams (elektroauto).<br><br><strong>Regulāro apkopju intervāli</strong><br>Fiksēti 2 apkopes ieraksti.",
    );
    expect(out).not.toMatch(/eļļ/i);
  });
});
