import { describe, expect, it } from "vitest";
import {
  formatWaybillDateTime,
  isCsddWaybillText,
  parseCsddWaybill,
  parseCsddWaybillFileName,
  parseCsddWaybillText,
  rigaLocalToUtc,
  waybillIdFromNumber,
  waybillValidityTone,
} from "@/lib/iriss-pavadzimes-parse";

const VOLVO_V50 = `
Transportlīdzekļu tirdzniecības reģistrs

Pavadzīme Nr. P02787

tirdzniecībai paredzēta transportlīdzekļa

lietošanai ceļu satiksmē, izmantojot tirdzniecības numura zīmes

B193-7

2026. gada 14. oktobris, plkst. 09:59 SMĀRDES PAGASTS, TUKUMA

NOVADS

Komersants:
SABIEDRĪBA AR IEROBEŽOTU

ATBILDĪBU "ĪRISS"

Transportlīdzeklis:
Marka, modelis VOLVO V50

Pavadzīmes derīguma termiņš: 14.10.2026. plkst. 15:59
`;

const VW_TIGUAN = `
Pavadzīme Nr. P02515
tirdzniecībai paredzēta transportlīdzekļa
lietošanai ceļu satiksmē, izmantojot tirdzniecības numura zīmes
B861-6
2026. gada 12. jūnijs, plkst. 12:24 SMĀRDES PAGASTS
Marka, modelis VW TIGUAN
Pavadzīmes derīguma termiņš: 14.06.2026. plkst. 12:24
`;

const WITH_VIN = `
Pavadzīme Nr. P00999
tirdzniecības numura zīmes
B100-7
Marka, modelis BMW 320D
VIN: WBA8E31000A123456
2026. gada 01. marts, plkst. 08:00
Pavadzīmes derīguma termiņš: 02.03.2026. plkst. 08:00
`;

describe("CSDD pavadzīmes parsēšana", () => {
  it("izvelk P02787 Volvo V50 laukus", () => {
    const p = parseCsddWaybill(VOLVO_V50, "P02787_Volvo_V50_B193-7.pdf");
    expect(p.number).toBe("P02787");
    expect(p.brandModel).toBe("VOLVO V50");
    expect(p.plate).toBe("B193-7");
    expect(p.vin).toBe("");
    expect(p.validUntil).toBe(rigaLocalToUtc(2026, 10, 14, 15, 59)?.toISOString());
    expect(p.issuedAt).toBe(rigaLocalToUtc(2026, 10, 14, 9, 59)?.toISOString());
  });

  it("izvelk jūnija izdošanas datumu", () => {
    const p = parseCsddWaybillText(VW_TIGUAN);
    expect(p.number).toBe("P02515");
    expect(p.brandModel).toBe("VW TIGUAN");
    expect(p.plate).toBe("B861-6");
    expect(p.issuedAt).toBe(rigaLocalToUtc(2026, 6, 12, 12, 24)?.toISOString());
    expect(p.validUntil).toBe(rigaLocalToUtc(2026, 6, 14, 12, 24)?.toISOString());
  });

  it("atpazīst VIN, ja tas ir tekstā", () => {
    expect(parseCsddWaybillText(WITH_VIN).vin).toBe("WBA8E31000A123456");
  });

  it("atpazīst faila nosaukumu ar marku un numuru", () => {
    const p = parseCsddWaybillFileName("P02777_VW_T-ROC_B193-7.pdf");
    expect(p.number).toBe("P02777");
    expect(p.brandModel).toBe("VW T-ROC");
    expect(p.plate).toBe("B193-7");
  });

  it("atpazīst tikai numuru faila nosaukumā", () => {
    expect(parseCsddWaybillFileName("P02515.pdf")).toEqual({ number: "P02515" });
  });

  it("neuzskata svešu PDF par pavadzīmi", () => {
    expect(isCsddWaybillText("Audi A6 C7 BI-TURBO Sline Romāns")).toBe(false);
    expect(isCsddWaybillText(VOLVO_V50)).toBe(true);
  });

  it("krāso derīgumu: beidzies / šodien / ok", () => {
    const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;
    expect(waybillValidityTone(rigaLocalToUtc(2026, 10, 14, 15, 59)!.toISOString(), now)).toBe("today");
    expect(waybillValidityTone(rigaLocalToUtc(2026, 10, 14, 11, 0)!.toISOString(), now)).toBe("expired");
    expect(waybillValidityTone(rigaLocalToUtc(2026, 10, 16, 15, 59)!.toISOString(), now)).toBe("ok");
    expect(waybillValidityTone("", now)).toBe("unknown");
  });

  it("formatē operatora datumu bez gada, ja tas ir šis gads", () => {
    const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;
    const iso = rigaLocalToUtc(2026, 10, 14, 15, 59)!.toISOString();
    expect(formatWaybillDateTime(iso, now)).toBe("14.10 15:59");
    const prev = rigaLocalToUtc(2025, 6, 14, 12, 24)!.toISOString();
    expect(formatWaybillDateTime(prev, now)).toBe("14.06.2025 12:24");
  });

  it("veido id no pavadzīmes numura", () => {
    expect(waybillIdFromNumber("P02787", "")).toBe("p02787");
    expect(waybillIdFromNumber("", "manual-1")).toBe("manual-1");
  });
});
