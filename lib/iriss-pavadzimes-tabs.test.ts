import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../components/admin/IrissPavadzimesListClient.tsx", import.meta.url), "utf8");

describe("IRISS waybill tabs", () => {
  it("keeps a gap between label and count on every tab (no 'Visas253')", () => {
    expect(src).toContain("<span>{VIEW_LABEL[v]}</span>");
    expect(src).toContain("inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap");
    expect(src).not.toContain("hidden md:inline-flex");
  });

  it("hides only the Visas tab on phones and does not stretch the bar on desktop", () => {
    expect(src).toContain('v === "all" ? "max-md:hidden" : ""');
    expect(src).not.toContain("inline-flex min-w-0 flex-1 rounded-lg bg-[#e9e9ee]");
  });
});
