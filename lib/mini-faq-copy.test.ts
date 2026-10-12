import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function faqItem(locale: "lv" | "en" | "de" | "ru") {
  const raw = JSON.parse(readFileSync(join(ROOT, `messages/${locale}/faq.json`), "utf8")) as {
    Faq: { items: Array<{ id: string; a: string }> };
  };
  const item = raw.Faq.items.find((entry) => entry.id === "mini-vs-audits");
  if (!item) throw new Error(`mini-vs-audits missing in ${locale}`);
  return item.a;
}

describe("FAQ mini-vs-audits", () => {
  it("describes MINI as a local-register consultation and adds origin registers to AUDITS", () => {
    const lv = faqItem("lv");
    expect(lv).toContain(
      "PROVIN MINI (39,99 €) ir paredzēts automašīnām, kas jau ilgāku laiku tiek ekspluatētas Latvijā.",
    );
    expect(lv).toContain("vietējo reģistru pārbaude");
    expect(lv).toContain("MINI neietver maksas datubāzes, ārvalstu reģistrus, dīleru un izsoļu datus.");
    expect(lv).toContain("izcelsmes valsts reģistri");
    expect(lv.toLowerCase()).not.toContain("eksperts");
    expect(lv).not.toMatch(/[\u2013\u2014]/);

    const en = faqItem("en");
    expect(en).toContain("origin-country registers");
    expect(en).toContain("does not include paid databases");
    expect(faqItem("de")).toContain("Register des Herkunftslandes");
    expect(faqItem("ru")).toContain("реестры страны происхождения");
  });
});
