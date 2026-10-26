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
  it("describes MINI as a local-register consultation and adds origin registers to AUDITS", () => {
    const lv = faqItem("lv", "mini-vs-audits").a;
    expect(lv).toContain(
      "PROVIN MINI (39,99 €) ir paredzēts automašīnām, kas jau ilgāku laiku tiek ekspluatētas Latvijā.",
    );
    expect(lv).toContain("vietējo reģistru pārbaude");
    expect(lv).toContain("MINI neietver maksas datubāzes, ārvalstu reģistrus, dīleru un izsoļu datus.");
    expect(lv).toContain("izcelsmes valsts reģistri");
    expect(lv.toLowerCase()).not.toContain("eksperts");
    expect(lv).not.toMatch(/[\u2013\u2014]/);

    const en = faqItem("en", "mini-vs-audits").a;
    expect(en).toContain("origin-country registers");
    expect(en).toContain("does not include paid databases");
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
