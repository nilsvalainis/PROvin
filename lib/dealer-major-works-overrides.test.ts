import { describe, expect, it } from "vitest";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import {
  BMW_D17_HOOD_DATE,
  BMW_D17_HOOD_EN,
  BMW_D17_HOOD_LV,
  BMW_D17_HOOD_ODOMETER,
  bmwD17HoodServiceRows,
} from "@/lib/dealer-major-works.prod-corpus.fixture";
import {
  applyDealerMajorWorkOverrides,
  dealerMajorWorkEditorRows,
  dealerMajorWorkHitKey,
  dealerMajorWorkOverridesSnapshotField,
  nextCustomDealerMajorWorkOverrideKey,
  parseDealerMajorWorkOverrides,
  removeDealerMajorWorkOverride,
  upsertDealerMajorWorkOverride,
} from "@/lib/dealer-major-works-overrides";
import { collectDealerMajorWorkHits } from "@/lib/pdf-dealer-timeline";

describe("parseDealerMajorWorkOverrides", () => {
  it("omits the field on old drafts and keeps an empty clear", () => {
    expect(parseDealerMajorWorkOverrides(undefined)).toBeUndefined();
    expect(parseDealerMajorWorkOverrides(null)).toBeUndefined();
    expect(parseDealerMajorWorkOverrides({ key: "x", action: "hide" })).toBeUndefined();
    expect(dealerMajorWorkOverridesSnapshotField(undefined)).toEqual({});
    expect(dealerMajorWorkOverridesSnapshotField(null)).toEqual({});
    expect(parseDealerMajorWorkOverrides([])).toEqual([]);
    expect(dealerMajorWorkOverridesSnapshotField([])).toEqual({ dealerMajorWorkOverrides: [] });
  });

  it("keeps hide/set rows and drops junk", () => {
    expect(
      parseDealerMajorWorkOverrides([
        { key: "engine@D17", action: "hide" },
        { key: "engine@D17", action: "set", assemblyId: "body_glass" },
        { key: "gearbox@D6", action: "set", assemblyId: "nope", label: "  Kārba  " },
        { key: "", action: "hide" },
        { action: "hide" },
        "nope",
      ]),
    ).toEqual([
      { key: "engine@D17", action: "hide" },
      { key: "gearbox@D6", action: "set", label: "Kārba" },
    ]);
  });
});

describe("applyDealerMajorWorkOverrides precedence", () => {
  const automatic = [
    {
      id: "engine",
      label: "Dzinējs",
      factId: "D17",
      date: BMW_D17_HOOD_DATE,
      km: "54 832 km",
    },
  ];

  it("absent or empty overrides keep automatic hits", () => {
    expect(applyDealerMajorWorkOverrides(automatic, undefined)).toEqual(automatic);
    expect(applyDealerMajorWorkOverrides(automatic, [])).toEqual(automatic);
  });

  it("hide removes the automatic engine line", () => {
    expect(
      applyDealerMajorWorkOverrides(automatic, [{ key: "engine@D17", action: "hide" }]),
    ).toEqual([]);
  });

  it("set reclassifies category and optional text", () => {
    expect(
      applyDealerMajorWorkOverrides(automatic, [
        { key: "engine@D17", action: "set", assemblyId: "body_glass", label: "Kapote" },
      ]),
    ).toEqual([
      {
        id: "body_glass",
        label: "Kapote",
        factId: "D17",
        date: BMW_D17_HOOD_DATE,
        km: "54 832 km",
      },
    ]);
  });

  it("removing the override returns to automatic", () => {
    const withHide = upsertDealerMajorWorkOverride([], { key: "engine@D17", action: "hide" });
    expect(applyDealerMajorWorkOverrides(automatic, withHide)).toEqual([]);
    expect(applyDealerMajorWorkOverrides(automatic, removeDealerMajorWorkOverride(withHide, "engine@D17"))).toEqual(
      automatic,
    );
  });

  it("custom set row is appended when it is not an automatic key", () => {
    const customKey = nextCustomDealerMajorWorkOverrideKey([]);
    expect(customKey).toBe("custom:1");
    const hits = applyDealerMajorWorkOverrides(automatic, [
      {
        key: customKey,
        action: "set",
        assemblyId: "gearbox",
        date: "01.06.2020",
        km: "90 000 km",
      },
    ]);
    expect(hits.map((h) => h.id)).toEqual(["engine", "gearbox"]);
    expect(hits[1]).toMatchObject({
      id: "gearbox",
      label: "Ātrumkārba",
      date: "01.06.2020",
      km: "90 000 km",
    });
  });
});

describe("D17 Hood facts: automatic vs override", () => {
  it("automatic D17 LV pārsegs is body_glass, not engine", () => {
    const rows = bmwD17HoodServiceRows();
    const facts = extractDealerFactsFromServiceWorks(rows);
    expect(facts.rows.at(-1)?.id).toBe("D17");
    const hits = collectDealerMajorWorkHits(facts);
    expect(hits.map((h) => h.id)).toEqual(["body_glass"]);
    expect(hits[0]).toMatchObject({
      id: "body_glass",
      factId: "D17",
      date: BMW_D17_HOOD_DATE,
    });
    expect(dealerMajorWorkHitKey(hits[0]!)).toBe("body_glass@D17");
  });

  it("original Hood + LV pārsegs together still are not engine", () => {
    const rows = bmwD17HoodServiceRows(BMW_D17_HOOD_LV);
    const facts = extractDealerFactsFromServiceWorks(rows, [
      {
        date: BMW_D17_HOOD_DATE,
        odometer: BMW_D17_HOOD_ODOMETER,
        place: "BMW",
        works: BMW_D17_HOOD_EN,
      },
    ]);
    expect(facts.rows.at(-1)?.worksOriginal).toBe(BMW_D17_HOOD_EN);
    expect(facts.rows.at(-1)?.worksLv).toContain("Dzinēja pārsegs");
    const hits = collectDealerMajorWorkHits(facts);
    expect(hits.some((h) => h.id === "engine")).toBe(false);
    expect(hits.map((h) => h.id)).toEqual(["body_glass"]);
  });

  it("editor rows mark hide vs automatic vs custom", () => {
    const automatic = [
      {
        id: "body_glass" as const,
        label: "Virsbūve / stikls",
        factId: "D17",
        date: BMW_D17_HOOD_DATE,
        km: "54 832 km",
      },
    ];
    const rows = dealerMajorWorkEditorRows(automatic, [
      { key: "body_glass@D17", action: "hide" },
      { key: "custom:1", action: "set", assemblyId: "engine", date: "01.01.2020" },
    ]);
    expect(rows[0]).toMatchObject({ key: "body_glass@D17", hidden: true, isCustom: false, effective: null });
    expect(rows[1]).toMatchObject({ key: "custom:1", isCustom: true, hidden: false });
    expect(rows[1]?.effective?.id).toBe("engine");
  });

  it("manual hide of D17 body_glass wins over automatic, then auto restore", () => {
    const facts = extractDealerFactsFromServiceWorks(bmwD17HoodServiceRows());
    const automatic = collectDealerMajorWorkHits(facts);
    expect(automatic).toHaveLength(1);
    const hidden = collectDealerMajorWorkHits(facts, [{ key: "body_glass@D17", action: "hide" }]);
    expect(hidden).toEqual([]);
    expect(collectDealerMajorWorkHits(facts, [])).toEqual(automatic);
  });
});
