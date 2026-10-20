import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statusChipClass, statusChipRowClass, STATUS_CHIP_COUNT_CLASS } from "./iriss-status-chip";

describe("status chips", () => {
  it("keeps the phone row on one transparent scrolling line", () => {
    const row = statusChipRowClass("scroll");
    expect(row).toContain("flex-nowrap");
    expect(row).toContain("overflow-x-auto");
    expect(row).toContain("am-chip-fade");
    expect(row).toContain("bg-transparent");
    expect(row).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
    expect(row).not.toMatch(/bg-slate-|bg-neutral-|bg-black\/|bg-\[#/);
  });

  it("lets wide toolbars wrap without a filled panel", () => {
    const row = statusChipRowClass("wrap");
    expect(row).toMatch(/(^|\s)flex-wrap(\s|$)/);
    expect(row).toContain("bg-transparent");
  });

  it("uses a transparent off state and a subtle on tint", () => {
    const off = statusChipClass(false, "searching");
    expect(off).toContain("bg-transparent");
    expect(off).not.toContain("bg-sky-");
    expect(off.replace("hover:bg-black/[0.04]", "")).not.toContain("bg-black");

    const on = statusChipClass(true, "searching");
    expect(on).toContain("bg-sky-50");
    expect(on).toContain("min-h-11");
  });

  it("renders counts as a small badge", () => {
    expect(STATUS_CHIP_COUNT_CLASS).toContain("text-[10px]");
    expect(STATUS_CHIP_COUNT_CLASS).toContain("h-4");
    expect(STATUS_CHIP_COUNT_CLASS).toContain("rounded-full");
  });
});

describe("IRISS order card chrome", () => {
  it("drops the dark left accent on list cards and section headings", () => {
    const list = readFileSync("components/admin/IrissPasutijumiListClient.tsx", "utf8");
    expect(list).not.toContain("statusBarClass");
    expect(list).not.toContain("w-[3px]");

    const css = readFileSync("app/admin/iriss/iriss-admin.css", "utf8");
    expect(css).not.toMatch(/border-left:\s*3px/);
  });
});
