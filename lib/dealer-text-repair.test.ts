import { describe, expect, it } from "vitest";
import {
  decodeDealerResponseBytes,
  hasDealerTextEncodingDamage,
  repairDealerImportText,
} from "@/lib/dealer-text-repair";
import { formatServiceWorksLines } from "@/lib/service-works-lines";
import { normalizeAutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { normalizeOneautoServiceEvent } from "@/lib/oneauto-catalog";

const R = "\uFFFD";

describe("dīlera importa umlautu labošana", () => {
  it("salabo jau importētu Opel tekstu ar pazaudētiem umlautiem", () => {
    expect(repairDealerImportText(`MOTOR${R}L`)).toBe("MOTORÖL");
    expect(repairDealerImportText(`R${R}DERWECHSEL`)).toBe("RÄDERWECHSEL");
    expect(repairDealerImportText(`SICHERHEITSPRFG ${R} 57`)).toBe("SICHERHEITSPRÜFG § 57");
    expect(repairDealerImportText(`SICHERHEITSPR${R}FG ${R} 57A`)).toBe("SICHERHEITSPRÜFG § 57A");
    expect(repairDealerImportText(`${R}LFILTER ERSETZT`)).toBe("ÖLFILTER ERSETZT");
    expect(repairDealerImportText(`Bremsfl${R}ssigkeit erneuert`)).toBe("Bremsflüssigkeit erneuert");
    expect(repairDealerImportText(`Motor${R}l gewechselt`)).toBe("Motoröl gewechselt");
    expect(repairDealerImportText(`K${R}HLMITTEL`)).toBe("KÜHLMITTEL");
  });

  it("salabo UTF-8 baitus, kas nolasīti kā cp1252", () => {
    expect(repairDealerImportText("MotorÃ¶l und RÃ¤derwechsel Â§ 57")).toBe("Motoröl und Räderwechsel § 57");
  });

  it("izlabo Tansmitter un noņem „_ _.” artefaktus", () => {
    expect(repairDealerImportText("REIFENDRUCK Tansmitter _ _.")).toBe("REIFENDRUCK Transmitter");
    expect(repairDealerImportText("MOTORÖL\n_ _.\nLUFTFILTER")).toBe("MOTORÖL\nLUFTFILTER");
  });

  it("tīru tekstu neaiztiek (idempotents)", () => {
    for (const t of ["Eļļas maiņa, salona filtrs", "BMW MOTORÖL 0W30 LONGL.", "Bremžu šķidruma maiņa", "A_B kods"]) {
      expect(repairDealerImportText(t)).toBe(t);
      expect(repairDealerImportText(repairDealerImportText(t))).toBe(t);
    }
  });

  it("nezināmu bojātu vārdu neizdomā, atstāj AI tulkojumam", () => {
    const out = repairDealerImportText(`W${R}-AE`);
    expect(out).toBe(`W${R}-AE`);
    expect(hasDealerTextEncodingDamage(out)).toBe(true);
  });

  it("formatServiceWorksLines un normalizētāji labo jau saglabātās rindas", () => {
    expect(formatServiceWorksLines(`MOTOR${R}L\nR${R}DERWECHSEL`)).not.toContain(R);
    const row = normalizeAutoRecordsServiceWorkRow({
      date: "12.03.2024",
      odometer: "45000",
      location: `Opel H${R}ndler`,
      works: `SICHERHEITSPRFG ${R} 57, MOTOR${R}L`,
    });
    expect(row.works).toContain("§ 57");
    expect(row.works).toContain("MOTORÖL");
    const ev = normalizeOneautoServiceEvent({
      date: "12.03.2024",
      odometer: "45000",
      place: "Wien",
      works: `R${R}DERWECHSEL`,
    });
    expect(ev.works).toBe("RÄDERWECHSEL");
  });
});

describe("OEM atbildes baitu dekodēšana", () => {
  it("UTF-8 paliek UTF-8", () => {
    const bytes = new TextEncoder().encode('{"w":"MOTORÖL"}');
    expect(decodeDealerResponseBytes(bytes)).toBe('{"w":"MOTORÖL"}');
  });

  it("latin1 / cp1252 baiti bez charset dod umlautus, ne „�”", () => {
    const latin1 = Uint8Array.from([
      ...Array.from('{"w":"MOTOR', (c) => c.charCodeAt(0)),
      0xd6,
      ...Array.from("L R", (c) => c.charCodeAt(0)),
      0xc4,
      ...Array.from("DERWECHSEL ", (c) => c.charCodeAt(0)),
      0xa7,
      ...Array.from(' 57"}', (c) => c.charCodeAt(0)),
    ]);
    const text = decodeDealerResponseBytes(latin1, "application/json");
    expect(text).toBe('{"w":"MOTORÖL RÄDERWECHSEL § 57"}');
    expect(text).not.toContain(R);
  });

  it("ievēro deklarēto charset", () => {
    const bytes = Uint8Array.from([0x4d, 0xd6, 0x4c]);
    expect(decodeDealerResponseBytes(bytes, "application/json; charset=ISO-8859-1")).toBe("MÖL");
  });
});
