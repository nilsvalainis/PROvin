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
  it("apvieno to pašu datumu un valsti no dažādiem avotiem bez vidējā", () => {
    const agg = aggregateUnifiedIncidents([
      row({
        date: "16.06.2021",
        lossAmount: "2 800 €",
        sourceLabel: "AutoDNA",
        sourceOrder: 0,
      }),
      row({
        date: "16.06.2021",
        lossAmount: "2 778,22 €",
        sourceLabel: "LTAB",
        sourceOrder: 1,
        sortableTime: Date.UTC(2021, 5, 16),
      }),
    ]);
    expect(agg.rawCount).toBe(2);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters).toHaveLength(1);
    expect(agg.clusters[0]?.averaged).toBe(false);
    expect(agg.clusters[0]?.averageEur).toBeNull();
    expect(agg.clusters[0]?.displayAmount).toBe("2 778 - 2 800 €");
    expect(agg.clusters[0]?.date).toBe("16.06.2021");
    expect(agg.clusters[0]?.kindLabel).toBe("Negadījums");
    expect(agg.clusters[0]?.sourceValuations).toEqual([
      {
        sourceLabel: "AutoDNA",
        displayAmount: "2 800 €",
        amountEur: 2800,
        amountBounds: { lo: 2800, hi: 2800 },
        rowCount: 1,
      },
      {
        sourceLabel: "LTAB",
        displayAmount: "2 778,22 €",
        amountEur: 2778,
        amountBounds: { lo: 2778, hi: 2778 },
        rowCount: 1,
      },
    ]);
    expect(formatIncidentSourceValuationsLine(agg.clusters[0]!)).toBe(
      "AutoDNA 2 800 € · LTAB 2 778,22 €",
    );
  });

  it("viena mēneša dažādu avotu ierakstus ar nesakrītošu summu un dienu skaita atsevišķi", () => {
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
    // 19.11: AutoDNA 3 501 - 4 000 € un LTAB 2 778 € nesakrīt ne dienā, ne summā -> divi negadījumi.
    expect(agg.uniqueCount).toBe(3);
    expect(agg.clusters.map((c) => [c.date, c.displayAmount])).toEqual([
      ["16.06.2021", "2 778 €"],
      ["01.06.2021", "3 501 - 4 000 €"],
      ["20.10.2020", "1 599 €"],
    ]);
    expect(agg.clusters.every((c) => c.averaged === false)).toBe(true);
  });

  it("AutoDNA divas dažādas rindas tajā pašā mēnesī ir divi negadījumi (Nila lēmums 19.11)", () => {
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
    expect(agg.uniqueCount).toBe(3);
    expect(agg.clusters.every((c) => c.sourceValuations.length === 1)).toBe(true);
  });

  it("divi dažādi negadījumi tajā pašā mēnesī un valstī ir 2, nevis 1", () => {
    const agg = aggregateUnifiedIncidents([
      row({ date: "05.03.2022", lossAmount: "800 €", sourceLabel: "LTAB", sortableTime: Date.UTC(2022, 2, 5), sourceOrder: 0 }),
      row({ date: "24.03.2022", lossAmount: "2 400 €", sourceLabel: "LTAB", sortableTime: Date.UTC(2022, 2, 24), sourceOrder: 1 }),
    ]);
    expect(agg.uniqueCount).toBe(2);
    expect(formatUnifiedIncidentCountLabel(agg.uniqueCount, "accident")).toBe("2 negadījumi");
  });

  it("to pašu negadījumu no AutoDNA un CarVertical (mēneša precizitāte, summas pārklājas) skaita vienreiz", () => {
    const t = Date.UTC(2022, 2, 1);
    const agg = aggregateUnifiedIncidents([
      row({ date: "03.2022", lossAmount: "1 300 - 1 400 €", sourceLabel: "AutoDNA", sortableTime: t, sourceOrder: 0 }),
      row({ date: "03.2022", lossAmount: "1 001 - 1 500 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 1 }),
    ]);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations.map((s) => s.sourceLabel)).toEqual(["AutoDNA", "CarVertical"]);
  });

  it("LTAB precīzā summa pievienojas tam AutoDNA ierakstam, kura diapazonam tā atbilst", () => {
    const agg = aggregateUnifiedIncidents([
      row({ date: "01.06.2021", lossAmount: "3 501 - 4 000 €", sourceLabel: "AutoDNA", sortableTime: Date.UTC(2021, 5, 1), sourceOrder: 0 }),
      row({ date: "01.06.2021", lossAmount: "1 001 - 1 500 €", sourceLabel: "AutoDNA", sortableTime: Date.UTC(2021, 5, 1), sourceOrder: 1 }),
      row({ date: "16.06.2021", lossAmount: "1 412,50 €", sourceLabel: "LTAB", sortableTime: Date.UTC(2021, 5, 16), sourceOrder: 2 }),
    ]);
    expect(agg.uniqueCount).toBe(2);
    const withLtab = agg.clusters.find((c) => c.sourceValuations.some((s) => s.sourceLabel === "LTAB"));
    expect(withLtab?.sourceValuations.find((s) => s.sourceLabel === "AutoDNA")?.displayAmount).toBe("1 001 - 1 500 €");
    expect(withLtab?.kindLabel).toBe("Negadījums");
  });

  it("bojājumu zona sasaista divus avotus, ja summas nav salīdzināmas", () => {
    const t = Date.UTC(2020, 9, 1);
    const agg = aggregateUnifiedIncidents(
      [
        row({ date: "01.10.2020", lossAmount: "1 300 - 1 400 €", sourceLabel: "AutoDNA", sortableTime: t, sourceOrder: 0 }),
        row({ date: "01.10.2020", lossAmount: "2 501 - 3 000 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 1 }),
      ],
      [
        { date: "01.10.2020", country: "Latvija", lossAmount: "1 300 - 1 400 €", damagedSides: "Priekšpuse", damageGroups: "" },
        { date: "01.10.2020", country: "Latvija", lossAmount: "2 501 - 3 000 €", damagedSides: "Priekšpuse", damageGroups: "" },
      ],
    );
    expect(agg.uniqueCount).toBe(1);
  });

  it("apvieno 1 mēneša logā to pašu summu un zonas pat ja valsts atšķiras", () => {
    const agg = aggregateUnifiedIncidents([
      row({
        date: "10.03.2023",
        lossAmount: "4 200 €",
        country: "ASV",
        sourceLabel: "ASV",
        sortableTime: Date.UTC(2023, 2, 10),
        sourceOrder: 0,
      }),
      row({
        date: "18.03.2023",
        lossAmount: "4 200 €",
        country: "Kanāda",
        sourceLabel: "CarVertical",
        sortableTime: Date.UTC(2023, 2, 18),
        sourceOrder: 1,
      }),
    ]);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations).toHaveLength(2);
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
    expect(agg.clusters[0]?.averageEur).toBeNull();
    expect(agg.clusters[0]?.displayAmount).toBe("1 000 - 2 000 €");
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
    expect(agg.clusters[0]?.damage?.partLabels).toEqual([]);
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
    expect(agg.clusters[0]?.damage?.groupLabels).toEqual(["Virsbūves ārējās daļas"]);
  });

  it("apkopo AutoDNA zonas un CarVertical detaļas vienā C slāņu kartē", () => {
    const agg = aggregateUnifiedIncidents(
      [
        row({
          date: "01.11.2011",
          lossAmount: "4 500 - 4 750 €",
          country: "Vācija",
          sourceLabel: "AutoDNA",
          sortableTime: Date.UTC(2011, 10, 1),
          sourceOrder: 0,
        }),
        row({
          date: "01.11.2011",
          lossAmount: "4 500 - 5 000 €",
          country: "Vācija",
          sourceLabel: "CarVertical",
          sortableTime: Date.UTC(2011, 10, 1),
          sourceOrder: 1,
        }),
      ],
      [
        {
          date: "01.11.2011",
          country: "Vācija",
          lossAmount: "4 500 - 4 750 €",
          damagedSides: "Aizmugure Kreisā sāna",
          damageGroups: "Virsbūves ārējās daļas Transportlīdzekļu apgaismojums",
        },
        {
          date: "01.11.2011",
          country: "Vācija",
          lossAmount: "4 500 - 5 000 €",
          damagedSides: "Kreisā aizmugurējā daļa / BuferisAizmugure Buferis",
          damageGroups: "Ārējās virsbūves detaļas Ārējais apgaismojums",
        },
      ],
    );
    const dmg = agg.clusters[0]?.damage;
    expect(dmg?.zoneIds.sort()).toEqual(["left", "rear", "rear_left"]);
    expect(dmg?.partLabels).toEqual(expect.arrayContaining(["Kreisā aizmugurējā daļa / Buferis", "Buferis"]));
    expect(dmg?.partLabels.join(" ")).not.toMatch(/BuferisAizmugure/);
    expect(dmg?.groupLabels).toEqual(["Virsbūves ārējās daļas", "Transportlīdzekļu apgaismojums"]);
  });
});

describe("aptuvena summa („>4000,00 €”) negadījumu kopā", () => {
  it("vienīgā avota summa paliek „virs 4 000 €”, nevis neapstrādāts „>4000,00 €” vai precīzs „4 000 €”", () => {
    const agg = aggregateUnifiedIncidents([
      row({ date: "16.06.2021", lossAmount: ">4000,00 €", sourceLabel: "CarVertical", sourceOrder: 0 }),
    ]);
    expect(agg.clusters).toHaveLength(1);
    expect(agg.clusters[0]?.displayAmount).toBe("virs 4 000 €");
    expect(agg.clusters[0]?.sourceValuations[0]?.displayAmount).toBe("virs 4 000 €");
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
    expect(formatUnifiedIncidentCountLabel(1, "accident")).toBe("1 negadījums");
    expect(formatUnifiedIncidentCountLabel(2, "accident")).toBe("2 negadījumi");
    expect(formatUnifiedIncidentCountLabel(1, "damage")).toBe("1 bojājumu ieraksts");
    expect(formatUnifiedIncidentCountLabel(2, "damage")).toBe("2 bojājumu ieraksti");
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

  it("divi dažādi CarVertical ieraksti vienā mēnesī ir divi negadījumi; LTAB pievienojas tam, ar kuru sakrīt summa", () => {
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
        lossAmount: "2 516,91 €",
        sourceLabel: "LTAB",
        sortableTime: t,
        sourceOrder: 2,
      }),
    ]);
    expect(agg.uniqueCount).toBe(2);
    const withLtab = agg.clusters.find((c) => c.sourceValuations.some((s) => s.sourceLabel === "LTAB"));
    const cv = withLtab?.sourceValuations.find((s) => s.sourceLabel === "CarVertical");
    expect(cv?.displayAmount).toBe("2 501 - 3 000 €");
    expect(cv?.rowCount).toBe(1);
    expect(withLtab?.displayAmount).toBe("2 501 - 3 000 €");
    const alone = agg.clusters.find((c) => c !== withLtab);
    expect(alone?.displayAmount).toBe("2 001 - 2 500 €");
    expect(agg.clusters.every((c) => c.averaged === false)).toBe(true);
  });

  it("neskaita divreiz identisku CarVertical rindu", () => {
    const t = Date.UTC(2023, 10, 1);
    const agg = aggregateUnifiedIncidents([
      row({ date: "01.11.2023", lossAmount: "2001 € – 2500 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 0 }),
      row({ date: "01.11.2023", lossAmount: "2001 € – 2500 €", sourceLabel: "CarVertical", sortableTime: t, sourceOrder: 1 }),
    ]);
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations[0]?.displayAmount).toBe("2 001 - 2 500 €");
    expect(agg.clusters[0]?.sourceValuations[0]?.rowCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations[0]?.amountEur).toBeNull();
  });
});

describe("24.11 audits #3 - LTAB + carVertical dublikāti", () => {
  const ltab = (date: string, amount: string, ms: number) =>
    row({ date, lossAmount: amount, sourceLabel: "LTAB", sortableTime: ms, sourceOrder: 1 });
  const cv = (date: string, amount: string, ms: number) =>
    row({ date, lossAmount: amount, sourceLabel: "CarVertical", sortableTime: ms, sourceOrder: 0 });

  it("case1: 5 LTAB + 2 carVertical (04.2016, 08.2016) = 5 notikumi, nevis 7", () => {
    const agg = aggregateUnifiedIncidents([
      ltab("18.04.2016", "420 €", Date.UTC(2016, 3, 18)),
      ltab("05.04.2016", "610 €", Date.UTC(2016, 3, 5)),
      ltab("19.08.2016", "380 €", Date.UTC(2016, 7, 19)),
      ltab("11.02.2018", "900 €", Date.UTC(2018, 1, 11)),
      ltab("03.06.2020", "1 200 €", Date.UTC(2020, 5, 3)),
      cv("04.2016", "400 - 450 €", Date.UTC(2016, 3, 1)),
      cv("08.2016", "", Date.UTC(2016, 7, 1)),
    ]);
    expect(agg.rawCount).toBe(7);
    expect(agg.uniqueCount).toBe(5);
    const aug = agg.clusters.find((c) => c.date === "19.08.2016")!;
    expect(aug.sourceValuations.map((v) => v.sourceLabel).sort()).toEqual(["CarVertical", "LTAB"]);
    expect(aug.kindLabel).toBe("Negadījums");
  });

  it("±30 dienas pāri mēneša robežai apvieno, tālāk - nē", () => {
    const near = aggregateUnifiedIncidents([
      ltab("28.03.2019", "500 €", Date.UTC(2019, 2, 28)),
      cv("04.2019", "", Date.UTC(2019, 3, 1)),
    ]);
    expect(near.uniqueCount).toBe(1);
    const far = aggregateUnifiedIncidents([
      ltab("10.01.2019", "500 €", Date.UTC(2019, 0, 10)),
      cv("04.2019", "", Date.UTC(2019, 3, 1)),
    ]);
    expect(far.uniqueCount).toBe(2);
  });

  it("cita valsts vai dienas datums ar pretrunīgu summu paliek atsevišķi", () => {
    const otherCountry = aggregateUnifiedIncidents([
      ltab("18.04.2016", "420 €", Date.UTC(2016, 3, 18)),
      row({ date: "04.2016", lossAmount: "", sourceLabel: "AutoDNA", country: "Vācija", sortableTime: Date.UTC(2016, 3, 1) }),
    ]);
    expect(otherCountry.uniqueCount).toBe(2);
    const dayConflict = aggregateUnifiedIncidents([
      ltab("18.04.2016", "420 €", Date.UTC(2016, 3, 18)),
      cv("02.05.2016", "9 000 €", Date.UTC(2016, 4, 2)),
    ]);
    expect(dayConflict.uniqueCount).toBe(2);
  });

  it("26.11: precīzs summas trāpījums pārī pirms pielaides (LTAB 767,64 € <-> carVertical 751 - 1 000 €)", () => {
    const agg = aggregateUnifiedIncidents([
      // LTAB jūnijā, carVertical tikai mēnesis (05.2019): 720 € ir tuvāk laikā, bet 767,64 € ietilpst 751 - 1 000 €.
      ltab("03.06.2019", "720 €", Date.UTC(2019, 5, 3)),
      ltab("25.06.2019", "767,64 €", Date.UTC(2019, 5, 25)),
      cv("05.2019", "751 - 1 000 €", Date.UTC(2019, 4, 1)),
      cv("05.2019", "501 - 750 €", Date.UTC(2019, 4, 1)),
    ]);
    expect(agg.rawCount).toBe(4);
    expect(agg.uniqueCount).toBe(2);
    const ltabAmount = (c: (typeof agg.clusters)[number]) =>
      c.sourceValuations.find((v) => v.sourceLabel === "LTAB")?.displayAmount ?? "";
    const cvAmount = (c: (typeof agg.clusters)[number]) =>
      c.sourceValuations.find((v) => v.sourceLabel === "CarVertical")?.displayAmount ?? "";
    const a767 = agg.clusters.find((c) => /767/.test(ltabAmount(c)))!;
    const a720 = agg.clusters.find((c) => /720/.test(ltabAmount(c)))!;
    expect(cvAmount(a767)).toMatch(/751/);
    expect(cvAmount(a720)).toMatch(/501/);
  });

  it("mēneša ieraksts ar pretrunīgu summu (iespējams KASKO) paliek atsevišķi", () => {
    const agg = aggregateUnifiedIncidents([
      ltab("18.04.2016", "420 €", Date.UTC(2016, 3, 18)),
      cv("04.2016", "3 000 - 4 000 €", Date.UTC(2016, 3, 1)),
    ]);
    expect(agg.uniqueCount).toBe(2);
  });
});
