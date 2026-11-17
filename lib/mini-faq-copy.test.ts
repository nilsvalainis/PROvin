import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const LOCALES = ["lv", "en", "de", "ru"] as const;

type FaqItem = { id: string; q: string; a: string };

function faqItems(locale: (typeof LOCALES)[number]) {
  const raw = JSON.parse(readFileSync(join(ROOT, `messages/${locale}/faq.json`), "utf8")) as {
    Faq: { items: FaqItem[] };
  };
  return raw.Faq.items;
}

function faqItem(locale: (typeof LOCALES)[number], id: string) {
  const item = faqItems(locale).find((entry) => entry.id === id);
  if (!item) throw new Error(`${id} missing in ${locale}`);
  return item;
}

describe("FAQ mini-vs-audits", () => {
  it("describes AUDITS without MINI while MINI is hidden, with origin registers", () => {
    for (const locale of LOCALES) {
      const item = faqItem(locale, "mini-vs-audits");
      expect(`${item.q}${item.a}`).not.toContain("MINI");
      expect(item.a).not.toMatch(/[\u2013\u2014]/);
    }
    expect(faqItem("lv", "mini-vs-audits").a).toContain("izcelsmes valsts reģistri");
    expect(faqItem("en", "mini-vs-audits").a).toContain("origin-country registers");
    expect(faqItem("de", "mini-vs-audits").a).toContain("Register des Herkunftslandes");
    expect(faqItem("ru", "mini-vs-audits").a).toContain("реестры страны происхождения");
  });

  it("states AUDITS includes at least 2 paid history checks and has no unicode dashes", () => {
    expect(faqItem("lv", "mini-vs-audits").a).toContain("vismaz 2");
    expect(faqItem("en", "mini-vs-audits").a).toContain("at least 2");
    expect(faqItem("de", "mini-vs-audits").a).toContain("mindestens 2");
    expect(faqItem("ru", "mini-vs-audits").a).toContain("не менее 2");

    expect(faqItem("lv", "audits-paid-reports").a).toContain("vismaz 2");
    expect(faqItem("en", "audits-paid-reports").q).toContain("paid history checks");
    expect(faqItem("de", "audits-paid-reports").a).toContain("mindestens 2");
    expect(faqItem("ru", "audits-paid-reports").a).toContain("не менее 2");

    expect(faqItem("lv", "extra-reports").q).toContain("papildu atskaites");
    expect(faqItem("en", "extra-reports").a).toContain("optional");
    expect(faqItem("de", "extra-reports").a).toContain("freiwillig");
    expect(faqItem("ru", "extra-reports").a).toContain("не обязателен");

    for (const locale of LOCALES) {
      const ids = faqItems(locale).map((item) => item.id);
      expect(ids).toEqual(faqItems("lv").map((item) => item.id));
      for (const id of ["mini-vs-audits", "audits-paid-reports", "extra-reports"] as const) {
        const item = faqItem(locale, id);
        expect(`${item.q}\n${item.a}`).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});
