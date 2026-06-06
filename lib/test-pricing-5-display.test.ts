import { describe, expect, it } from "vitest";
import {
  getTp5ActiveBlockCount,
  getTp5BlockRows,
  isTp5BlockActive,
  isTp5BlockLocked,
} from "@/lib/test-pricing-5-display";

describe("test-pricing-5 display", () => {
  it("activates contiguous blocks from mini upward", () => {
    expect(isTp5BlockActive("mini", "mini")).toBe(true);
    expect(isTp5BlockActive("plus", "mini")).toBe(false);
    expect(isTp5BlockActive("premium", "mini")).toBe(false);

    expect(isTp5BlockActive("mini", "plus")).toBe(true);
    expect(isTp5BlockActive("plus", "plus")).toBe(true);
    expect(isTp5BlockActive("premium", "plus")).toBe(false);

    expect(isTp5BlockActive("premium", "premium")).toBe(true);
  });

  it("maps lock helper to inactive blocks outside the blue frame", () => {
    expect(isTp5BlockLocked("plus", "mini")).toBe(true);
    expect(isTp5BlockLocked("premium", "plus")).toBe(true);
    expect(isTp5BlockLocked("mini", "premium")).toBe(false);
  });

  it("returns active block count for liquid accent height", () => {
    expect(getTp5ActiveBlockCount("mini")).toBe(1);
    expect(getTp5ActiveBlockCount("plus")).toBe(2);
    expect(getTp5ActiveBlockCount("premium")).toBe(3);
  });

  it("exposes finalized copy per semantic group", () => {
    expect(getTp5BlockRows("mini").map((r) => r.label)).toEqual([
      "Sludinājuma analīze",
      "Tehnisko risku izvērtēšana",
      "Pirkuma rekomendācija",
    ]);
    expect(getTp5BlockRows("plus").map((r) => r.label)).toEqual([
      "Eiropas publisko reģistru pārbaude",
      "Tehnisko apskašu vēsture",
      "Individuāla konsultācija",
    ]);
    expect(getTp5BlockRows("premium").map((r) => r.label)).toEqual([
      "carVertical vēstures atskaite",
      "autoDNA vēstures atskaite",
      "Oficiālo dīleru sistēmu dati",
    ]);
  });
});
