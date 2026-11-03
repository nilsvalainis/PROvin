import { describe, expect, it } from "vitest";
import { getHomeV6HeroCopy, heroV6OptionIds } from "@/lib/home-hero-v6-copy";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("home v6 copy", () => {
  it("has the same structure and no long dashes in every locale", () => {
    const lv = getHomeV6HeroCopy("lv");
    for (const locale of ["en", "ru", "de"]) {
      const c = getHomeV6HeroCopy(locale);
      expect(c.coverage.cards).toHaveLength(lv.coverage.cards.length);
      expect(c.promises.items).toHaveLength(lv.promises.items.length);
      expect(Object.keys(c.options).sort()).toEqual(Object.keys(lv.options).sort());
      for (const s of strings(c)) {
        expect(s.trim().length).toBeGreaterThan(0);
        expect(s).not.toMatch(/[–—]/);
      }
    }
    expect(strings(lv).every((s) => !/[–—]/.test(s))).toBe(true);
  });

  it("falls back to Latvian for unknown locales", () => {
    expect(getHomeV6HeroCopy("xx").freeCheck.title).toBe("Bezmaksas VIN koda pārbaude");
  });
});

describe("heroV6OptionIds", () => {
  it("shows AUDITS and dealer data by default", () => {
    expect(heroV6OptionIds("audits")).toEqual(["audits", "dealer"]);
    expect(heroV6OptionIds("dealer")).toEqual(["audits", "dealer"]);
  });

  it("adds MINI only when it was chosen on /pakalpojumi", () => {
    expect(heroV6OptionIds("mini")).toEqual(["audits", "mini", "dealer"]);
  });

  it("keeps MINI listed after switching to another package", () => {
    expect(heroV6OptionIds("audits", "mini")).toEqual(["audits", "mini", "dealer"]);
  });

  it("never adds a hidden service", () => {
    expect(heroV6OptionIds("koreaUsa")).toEqual(["audits", "dealer"]);
  });
});
