import { describe, expect, it } from "vitest";

import {
  buildDismissedFeedbackDigest,
  formatDismissedFeedbackDigest,
  sanitizeFeedbackSample,
  type ContradictionFeedbackLogLine,
} from "@/lib/contradiction-feedback";

const NOW = Date.parse("2026-11-28T12:00:00Z");
const line = (p: Partial<ContradictionFeedbackLogLine>): ContradictionFeedbackLogLine => ({
  fp: "fact|km_mismatch|WBA5R1C0XLFH42873|abc",
  rule: "km_mismatch",
  origin: "fact",
  verdict: "dismiss",
  at: "2026-11-27T10:00:00Z",
  vin: "WBA5R1C0XLFH42873",
  sessionId: "cs_test_1",
  ...p,
});

describe("sanitizeFeedbackSample", () => {
  it("izņem personas datus, atstāj skaitļus", () => {
    const s = sanitizeFeedbackSample(
      "Jānis Bērziņš (janis@example.com, +371 29 502 039, 29502039) pārdod VIN WBA5R1C0XLFH42873, nr. AB-1234, 15.03.2020 pie 120 000 km.",
    );
    expect(s).not.toMatch(/Jānis|Bērziņš|example|29502039|WBA5R1C0XLFH42873|AB-1234/);
    expect(s).toContain("[vārds]");
    expect(s).toContain("15.03.2020 pie 120 000 km");
  });
  it("auto marka un modelis paliek", () => {
    expect(sanitizeFeedbackSample("Volkswagen Passat dzinējs CJCA.")).toBe("Volkswagen Passat dzinējs CJCA.");
  });
  it("garš teksts saīsināts, ne-teksts - tukšs", () => {
    expect(sanitizeFeedbackSample("a ".repeat(400)).length).toBeLessThanOrEqual(240);
    expect(sanitizeFeedbackSample(42)).toBe("");
  });
});

describe("buildDismissedFeedbackDigest", () => {
  it("grupē noraidītos pa noteikumu / veidu / faktu, bez VIN un pasūtījuma id", () => {
    const d = buildDismissedFeedbackDigest(
      [
        line({ sample: "Nobraukums 98 000 km.", kind: "contradiction" }),
        line({ fp: "x2", vin: "VIN2", sample: "Odometrs 77 000 km.", kind: "contradiction" }),
        line({ fp: "x3", vin: "VIN3", verdict: "confirm", kind: "contradiction" }),
        line({ fp: "x4", rule: "power_output", kind: "power_output", sample: "Jauda 110 kW." }),
        // ārpus 7 dienām
        line({ fp: "old", at: "2026-11-01T10:00:00Z", sample: "Vecs." }),
      ],
      NOW,
      7,
    );
    expect(d.decisions).toBe(4);
    expect(d.dismissed).toBe(3);
    expect(d.groups.map((g) => [g.rule, g.dismiss, g.confirm])).toEqual([
      ["km_mismatch", 2, 1],
      ["power_output", 1, 0],
    ]);
    expect(d.groups[0]!.examples).toEqual(["Nobraukums 98 000 km.", "Odometrs 77 000 km."]);
    const json = JSON.stringify(d);
    expect(json).not.toContain("WBA5R1C0XLFH42873");
    expect(json).not.toContain("cs_test_1");
  });
  it("jaunākais lēmums uz VIN + fp uzvar (pārdomas neskaitās divreiz)", () => {
    const d = buildDismissedFeedbackDigest(
      [line({ at: "2026-11-26T10:00:00Z" }), line({ at: "2026-11-27T10:00:00Z", verdict: "confirm" })],
      NOW,
    );
    expect(d.dismissed).toBe(0);
    expect(d.groups).toEqual([]);
    expect(formatDismissedFeedbackDigest(d)).toContain("atzīmju nav");
  });
  it("teksta formāts ar piemēriem", () => {
    const d = buildDismissedFeedbackDigest([line({ sample: "Nobraukums 98 000 km." })], NOW);
    const t = formatDismissedFeedbackDigest(d);
    expect(t).toContain("km_mismatch (fact): noraidīti 1, apstiprināti 0");
    expect(t).toContain("«Nobraukums 98 000 km.»");
  });
});
