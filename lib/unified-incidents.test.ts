import { describe, expect, it } from "vitest";
import {
  aggregateUnifiedIncidents,
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
});
