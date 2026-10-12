import { describe, expect, it } from "vitest";

import { parseCsddTechDataXml } from "@/lib/csdd-tech-data";
import {
  VIN_SCAN_BROWSER_CATALOG,
  VIN_SCAN_CATALOG,
  resolveVinScanOpenUrl,
  vinScanAllCatalog,
} from "@/lib/vin-scan/catalog";
import {
  buildVinScanManualOrderNotes,
  buildVinScanManualOrderSeed,
  parseCsddTechDataFromUnknown,
  parseVinScanManualOrderInput,
} from "@/lib/vin-scan/manual-order-seed";

const VIN = "TMBJH9NP9N7043581";

const SAMPLE_XML = `<?xml version="1.0"?>
<TL_DATI>
  <RN>NG8493</RN>
  <VIN>TMBJH9NP9N7043581</VIN>
  <MARKA>SKODA</MARKA>
  <MODELIS>SUPERB</MODELIS>
  <GADS>2012</GADS>
  <DEGVIELA>Dizeļdegviela</DEGVIELA>
  <JAUDA>110</JAUDA>
  <TILPUMS>1968</TILPUMS>
  <REG1>22082022</REG1>
  <TA_LIDZ>22082024</TA_LIDZ>
</TL_DATI>`;

describe("vin scan open URLs", () => {
  it("katram avotam ir šī VIN meklēšanas vai rezultāta URL", () => {
    const catalog = vinScanAllCatalog();
    expect(catalog.length).toBe(VIN_SCAN_CATALOG.length + VIN_SCAN_BROWSER_CATALOG.length);
    for (const item of catalog) {
      const url = item.openUrl(VIN);
      expect(url).toMatch(/^https:\/\//);
      expect(url.toUpperCase()).toContain(VIN);
      expect(resolveVinScanOpenUrl(item, VIN, null)).toBe(url);
    }
    expect(resolveVinScanOpenUrl(VIN_SCAN_CATALOG[0]!, VIN, "https://lot.example/abc")).toBe(
      "https://lot.example/abc",
    );
  });
});

describe("vin scan manual order seed", () => {
  const parsed = parseCsddTechDataXml(SAMPLE_XML);
  const csdd = parsed.found ? parsed.data : null;

  it("aizpilda VIN, CSDD, marku/gadu, nobraukumu un avotu saites", () => {
    expect(csdd).not.toBeNull();
    const seed = buildVinScanManualOrderSeed({
      vin: VIN.toLowerCase(),
      plate: "ng8493",
      plateStatus: "TA līdz 2024-08-22",
      csdd,
      vehicle: { make: "SKODA", model: "SUPERB", year: "2012" },
      mileage: [{ date: "2025-08-22", odometer: "385 537 km", source: "esyn.dk" }],
      scannedAt: "2026-10-12T09:00:00.000Z",
      sources: [
        {
          id: "tjekbil",
          label: "tjekbil.dk",
          country: "DK",
          status: "found",
          summary: "2012 SKODA SUPERB",
          openUrl: `https://www.tjekbil.dk/?vin=${VIN}`,
        },
        {
          id: "autodna_preview",
          label: "AutoDNA",
          country: "EU",
          status: "none",
          summary: "AutoDNA priekšskatījumā datu nav",
          openUrl: `https://www.autodna.lv/vin/${VIN}`,
        },
      ],
    });

    expect(seed.orderEdits.vin).toBe(VIN);
    expect(seed.orderEdits.notes).toContain(VIN);
    expect(seed.orderEdits.notes).toContain("NG8493");
    expect(seed.orderEdits.notes).toContain("SKODA SUPERB");
    expect(seed.orderEdits.notes).toContain("https://www.tjekbil.dk/?vin=");
    expect(seed.orderEdits.notes).toContain("https://www.autodna.lv/vin/");
    expect(seed.orderEdits.notes).toContain("AutoDNA");
    expect(seed.orderEdits.mileageComment).toContain("385 537 km");
    expect(seed.orderEdits.internalComment).toContain("Avoti:");

    const block = seed.workspace.sourceBlocks as { csdd: { vin: string; makeModel: string; registrationNumber: string; modelYear: string } };
    expect(block.csdd.vin).toBe(VIN);
    expect(block.csdd.registrationNumber).toBe("NG8493");
    expect(block.csdd.makeModel.toUpperCase()).toContain("SKODA");
    expect(block.csdd.modelYear).toBe("2012");
  });

  it("bez CSDD ņem marku no skenēšanas un VIN lauku", () => {
    const seed = buildVinScanManualOrderSeed({
      vin: VIN,
      vehicle: { make: "Volkswagen", model: "Golf", year: "2012" },
      sources: [
        {
          id: "nhtsa",
          label: "NHTSA",
          status: "found",
          summary: "2012 Volkswagen Golf",
          openUrl: `https://vpic.nhtsa.dot.gov/decoder/VinDecoder?VIN=${VIN}`,
          vehicle: { make: "Volkswagen", model: "Golf", year: "2012" },
        },
      ],
    });
    const block = seed.workspace.sourceBlocks as { csdd: { vin: string; makeModel: string; modelYear: string } };
    expect(block.csdd.vin).toBe(VIN);
    expect(block.csdd.makeModel).toBe("Volkswagen Golf");
    expect(block.csdd.modelYear).toBe("2012");
    expect(seed.orderEdits.notes).toContain("Volkswagen Golf");
  });

  it("noraida nederīgu VIN un pieņem CSDD JSON", () => {
    expect(parseVinScanManualOrderInput({ vin: "ABC" })).toBeNull();
    const input = parseVinScanManualOrderInput({
      vin: VIN,
      plate: "NG8493",
      csdd: parseCsddTechDataFromUnknown(csdd),
    });
    expect(input?.vin).toBe(VIN);
    expect(input?.plate).toBe("NG8493");
    expect(input?.csdd?.make).toBe("SKODA");
  });

  it("nopirkto CarVertical atskaiti ievieto avota blokā", () => {
    const reportUrl = "https://www.carvertical.com/lv/report/abc123";
    const seed = buildVinScanManualOrderSeed({
      vin: VIN,
      sources: [
        {
          id: "carvertical_preview",
          label: "CarVertical",
          status: "found",
          summary: "CarVertical atskaite nopirkta",
          openUrl: reportUrl,
          purchased: true,
          detail: "Nobraukums 185 000 km",
        },
      ],
    });
    const block = seed.workspace.sourceBlocks as {
      carvertical: { comments: string; aiContextRaw: string };
    };
    expect(block.carvertical.comments).toContain("nopirkta");
    expect(block.carvertical.comments).toContain(reportUrl);
    expect(block.carvertical.aiContextRaw).toContain("185 000 km");
  });

  it("priekšskatījumu bez pirkuma neliek kā nopirktu atskaiti", () => {
    const seed = buildVinScanManualOrderSeed({
      vin: VIN,
      sources: [
        {
          id: "carvertical_preview",
          label: "CarVertical",
          status: "found",
          summary: "CarVertical rāda priekšskatījumu. Pirkums paliek operatoram",
          openUrl: `https://www.carvertical.com/lv/user/reports?vin=${VIN}`,
        },
      ],
    });
    const block = seed.workspace.sourceBlocks as {
      carvertical: { comments: string; aiContextRaw: string };
    };
    expect(block.carvertical.comments).toBe("");
    expect(block.carvertical.aiContextRaw).toContain("priekšskatījums");
    expect(block.carvertical.aiContextRaw).not.toContain("nopirkta");
  });

  it("piezīmēs iekļauj arī avotus bez rezultāta", () => {
    const notes = buildVinScanManualOrderNotes({
      vin: VIN,
      sources: [
        {
          id: "cebia",
          label: "Cebia",
          status: "idle",
          openUrl: `https://en.cebia.com/?vin=${VIN}`,
        },
      ],
    });
    expect(notes).toContain("Cebia");
    expect(notes).toContain("Gaida");
    expect(notes).toContain(`https://en.cebia.com/?vin=${VIN}`);
  });
});
