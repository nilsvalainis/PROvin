import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import {
  isIsoDateNewerThanYears,
  MINI_CSDD_LOOKUP_TIMEOUT_MS,
  miniCsddModalVariantFromLookup,
  parseMiniCsddVariantResponse,
} from "@/lib/mini-csdd-eligibility";
import { getTp5MiniConfirmCopy, miniConfirmBody, miniConfirmTitle } from "@/lib/test-pricing-5-mini-confirm";

const NOW = new Date("2026-10-12T12:00:00Z");
const ROOT = join(import.meta.dirname, "..");

describe("mini CSDD eligibility", () => {
  it("keeps the public lookup timeout at about 4 seconds", () => {
    expect(MINI_CSDD_LOOKUP_TIMEOUT_MS).toBe(4000);
  });

  it("treats first registration under 3 years as a warning", () => {
    expect(isIsoDateNewerThanYears("2024-01-01", 3, NOW)).toBe(true);
    expect(isIsoDateNewerThanYears("2023-10-13", 3, NOW)).toBe(true);
    expect(isIsoDateNewerThanYears("2023-10-12", 3, NOW)).toBe(false);
    expect(isIsoDateNewerThanYears("2018-05-01", 3, NOW)).toBe(false);
    expect(isIsoDateNewerThanYears("", 3, NOW)).toBe(true);
  });

  it("warns when CSDD has no LV record", () => {
    expect(
      miniCsddModalVariantFromLookup(
        { found: false, message: "CSDD reģistrā šāds numurs netika atrasts" },
        NOW,
      ),
    ).toBe("warning");
  });

  it("falls back to the normal modal on timeout, relay miss, or HTTP failure", () => {
    expect(
      miniCsddModalVariantFromLookup({ found: false, message: "CSDD pieprasījums noildza" }, NOW),
    ).toBe("normal");
    expect(
      miniCsddModalVariantFromLookup(
        { found: false, message: "CSDD relejs nav konfigurēts" },
        NOW,
      ),
    ).toBe("normal");
    expect(
      miniCsddModalVariantFromLookup({ found: false, message: "CSDD neatbildēja (HTTP 502)" }, NOW),
    ).toBe("normal");
    expect(
      miniCsddModalVariantFromLookup(
        { found: false, message: "Neizdevās sasniegt CSDD releju" },
        NOW,
      ),
    ).toBe("normal");
  });

  it("warns for a found car first registered less than 3 years ago, otherwise normal", () => {
    const recent = emptyCsddTechData();
    recent.firstRegistrationIso = "2025-03-01";
    expect(miniCsddModalVariantFromLookup({ found: true, data: recent, message: "ok" }, NOW)).toBe(
      "warning",
    );

    const longTerm = emptyCsddTechData();
    longTerm.firstRegistrationIso = "2019-04-01";
    expect(
      miniCsddModalVariantFromLookup({ found: true, data: longTerm, message: "ok" }, NOW),
    ).toBe("normal");
  });

  it("treats unknown API payloads as the normal modal so purchase is never blocked", () => {
    expect(parseMiniCsddVariantResponse(null)).toBe("normal");
    expect(parseMiniCsddVariantResponse({ error: "nope" })).toBe("normal");
    expect(parseMiniCsddVariantResponse({ variant: "warning" })).toBe("warning");
    expect(parseMiniCsddVariantResponse({ variant: "normal" })).toBe("normal");
  });
});

describe("MINI confirm copy", () => {
  it("uses joprojām and never eksperts or unicode dashes", () => {
    const lv = getTp5MiniConfirmCopy();
    expect(lv.warnBody).toContain("joprojām");
    expect(lv.warnBody).not.toContain("joprojam");
    for (const copy of [
      lv,
      getTp5MiniConfirmCopy("en"),
      getTp5MiniConfirmCopy("de"),
      getTp5MiniConfirmCopy("ru"),
    ]) {
      const blob = Object.values(copy).join("\n");
      expect(blob.toLowerCase()).not.toContain("eksperts");
      expect(blob).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("keeps warning and normal titles distinct", () => {
    const lv = getTp5MiniConfirmCopy("lv");
    expect(miniConfirmTitle(lv, "normal")).toBe("Vai MINI ir piemērots šim auto?");
    expect(miniConfirmTitle(lv, "warning")).toBe("Šim auto iesakām PROVIN AUDITS");
    expect(miniConfirmBody(lv, "warning")).toContain("Ārvalstu vēsturi");
  });
});

describe("MINI confirm CSS flag", () => {
  it("draws a flat 2:1 Latvian flag in carmine / white / carmine 2:1:2", () => {
    const css = readFileSync(join(ROOT, "components/test-pricing-5/test-pricing-5.module.css"), "utf8");
    expect(css).toContain(".lvFlag");
    expect(css.toLowerCase()).toContain("#9e3039");
    expect(css).toContain("height: 0.72em");
    expect(css).toContain("width: 1.44em");
    expect(css).toMatch(/\.miniTitleRow\s*\{[^}]*display:\s*inline;/);
    expect(css).toMatch(/\.miniTitleTagline\s*\{[^}]*line-height:\s*inherit;/);
    expect(css).not.toMatch(/\.miniTitleRow\s*\{[^}]*inline-flex/);
    expect(css).toMatch(/#9E3039 0 40%/i);
    expect(css).toMatch(/#fff 40% 60%/i);
    expect(css).toMatch(/#9E3039 60% 100%/i);
  });
});
