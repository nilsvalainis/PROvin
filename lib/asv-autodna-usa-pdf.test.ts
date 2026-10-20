import { describe, expect, it } from "vitest";
import {
  ASV_AUTODNA_USA_PDF_TARGET,
  excludeAsvFromCopilotPatch,
} from "@/lib/asv-autodna-usa-pdf";

describe("ASV AutoDNA USA PDF", () => {
  it("reuses the AutoDNA vendor upload target", () => {
    expect(ASV_AUTODNA_USA_PDF_TARGET).toBe("autodna");
  });

  it("drops asv from a copilot patch so ASV fields stay untouched", () => {
    const next = excludeAsvFromCopilotPatch(
      {
        autodna: { comments: "no PDF" },
        asv: { damages: [{ date: "overwrite" }] },
      },
      ["autodna", "asv"],
    );
    expect(next.changedKeys).toEqual(["autodna"]);
    expect(next.patched).toEqual({ autodna: { comments: "no PDF" } });
    expect("asv" in next.patched).toBe(false);
  });
});
