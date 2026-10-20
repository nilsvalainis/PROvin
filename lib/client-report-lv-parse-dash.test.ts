import { describe, expect, it } from "vitest";
import { parseLvRegistryBasics, parseTaRating2DefectLines } from "@/lib/client-report-lv-parse";

describe("CSDD parsēšana pēc domuzīmju aizstāšanas (#279)", () => {
  it("pirmā reģistrācija ar en/em domuzīmi joprojām tiek atpazīta", () => {
    for (const dash of ["-", "\u2013", "\u2014"]) {
      const basics = parseLvRegistryBasics(`12.05.2019 ${dash} Pirmā reģistrācija Latvijā`);
      expect(basics.firstRegLatvia).toBe("12.05.2019");
      expect(basics.firstReg).toBeNull();
    }
  });

  it("TA defektu rindas ar en domuzīmi tiek uztvertas", () => {
    const lines = parseTaRating2DefectLines(
      ["Vērtējums: 2", "1.2.3 \u2013 Bremžu disks", "5.1.1 - Lukturis"].join("\n"),
    );
    expect(lines).toEqual(["1.2.3 \u2013 Bremžu disks", "5.1.1 - Lukturis"]);
  });
});
