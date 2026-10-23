import { describe, expect, it } from "vitest";

import {
  analyzeOdometerRollbackBounds,
  buildOdometerRollbackBoundsBrief,
} from "@/lib/admin-ai-mileage-forensics";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, rollbackMentionRequired } from "@/lib/canonical-facts-sheet";
import {
  checkCommentContradictions,
  extractCanonicalFactsFromPrompt,
} from "@/lib/comment-contradiction-check";
import { evaluateExpertCommentQuality } from "@/lib/ai-eval/comment-quality";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

let order = 0;
function row(date: string, km: number, sourceLabel: string, country = "Vācija"): UnifiedMileageRow {
  const [d, m, y] = date.split(".").map(Number);
  return {
    date,
    odometer: String(km),
    country,
    sourceLabel,
    sourceOrder: order++,
    sortableTime: Date.UTC(y!, m! - 1, d!),
  };
}

/** BMW 540d G31 forma: 195 431 → 179 862, tad trends turpinās. */
function bmwRows(): UnifiedMileageRow[] {
  return [
    row("10.03.2018", 42000, "AutoDNA"),
    row("12.04.2019", 98000, "AutoDNA"),
    row("15.05.2020", 140500, "CarVertical"),
    row("20.06.2021", 195431, "AutoDNA"),
    row("18.07.2022", 179862, "CarVertical"),
    row("02.08.2023", 201300, "AutoDNA"),
  ];
}

describe("odometra kritums: izolēta ievades kļūda pret reālu korekciju", () => {
  it("BMW forma: viens punkts ārpus secības, trends turpinās ⇒ suspectedEntryError", () => {
    const drops = analyzeOdometerRollbackBounds(bmwRows());
    expect(drops).toHaveLength(1);
    expect(drops[0]!.kind).toBe("suspectedEntryError");
    expect([195431, 179862]).toContain(drops[0]!.suspect!.km);
    const brief = buildOdometerRollbackBoundsBrief(bmwRows());
    expect(brief).toMatch(/NAV odometra korekcija/);
    expect(brief).not.toMatch(/minimums/);
  });

  it("jauna zemāka bāze (visi turpmākie zem maksimuma) ⇒ reāls", () => {
    const rows = [
      row("01.01.2018", 100000, "AutoDNA"),
      row("01.01.2019", 150000, "AutoDNA"),
      row("01.01.2020", 90000, "CarVertical"),
      row("01.01.2021", 110000, "CarVertical"),
      row("01.01.2022", 130000, "CSDD", "Latvija"),
    ];
    const drops = analyzeOdometerRollbackBounds(rows);
    expect(drops.map((d) => d.kind)).toEqual(["real"]);
  });

  it("kritums pēdējā rādījumā ⇒ reāls", () => {
    const rows = [
      row("01.01.2018", 100000, "AutoDNA"),
      row("01.01.2019", 150000, "AutoDNA"),
      row("01.01.2020", 130000, "CarVertical"),
    ];
    expect(analyzeOdometerRollbackBounds(rows)[0]!.kind).toBe("real");
  });

  it("zemo vērtību apstiprina 2 avoti ⇒ reāls", () => {
    const rows = [
      row("01.01.2018", 100000, "AutoDNA"),
      row("01.01.2019", 150000, "AutoDNA"),
      row("01.01.2020", 120000, "CarVertical"),
      row("20.01.2020", 120400, "IZSOĻU PORTĀLU ARHĪVS"),
      row("01.01.2021", 170000, "AutoDNA"),
    ];
    const drops = analyzeOdometerRollbackBounds(rows);
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every((d) => d.kind === "real")).toBe(true);
  });

  it("2 punkti ārpus secības ⇒ reāls", () => {
    const rows = [
      row("01.01.2018", 100000, "AutoDNA"),
      row("01.01.2019", 150000, "AutoDNA"),
      row("01.01.2020", 120000, "CarVertical"),
      row("01.01.2021", 160000, "AutoDNA"),
      row("01.01.2022", 125000, "CarVertical"),
      row("01.01.2023", 200000, "AutoDNA"),
    ];
    const drops = analyzeOdometerRollbackBounds(rows);
    expect(drops).toHaveLength(2);
    expect(drops.every((d) => d.kind === "real")).toBe(true);
  });

  it("neticams temps starp kaimiņiem vai odometra nomaiņa servisā ⇒ reāls", () => {
    const fast = [
      row("01.01.2020", 100000, "AutoDNA"),
      row("01.02.2020", 160000, "AutoDNA"),
      row("15.02.2020", 120000, "CarVertical"),
      row("01.03.2020", 170000, "AutoDNA"),
    ];
    expect(analyzeOdometerRollbackBounds(fast).every((d) => d.kind === "real")).toBe(true);
    expect(
      analyzeOdometerRollbackBounds(bmwRows(), { odometerReplacementNoted: true })[0]!.kind,
    ).toBe("real");
  });
});

function bmwBlocks() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "BMW 540d",
    mileageHistory: [],
  };
  blocks.autodna = {
    ...blocks.autodna,
    serviceHistory: [
      { date: "10.03.2018", odometer: "42000", country: "Vācija" },
      { date: "12.04.2019", odometer: "98000", country: "Vācija" },
      { date: "20.06.2021", odometer: "195431", country: "Vācija" },
      { date: "02.08.2023", odometer: "201300", country: "Vācija" },
    ],
  } as typeof blocks.autodna;
  blocks.carvertical = {
    ...blocks.carvertical,
    serviceHistory: [
      { date: "15.05.2020", odometer: "140500", country: "Vācija" },
      { date: "18.07.2022", odometer: "179862", country: "Vācija" },
    ],
  } as typeof blocks.carvertical;
  return blocks;
}

function realDropBlocks() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "VW Passat",
    mileageHistory: [{ date: "01.06.2023", odometer: "150000", country: "Latvija" }],
  };
  blocks.autodna = {
    ...blocks.autodna,
    serviceHistory: [
      { date: "01.01.2019", odometer: "100000", country: "Vācija" },
      { date: "01.01.2020", odometer: "210000", country: "Vācija" },
      { date: "01.01.2021", odometer: "120000", country: "Vācija" },
    ],
  } as typeof blocks.autodna;
  return blocks;
}

describe("KANONISKIE FAKTI un validators ar krituma avotu", () => {
  it("BMW: faktu lapā nav „Kritums”, ir atsevišķā rinda; rollback_omitted neizdod", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: bmwBlocks() });
    expect(facts.sheet).not.toMatch(/- Kritums:/);
    expect(facts.sheet).toMatch(/Atsevišķs neatbilstošs rādījums \(iespējama ievades kļūda/);
    expect(facts.rollbacks).toHaveLength(0);
    expect(facts.odometerAnomaly).toBe(false);
    const parsed = extractCanonicalFactsFromPrompt(facts.sheet)!;
    expect(parsed.suspectedEntryErrors).toHaveLength(1);
    for (const field of ["mileage", "summary", "source"]) {
      const flags = checkCommentContradictions({
        text: "Nobraukums pieaug vienmērīgi.",
        field,
        facts: parsed,
        focusSourceLabel: "AutoDNA",
      });
      expect(flags.some((f) => f.kind === "rollback_omitted")).toBe(false);
    }
  });

  it("BMW: izolētā rādījuma km kā kritums vai ārpus nobraukuma lauka ⇒ entry_error_as_rollback (W)", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: bmwBlocks() });
    const km = facts.suspectedEntryErrors[0]!.km;
    const kmText = km.toLocaleString("lv-LV").replace(/\s/g, " ");
    const asRollback = checkCommentContradictions({
      text: `Nobraukums samazinājās līdz ${kmText} km, iespējama odometra korekcija.`,
      field: "mileage",
      facts,
    });
    const flag = asRollback.find((f) => f.kind === "entry_error_as_rollback");
    expect(flag?.level).toBe("W");

    const neutral = checkCommentContradictions({
      text: `Viens rādījums (${kmText} km) neatbilst pārējai secībai un, visticamāk, ir ievades kļūda.`,
      field: "mileage",
      facts,
    });
    expect(neutral.some((f) => f.kind === "entry_error_as_rollback")).toBe(false);

    const inSummary = checkCommentContradictions({
      text: `Viens rādījums (${kmText} km) neatbilst pārējai secībai.`,
      field: "summary",
      facts,
    });
    expect(inSummary.some((f) => f.kind === "entry_error_as_rollback")).toBe(true);
  });

  it("reāls kritums: lapā avots un valsts; prasa nobraukuma, kopsavilkuma un ŠĪ avota laukā, ne CSDD", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: realDropBlocks() });
    expect(facts.sheet).toMatch(/- Kritums: .*210 000 km \(AutoDNA, Vācija\) → .*120 000 km \(AutoDNA, Vācija\)/);
    const parsed = extractCanonicalFactsFromPrompt(facts.sheet)!;
    expect(parsed.rollbacks[0]!.fromSource).toBe("AutoDNA, Vācija");
    const silent = "Šajā avotā ir divi ieraksti.";
    const need = (field: string, focus?: string) =>
      checkCommentContradictions({ text: silent, field, facts: parsed, focusSourceLabel: focus }).some(
        (f) => f.kind === "rollback_omitted",
      );
    expect(need("mileage")).toBe(true);
    expect(need("summary")).toBe(true);
    expect(need("source", "AutoDNA")).toBe(true);
    expect(need("source", "CSDD")).toBe(false);
    expect(need("sources_comparison")).toBe(false);
    expect(need("technical_risks")).toBe(false);
    // Admin faktu pārbaude sūta bloka atslēgu.
    expect(rollbackMentionRequired("autodna", facts)).toBe(true);
    expect(rollbackMentionRequired("csdd", facts)).toBe(false);
    expect(rollbackMentionRequired("auto_records:oilChangeIntervalNotes", facts)).toBe(false);
  });

  it("CSDD komentārā cita avota km ⇒ csdd_foreign_mileage (W), CSDD km - nē", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: realDropBlocks() });
    const flags = checkCommentContradictions({
      text: "CSDD datos 01.06.2023 nobraukums 150 000 km. Vācijā 01.01.2020 rādījums 210 000 km.",
      field: "source",
      facts,
      focusSourceLabel: "CSDD",
      focusSourceText: "Nobraukums: 01.06.2023 | 150000 | Latvija",
    });
    const foreign = flags.filter((f) => f.kind === "csdd_foreign_mileage");
    expect(foreign).toHaveLength(1);
    expect(foreign[0]!.level).toBe("W");
    expect(foreign[0]!.message).toMatch(/210 000/);
  });

  it("CSDD avota komentārs bez cita avota krituma neizraisa maksas atkārtojumu (canonical_*)", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: realDropBlocks() });
    const prompt = [
      "Avota sadaļa (fokuss): CSDD",
      facts.sheet,
      "=== Konkrētā avota „CSDD” dati (bez esošajiem komentāriem) ===",
      "01.06.2023 | 150000 | Latvija",
      "",
      "Sagatavo komentāru TIKAI šai avota sadaļai klienta atskaitei.",
    ].join("\n");
    const issues = evaluateExpertCommentQuality(
      "CSDD datos 2023. gada jūnijā fiksēts nobraukums 150 000 km.",
      { field: "source", sourcePrompt: prompt },
    );
    expect(issues.some((i) => i.code.startsWith("canonical_"))).toBe(false);
  });
});
