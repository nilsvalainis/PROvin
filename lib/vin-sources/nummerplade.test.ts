import { describe, expect, it } from "vitest";
import { mapNummerpladePayload } from "@/lib/vin-sources/nummerplade";

const SAMPLE = {
  ok: true,
  koeretoej: {
    maerke: "Volkswagen",
    model: "Sharan",
    nummerplade: "CM53865",
    stelnummer: "WVWZZZ7NZEV015204",
    status: "Afmeldt",
    status_dato: "2019-11-11",
    omregistreret: "12-08-2026",
    foerste_registrering: "2013-12-18",
    "1_registrering": "18-12-2013",
    registrering_status_ord: "Registreret",
    anvendelse: "Privat personkørsel",
    drivmiddel: "Diesel",
    effekt: "177 HK (130 kW) · Forhjulstrukket",
    euronorm: "Euro V",
    partikelfilter: "Ja",
    udstyr: ["Automatgear", "Turbo", "ABS-bremser"],
    forsikring: {
      aktuel: { selskab: "GF-FORSIKRING A/S", status: "Ophørt", dato: "12-08-2026" },
      historik: [{ selskab: "KØBSTÆDERNES FORS.", status: "Aktiv", dato: "18-12-2017" }],
    },
  },
};

describe("mapNummerpladePayload", () => {
  it("maps Gratis Cache fields: status, first reg, Automatgear — not insurance-as-owners", () => {
    const mapped = mapNummerpladePayload(SAMPLE);
    expect(mapped.found).toBe(true);
    expect(mapped.message).toMatch(/CM53865/);
    expect(mapped.ownersSummary).toMatch(/Pirmā reģistrācija: 18\.12\.2013/);
    expect(mapped.ownersSummary).toMatch(/noņemts no uzskaites/);
    expect(mapped.ownersSummary).toMatch(/12\.08\.2026/);
    expect(mapped.ownersSummary).not.toMatch(/īpašnieki \(nummerplade/);
    expect(mapped.timeline.some((r) => r.event === "Pirmā reģistrācija" && r.date === "2013-12-18")).toBe(true);
    expect(mapped.timeline.some((r) => r.date === "2026-08-12" && /noņemts no uzskaites/.test(r.event))).toBe(true);
    expect(mapped.statusRecords).toMatch(/Automatgear|automāts/);
    expect(mapped.statusRecords).toMatch(/Euro V/);
    expect(mapped.notes.join(" ")).toMatch(/Gratis Cache/);
    expect(mapped.mileage).toEqual([]);
  });

  it("reads owner count and syns when the paid payload includes them", () => {
    const mapped = mapNummerpladePayload({
      ok: true,
      koeretoej: {
        ...SAMPLE.koeretoej,
        antalEjere: 4,
        synsrapporter: [
          { synsdato: "28-01-2026", kategori: "Periodisk syn", synsresultat: "Godkendt", kmstand: 188528 },
        ],
      },
    });
    expect(mapped.ownersSummary).toMatch(/4 īpašnieki/);
    expect(mapped.mileage[0]?.odometer).toBe("188528");
  });
});
