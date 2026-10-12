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
  it("locks Latvian warning and normal strings, buttons, and list items", () => {
    const lv = getTp5MiniConfirmCopy();
    expect(miniConfirmTitle(lv, "normal")).toBe("Vai MINI ir piemērots šim auto?");
    expect(miniConfirmBody(lv, "normal")).toBe(
      "PROVIN MINI ir paredzēts auto, kas ilgstoši ekspluatēts Latvijā.",
    );
    expect(lv.includesHeading).toBe("Pakalpojumā ietverts:");
    expect(lv.includesItem).toBe("Konsultācija un vietējo reģistru pārbaude");
    expect(lv.excludesItem).toBe("Neietver: maksas datubāzes, dīleru un izsoļu datus");
    expect(lv.includesItem).not.toMatch(/🟢|🔴/);
    expect(lv.excludesItem).not.toMatch(/🟢|🔴/);
    expect(lv.switchAudits).toBe("Pāriet uz AUDITS");
    expect(lv.continueMini).toBe("Turpināt ar MINI");
    expect(miniConfirmTitle(lv, "warning")).toBe("Šim auto iesakām PROVIN AUDITS");
    expect(lv.warnBar).toBe(
      "⚠️ Auto Latvijā nav reģistrēts vai ir reģistrēts mazāk nekā 3 gadus.",
    );
    expect(miniConfirmBody(lv, "warning")).toBe(
      "Ārvalstu vēsturi (negadījumus, nobraukumu, dīlera datus) pārbauda tikai PROVIN AUDITS. MINI parāda tikai Latvijas datus un sniedz konsultāciju.",
    );
  });

  it("never uses eksperts or unicode dashes in any locale", () => {
    for (const copy of [
      getTp5MiniConfirmCopy(),
      getTp5MiniConfirmCopy("en"),
      getTp5MiniConfirmCopy("de"),
      getTp5MiniConfirmCopy("ru"),
    ]) {
      const blob = Object.values(copy).join("\n");
      expect(blob.toLowerCase()).not.toContain("eksperts");
      expect(blob).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("MINI confirm modal markup", () => {
  it("puts AUDITS first as primary, then MINI as secondary, with CSS dots not emoji", () => {
    const modal = readFileSync(
      join(ROOT, "components/test-pricing-5/Tp5MiniConfirmModal.tsx"),
      "utf8",
    );
    const primaryAt = modal.indexOf("styles.miniConfirmPrimary");
    const secondaryAt = modal.indexOf("styles.miniConfirmSecondary");
    const switchAt = modal.indexOf("{copy.switchAudits}");
    const continueAt = modal.indexOf("{copy.continueMini}");
    expect(primaryAt).toBeGreaterThan(0);
    expect(secondaryAt).toBeGreaterThan(primaryAt);
    expect(switchAt).toBeGreaterThan(primaryAt);
    expect(switchAt).toBeLessThan(secondaryAt);
    expect(continueAt).toBeGreaterThan(secondaryAt);
    expect(modal).toContain("styles.miniConfirmDotInc");
    expect(modal).toContain("styles.miniConfirmDotExc");
    expect(modal).not.toContain("🟢");
    expect(modal).not.toContain("🔴");
  });
});

describe("MINI confirm CSS flag", () => {
  it("draws a refined 2:1 Latvian flag with a 1px border and radius", () => {
    const css = readFileSync(join(ROOT, "components/test-pricing-5/test-pricing-5.module.css"), "utf8");
    expect(css).toContain(".lvFlag");
    expect(css.toLowerCase()).toContain("#9e3039");
    expect(css).toContain("height: 0.6em");
    expect(css).toContain("width: 1.2em");
    expect(css).toMatch(/\.lvFlag\s*\{[^}]*border:\s*1px solid/);
    expect(css).toMatch(/\.lvFlag\s*\{[^}]*border-radius:\s*1px;/);
    expect(css).toMatch(/\.miniTitleRow\s*\{[^}]*display:\s*inline;/);
    expect(css).toMatch(/\.miniTitleTagline\s*\{[^}]*line-height:\s*inherit;/);
    expect(css).not.toMatch(/\.miniTitleRow\s*\{[^}]*inline-flex/);
    expect(css).toMatch(/#9E3039 0 40%/i);
    expect(css).toMatch(/#fff 40% 60%/i);
    expect(css).toMatch(/#9E3039 60% 100%/i);
  });

  it("overlays the MINI info popover and keeps a circular i control", () => {
    const css = readFileSync(join(ROOT, "components/test-pricing-5/test-pricing-5.module.css"), "utf8");
    const hint = readFileSync(join(ROOT, "components/test-pricing-5/Tp5MiniLvHint.tsx"), "utf8");
    expect(css).toMatch(/\.miniLvInfoBtn\s*\{[^}]*border-radius:\s*999px;/);
    expect(css).toMatch(/\.miniLvInfoPopup\s*\{[^}]*position:\s*absolute;/);
    expect(hint).toContain('aria-label={tip}');
    expect(hint).toContain("aria-describedby={open ? tipId : undefined}");
    expect(hint).toContain('role="tooltip"');
    expect(hint).toContain('Escape');
    expect(hint).not.toContain("Latvijā ekspluatētiem auto");
    expect(hint).not.toContain("LV auto");
  });

  it("renders include/exclude markers as site green and red CSS circles", () => {
    const css = readFileSync(join(ROOT, "components/test-pricing-5/test-pricing-5.module.css"), "utf8");
    expect(css).toMatch(/\.miniConfirmDot\s*\{[^}]*border-radius:\s*999px;/);
    expect(css).toMatch(/\.miniConfirmDotInc\s*\{[^}]*background:\s*rgb\(167 243 208 \/ 0\.95\);/);
    expect(css).toMatch(/\.miniConfirmDotExc\s*\{[^}]*background:\s*#ef4444;/);
    expect(css).toMatch(/\.miniConfirmPrimary\s*\{[^}]*composes:\s*liquidCta;/);
    expect(css).toMatch(
      /\.miniConfirmSecondary\s*\{[^}]*border:\s*1px solid rgb\(113 113 122 \/ 0\.55\);/,
    );
  });
});
