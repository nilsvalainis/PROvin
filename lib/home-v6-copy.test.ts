import { describe, expect, it } from "vitest";
import {
  HOME_V6_CASE_EVENTS,
  HOME_V6_LOCALES,
  HOME_V6_MILEAGE_POINTS,
  HOME_V6_OIL_INTERVALS,
  formatHomeV6Eur,
  formatHomeV6Km,
  getHomeV6Copy,
} from "@/lib/home-v6-copy";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("home v6 copy", () => {
  it("every locale has the same phases and events as the shared data", () => {
    for (const locale of HOME_V6_LOCALES) {
      const c = getHomeV6Copy(locale).caseStudy;
      expect(c.phases).toHaveLength(HOME_V6_CASE_EVENTS.length);
      expect(c.events.map((p) => p.length)).toEqual(HOME_V6_CASE_EVENTS.map((p) => p.length));
    }
  });

  it("has one oil interval between each pair of mileage points", () => {
    expect(HOME_V6_OIL_INTERVALS).toHaveLength(HOME_V6_MILEAGE_POINTS.length - 1);
    HOME_V6_OIL_INTERVALS.forEach((iv, i) => {
      expect(iv.from).toBe(HOME_V6_MILEAGE_POINTS[i]!.date);
      expect(iv.to).toBe(HOME_V6_MILEAGE_POINTS[i + 1]!.date);
    });
  });

  it("has no empty strings, long dashes or phone numbers", () => {
    for (const locale of HOME_V6_LOCALES) {
      for (const s of strings(getHomeV6Copy(locale))) {
        expect(s.trim().length).toBeGreaterThan(0);
        expect(s).not.toMatch(/[–—−]/);
        expect(s).not.toMatch(/29\s?502\s?039/);
      }
    }
  });

  it("falls back to Latvian and formats numbers per locale", () => {
    expect(getHomeV6Copy("xx")).toBe(getHomeV6Copy("lv"));
    expect(formatHomeV6Km(103800, "lv")).toBe("103 800 km");
    expect(formatHomeV6Km(103800, "de")).toBe("103.800 km");
    expect(formatHomeV6Eur(38500, "en")).toBe("€38,500");
    expect(formatHomeV6Eur(38500, "ru")).toBe("38 500 €");
  });
});
