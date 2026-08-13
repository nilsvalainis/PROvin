import { describe, expect, it } from "vitest";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentRows,
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
    expect(agg.clusters[0]?.sources).toEqual(["AutoDNA", "LTAB"]);
    expect(agg.clusters[0]?.displayAmount).toBe("2 789 €");
    expect(agg.bySource).toHaveLength(2);
    expect(agg.bySource[0]).toMatchObject({ sourceLabel: "AutoDNA", count: 1, averageEur: 2800 });
    expect(agg.bySource[1]).toMatchObject({ sourceLabel: "LTAB", count: 1, averageEur: 2778 });
  });

  it("neatņem divas viena avota rindas tajā pašā dienā", () => {
    const t = Date.UTC(2020, 9, 20);
    const agg = aggregateUnifiedIncidents([
      row({ date: "20.10.2020", lossAmount: "1 599 €", sourceLabel: "LTAB", sortableTime: t, sourceOrder: 0 }),
      row({ date: "20.10.2020", lossAmount: "400 €", sourceLabel: "LTAB", sortableTime: t, sourceOrder: 1 }),
    ]);
    expect(agg.uniqueCount).toBe(2);
    expect(agg.clusters.every((c) => !c.averaged)).toBe(true);
  });

  it("nesapludina dažādu valstu ierakstus vienā datumā", () => {
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
