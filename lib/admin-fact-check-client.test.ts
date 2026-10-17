import { describe, expect, it } from "vitest";
import {
  collectFilledFactCheckFields,
  factCheckDismissKey,
  isIntervalWarningFlag,
  openErrorFactCheckFlags,
  parseVehicleYear,
  visibleFactCheckFlags,
} from "@/lib/admin-fact-check-client";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

function flag(partial: Partial<FactCheckFlag> & Pick<FactCheckFlag, "id" | "level" | "kind" | "message" | "sentence">): FactCheckFlag {
  return partial;
}

describe("admin fact-check client", () => {
  it("parseVehicleYear reads CSDD year", () => {
    expect(parseVehicleYear("2014")).toBe(2014);
    expect(parseVehicleYear("", "2018-01-01")).toBe(2018);
  });

  it("dismiss key is id|sentence", () => {
    expect(factCheckDismissKey({ id: "fact:x", sentence: "Kārba ir ZF." })).toBe("fact:x|Kārba ir ZF.");
  });

  it("collapses interval warnings; errors stay open", () => {
    const interval = flag({
      id: "unsourced_interval",
      level: "W",
      kind: "unsourced",
      message: "Intervāls 45 000 km nav avotots.",
      sentence: "Eļļas maiņa ik pēc 45 000 km.",
    });
    const service = flag({
      id: "fact:mb_7gdct_service_interval",
      level: "W",
      kind: "contradiction",
      factId: "mb_7gdct_service_interval",
      message: "7G-DCT eļļas maiņas cikls.",
      sentence: "Nākamā apkope pie 220 tūkst. km.",
    });
    const err = flag({
      id: "fact:audi_q7_4l_gearbox_aisin",
      level: "E",
      kind: "contradiction",
      message: "Q7 4L kārba ir Aisin.",
      sentence: "Kārba ir ZF 8HP.",
    });
    expect(isIntervalWarningFlag(interval)).toBe(true);
    expect(isIntervalWarningFlag(service)).toBe(true);
    expect(isIntervalWarningFlag(err)).toBe(false);
    expect(openErrorFactCheckFlags([interval, err], [])).toEqual([err]);
  });

  it("hides dismissed flags", () => {
    const f = flag({
      id: "recall_denied",
      level: "E",
      kind: "recall_denied",
      message: "Atsaukums datos.",
      sentence: "Atsaukumu nav.",
    });
    expect(visibleFactCheckFlags([f], [factCheckDismissKey(f)])).toEqual([]);
    expect(openErrorFactCheckFlags([f], [factCheckDismissKey(f)])).toEqual([]);
  });

  it("collects filled AI fields including oil intervals", () => {
    const sourceBlocks = createDefaultSourceBlocks();
    sourceBlocks.auto_records.oilChangeIntervalNotes = "<p>Maiņa ik 15 000 km.</p>";
    sourceBlocks.csdd.comments = "CSDD komentārs par TA.";
    const fields = collectFilledFactCheckFields({
      tehniskoRiskuAnalize: "Kārba ir Aisin.",
      iriss: "",
      apskatesPlāns: "",
      mileageComment: "",
      incidentsComment: "",
      sourcesComparisonComment: "",
      sourceBlocks,
    });
    expect(fields.map((f) => f.field)).toEqual(
      expect.arrayContaining(["technical_risks", "csdd", "auto_records:oilChangeIntervalNotes"]),
    );
    expect(fields.find((f) => f.field === "auto_records:oilChangeIntervalNotes")?.text).toMatch(/15 000/);
    expect(fields.some((f) => f.field === "summary")).toBe(false);
  });
});
