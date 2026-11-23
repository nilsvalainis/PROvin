import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildAtraPreviews } from "@/lib/atra-prieksskatijums";
import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import { parseCarfaxRecordCheck, vinScanParseFromCarfax } from "@/lib/vin-scan/parse-carfax-eu";

const FIX = path.join(__dirname, "__fixtures__", "carfax-eu");
function fixture(vin: string): { status: number; body: unknown } {
  return JSON.parse(readFileSync(path.join(FIX, `record-check-${vin}.json`), "utf8")) as { status: number; body: unknown };
}
const URL = "https://www.carfax.eu/";

describe("CARFAX.eu record-check (releja Chrome)", () => {
  it("ASV auto Vācijā: 8 ieraksti, EU 1 + US 7, 4 nobraukuma rādījumi", () => {
    const { body } = fixture("WBA5R1C0XLFH42873");
    const d = parseCarfaxRecordCheck(body)!;
    expect(d).toMatchObject({ displayRecords: 8, odometerReadingsCount: 4, usRecords: 7, make: "BMW", presentCountry: "DE" });
    expect(d.recordsPerCountry).toEqual({ eu: 1, us: 7 });
    const p = vinScanParseFromCarfax("found", body, URL);
    expect(p.status).toBe("found");
    expect(p.summary).toBe("8 ieraksti CARFAX priekšskatījumā (US 7, EU 1)");
    expect(p.detail).toContain("Nobraukuma rādījumi: 4");
    expect(p.detail).toContain("ASV vēsture: 7");
  });

  it("Zviedrijas Skoda: 10 ieraksti SE, 5 apskates; baneris rāda skaitu un punktus", () => {
    const { body } = fixture("TMBJH9NP9H7561596");
    const p = vinScanParseFromCarfax("found", body, URL);
    expect(p.summary).toBe("10 ieraksti CARFAX priekšskatījumā (SE 10)");
    expect(p.detail).toContain("Tehniskās apskates: 5");
    const [b] = buildAtraPreviews("TMBJH9NP9H7561596", [
      { id: "carfax_eu", status: p.status, summary: p.summary, detail: p.detail ?? "", openUrl: URL },
    ]);
    expect(b!.headline).toBe("Dati ir: 10 ieraksti");
    expect(b!.items.filter((i) => i.key)).toEqual([
      { label: "Valstis", value: "SE 10", key: true, tone: "ok" },
      { label: "Nobraukums", value: "3", key: true, tone: "ok" },
      { label: "Apskates", value: "5", key: true, tone: "ok" },
    ]);
  });

  it("422 (marka zināma, ierakstu nav) -> none", () => {
    const { status, body } = fixture("WVWZZZ1KZ6W000001");
    expect(status).toBe(422);
    const p = vinScanParseFromCarfax("none", body, URL);
    expect(p.status).toBe("none");
    expect(p.summary).toBe("CARFAX priekšskatījumā ierakstu nav");
  });

  it("Tampermonkey: tukšā priekšskatījuma «We found 0 records» nav rezultāts", () => {
    expect(classifyBrowserProbe("carfax_eu", "Success! We found 0 records for this car.\nVIN:", "WBA5R1C0XLFH42873")).toBeNull();
    expect(classifyBrowserProbe("carfax_eu", "Success! We found 8 records for this car.", "WBA5R1C0XLFH42873")?.status).toBe("found");
  });
});
