import { describe, expect, it } from "vitest";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
  formatIncidentSourceValuationsLine,
  formatUnifiedIncidentCountLabel,
  type UnifiedIncidentRow,
} from "@/lib/unified-incidents";

function row(partial: Partial<UnifiedIncidentRow> & Pick<UnifiedIncidentRow, "date" | "lossAmount" | "sourceLabel">): UnifiedIncidentRow {
  return {
    country: "Latvija",
    sortableTime: Date.UTC(2021, 5, 16),
    sourceOrder: 0,
    ...partial,
  };
}

describe("aggregateUnifiedIncidents", () => {
  it("apvieno to pašu datumu un valsti no dažādiem avotiem un rēķina vidējo summu", () => {
    const agg = aggregateUnifiedIncidents([
      row({
        date: "16.06.2021",
        lossAmount: "2 800 €",
        sourceLabel: "AutoDNA",
        sourceOrder: 0,
      }),
      row({
        date: "16.06.2021",
        lossAmount: "2 778.22 €",
        sourceLabel: "LTAB",
        sourceOrder: 1,
        sortableTime: Date.UTC(2021, 5, 16),
      }),
    ]);
    expect(agg.rawCount).toBe(2);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters).toHaveLength(1);
    expect(agg.clusters[0]?.averaged).toBe(true);
    expect(agg.clusters[0]?.averageEur).toBe(2789);
    expect(agg.clusters[0]?.displayAmount).toBe("2 789 €");
    expect(agg.clusters[0]?.date).toBe("16.06.2021");
    expect(agg.clusters[0]?.sourceValuations).toEqual([
      { sourceLabel: "AutoDNA", displayAmount: "2 800 €", amountEur: 2800 },
      { sourceLabel: "LTAB", displayAmount: "2 778.22 €", amountEur: 2778 },
    ]);
    expect(formatIncidentSourceValuationsLine(agg.clusters[0]!)).toBe(
      "AutoDNA 2 800 € · LTAB 2 778.22 €",
    );
  });

  it("apvieno viena mēneša ierakstus no dažādiem avotiem par vienu negadījumu", () => {
    const agg = aggregateUnifiedIncidents([
      row({
        date: "01.06.2021",
        lossAmount: "3 501 - 4 000 €",
        sourceLabel: "AutoDNA",
        sortableTime: Date.UTC(2021, 5, 1),
        sourceOrder: 0,
      }),
      row({
        date: "16.06.2021",
        lossAmount: "2 778 €",
        sourceLabel: "LTAB",
        sortableTime: Date.UTC(2021, 5, 16),
        sourceOrder: 1,
      }),
      row({
        date: "20.10.2020",
        lossAmount: "1 599 €",
        sourceLabel: "LTAB",
        sortableTime: Date.UTC(2020, 9, 20),
        sourceOrder: 2,
      }),
    ]);
    expect(agg.uniqueCount).toBe(2);
    expect(agg.clusters[0]?.date).toBe("06.2021");
    expect(agg.clusters[0]?.averaged).toBe(true);
    expect(agg.clusters[1]?.date).toBe("20.10.2020");
    expect(agg.clusters[1]?.averaged).toBe(false);
  });

  it("AutoDNA vairākas rindas tajā pašā mēnesī nesaskaita kā atsevišķus negadījumus", () => {
    const agg = aggregateUnifiedIncidents([
      row({
        date: "01.06.2021",
        lossAmount: "3 500 €",
        sourceLabel: "AutoDNA",
        sortableTime: Date.UTC(2021, 5, 1),
        sourceOrder: 0,
      }),
      row({
        date: "15.06.2021",
        lossAmount: "1 200 €",
        sourceLabel: "AutoDNA",
        sortableTime: Date.UTC(2021, 5, 15),
        sourceOrder: 1,
      }),
      row({
        date: "16.06.2021",
        lossAmount: "2 778 €",
        sourceLabel: "LTAB",
        sortableTime: Date.UTC(2021, 5, 16),
        sourceOrder: 2,
      }),
    ]);
    expect(agg.rawCount).toBe(3);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations).toHaveLength(2);
    const autodna = agg.clusters[0]?.sourceValuations.find((s) => s.sourceLabel === "AutoDNA");
    expect(autodna?.amountEur).toBe(2350);
  });

  it("nesapludina dažādu valstu ierakstus vienā mēnesī", () => {
    const t = Date.UTC(2022, 4, 27);
    const agg = aggregateUnifiedIncidents([
      row({ date: "27.05.2022", lossAmount: "1200", country: "LV", sourceLabel: "LTAB", sortableTime: t, sourceOrder: 0 }),
      row({
        date: "27.05.2022",
        lossAmount: "5000",
        country: "Vācija",
        sourceLabel: "AutoDNA",
        sortableTime: t,
        sourceOrder: 1,
      }),
    ]);
    expect(agg.uniqueCount).toBe(2);
  });

  it("normalizē LV un Latvija kā vienu valsti", () => {
    const t = Date.UTC(2021, 5, 16);
    const agg = aggregateUnifiedIncidents([
      row({ date: "16.06.2021", lossAmount: "1000", country: "LV", sourceLabel: "AutoDNA", sortableTime: t, sourceOrder: 0 }),
      row({ date: "16.06.2021", lossAmount: "2000", country: "Latvija", sourceLabel: "LTAB", sortableTime: t, sourceOrder: 1 }),
    ]);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.averageEur).toBe(1500);
    expect(agg.clusters[0]?.country).toBe("Latvija");
  });

  it("piesaista bojājumu zonas pēc mēneša un valsts", () => {
    const agg = aggregateUnifiedIncidents(
      [
        row({
          date: "01.10.2020",
          lossAmount: "1 300 - 1 400 €",
          country: "Latvija",
          sourceLabel: "AutoDNA",
          sortableTime: Date.UTC(2020, 9, 1),
          sourceOrder: 0,
        }),
      ],
      [
        {
          date: "01.10.2020",
          country: "Latvija",
          lossAmount: "1 300 - 1 400 €",
          damagedSides: "Priekšpuse Labā sāna priekšpuse Kreisā sāna priekšpuse",
          damageGroups: "Virsbūves ārējās daļas",
        },
      ],
    );
    expect(agg.clusters[0]?.damage?.zoneIds.sort()).toEqual(["front", "front_left", "front_right"]);
    expect(agg.clusters[0]?.damage?.groupLabels).toEqual(["Virsbūves ārējās daļas"]);
  });

  it("attīra salīmētas grupas un kopsavilkuma noplūdi", () => {
    const agg = aggregateUnifiedIncidents(
      [
        row({
          date: "01.05.2022",
          lossAmount: "1 501 - 2 000 €",
          country: "Latvija",
          sourceLabel: "CarVertical",
          sortableTime: Date.UTC(2022, 4, 1),
          sourceOrder: 0,
        }),
      ],
      [
        {
          date: "01.05.2022",
          country: "Latvija",
          lossAmount: "1 501 - 2 000 €",
          damagedSides: "Kreisā sāna priekšpuse Aizmugure",
          damageGroups:
            "Virsbūves ārējās daļas Ārējās virsbūves detaļas 01 1 līdzīgs ieraksts NEGADĪJUMU VĒSTURES KOPSAVILKUMS Fiksētie incidenti un datu saskaņotība AutoDNA",
        },
      ],
    );
    expect(agg.clusters[0]?.damage?.groupLabels).toEqual([
      "Virsbūves ārējās daļas",
      "Ārējās virsbūves detaļas",
    ]);
  });
});

describe("collectUnifiedIncidentRows + count label", () => {
  it("ievāc AutoDNA un LTAB rindas ar summu", () => {
    const rows = collectUnifiedIncidentRows({
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "16.06.2021", lossAmount: "1200", incidentNo: "LV" }],
          comments: "",
        },
      ],
      manualLtabBlock: {
        rows: [{ csngDate: "16.06.2021", lossAmount: "1500", incidentNo: "Latvija" }],
        comments: "",
      },
    });
    expect(rows).toHaveLength(2);
    const agg = aggregateUnifiedIncidents(rows);
    expect(agg.uniqueCount).toBe(1);
    expect(formatUnifiedIncidentCountLabel(1)).toBe("1 negadījums");
    expect(formatUnifiedIncidentCountLabel(2)).toBe("2 negadījumi");
  });

  it("hidratē bojājumu zonas no AutoDNA RAW, ja damageDetails nav saglabāti", () => {
    const details = collectUnifiedIncidentDamageDetails([
      {
        title: "AutoDNA",
        mileageRows: [],
        incidentRows: [{ csngDate: "01.10.2020", lossAmount: "1 300 - 1 400 €", incidentNo: "Latvija" }],
        comments: "",
        sourceRaw: `
10.2020
Transportlīdzekļa zaudējumu apjoms
Summa 1 300 - 1 400 EUR
Rezultāts VIRSBŪVES BOJĀJUMS
Detaļu grupa - Virsbūves ārējās daļas
Valsts Latvija
Bojājumu zona
- Priekšpuse
- Labā sāna priekšpuse
- Kreisā sāna priekšpuse
`,
      },
    ]);
    expect(details).toHaveLength(1);
    expect(details[0]?.damagedSides).toMatch(/Priekšpuse/);
    const rows = collectUnifiedIncidentRows({
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.10.2020", lossAmount: "1 300 - 1 400 €", incidentNo: "Latvija" }],
          comments: "",
        },
      ],
    });
    const agg = aggregateUnifiedIncidents(rows, details);
    expect(agg.clusters[0]?.damage?.zoneIds.sort()).toEqual(["front", "front_left", "front_right"]);
  });

  it("hidratē CarVertical Bojātās detaļas no RAW, ignorējot kājenes datumu", () => {
    const details = collectUnifiedIncidentDamageDetails([
      {
        title: "CarVertical",
        mileageRows: [],
        incidentRows: [{ csngDate: "01.07.2012", lossAmount: "2001 € – 2500 €", incidentNo: "Vācija" }],
        comments: "",
        sourceRaw: `
VIN numurs: WBAVT11010KW00321 Ģenerēšanas datums: 18.08.2026
07.2012. Vācija
Novērtējums
Bojātās detaļas
Labā priekšējā daļa / Buferis Labā puse / Priekšējās durvis
Aptuvenā iepriekš gūto bojājumu vērtība
2001 € – 2500 €
Bojājumu grupas
Ārējās virsbūves detaļas
10.2015. Vācija
Novērtējums
Bojātās detaļas
Fiksēti bojājumi, taču nav atzīmētas bojātās detaļas
Aptuvenā iepriekš gūto bojājumu vērtība
1001 € – 1500 €
`,
      },
    ]);
    expect(details).toHaveLength(1);
    expect(details[0]?.date).toBe("01.07.2012");
    expect(details[0]?.damagedSides).toMatch(/Labā priekšējā daļa/i);
    const rows = collectUnifiedIncidentRows({
      manualVendorBlocks: [
        {
          title: "CarVertical",
          mileageRows: [],
          incidentRows: [
            { csngDate: "01.07.2012", lossAmount: "2001 € – 2500 €", incidentNo: "Vācija" },
            { csngDate: "01.10.2015", lossAmount: "1001 € – 1500 €", incidentNo: "Vācija" },
          ],
          comments: "",
        },
      ],
    });
    const agg = aggregateUnifiedIncidents(rows, details);
    const y2012 = agg.clusters.find((c) => c.date.includes("2012"));
    const y2015 = agg.clusters.find((c) => c.date.includes("2015"));
    expect(y2012?.damage?.zoneIds.sort()).toEqual(["front_right", "right"]);
    expect(y2015?.damage).toBeNull();
  });

  it("summē divus CarVertical ierakstus vienā mēnesī par vienu negadījumu", () => {
    const t = Date.UTC(2023, 10, 1);
    const agg = aggregateUnifiedIncidents([
      row({
        date: "01.11.2023",
        lossAmount: "2001 € – 2500 €",
        sourceLabel: "CarVertical",
        sortableTime: t,
        sourceOrder: 0,
      }),
      row({
        date: "01.11.2023",
        lossAmount: "2501 € – 3000 €",
        sourceLabel: "CarVertical",
        sortableTime: t,
        sourceOrder: 1,
      }),
      row({
        date: "01.11.2023",
        lossAmount: "2 516.91 €",
        sourceLabel: "LTAB",
        sortableTime: t,
        sourceOrder: 2,
      }),
    ]);
    expect(agg.uniqueCount).toBe(1);
    const cv = agg.clusters[0]?.sourceValuations.find((s) => s.sourceLabel === "CarVertical");
    expect(cv?.amountEur).toBe(5002);
    expect(cv?.displayAmount).toBe("5 002 €");
  });

  it("neskaita divreiz identisku CarVertical rindu", () => {
    const t = Date.UTC(2023, 10, 1);
    const agg = aggregateUnifiedIncidents([
      row({ date: "01.11.2023", lossAmount: "2001 € – 2500 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 0 }),
      row({ date: "01.11.2023", lossAmount: "2001 € – 2500 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 1 }),
    ]);
    expect(agg.clusters[0]?.sourceValuations[0]?.amountEur).toBe(2251);
  });
});
