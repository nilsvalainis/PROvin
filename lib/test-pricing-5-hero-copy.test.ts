import { describe, expect, it } from "vitest";
import { getTp5HeroCopy } from "@/lib/test-pricing-5-hero-copy";

describe("getTp5HeroCopy", () => {
  it("keeps the audit title on MINI and AUDITS", () => {
    expect(getTp5HeroCopy("lv", "audits").titlePrefix + getTp5HeroCopy("lv").titleAccent).toBe(
      "Auto vēstures un sludinājuma audits",
    );
    expect(getTp5HeroCopy("lv", "mini").titleAccent).toBe("audits");
    expect(getTp5HeroCopy("en", "audits").titlePrefix + getTp5HeroCopy("en", "audits").titleAccent).toBe(
      "Vehicle history and listing audit",
    );
  });

  it("switches the H1 when the dealer tab is active", () => {
    const lv = getTp5HeroCopy("lv", "dealer");
    expect(lv.titlePrefix + lv.titleAccent).toBe("Oficiālā dīlera datu atskaite");
    const en = getTp5HeroCopy("en", "dealer");
    expect(en.titlePrefix + en.titleAccent).toBe("Official dealer data report");
  });
});
