import { describe, expect, it } from "vitest";
import {
  firstVinCheckPhrase,
  vinCheckPageHref,
  wrapFirstVinCheckPhrase,
} from "@/lib/seo-vin-check-internal-link";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";

describe("vin check internal link phrases", () => {
  it("uses the locale-safe explainer path (next-intl prefixes /lv|/en|/de|/ru)", () => {
    expect(vinCheckPageHref()).toBe("/vin-koda-parbaude");
  });

  it("wraps the Latvian VIN-check phrase without changing surrounding copy", () => {
    const parts = wrapFirstVinCheckPhrase(
      "Katra VIN koda pārbaude pie mums ir vesels detektīvs",
      "lv",
    );
    expect(parts).toEqual({
      before: "Katra ",
      phrase: "VIN koda pārbaude",
      after: " pie mums ir vesels detektīvs",
    });
  });

  it("prefers the longer English phrase when both match at the same index", () => {
    expect(firstVinCheckPhrase("Blog: buying a used car and VIN checks", "en")).toEqual({
      index: 28,
      phrase: "VIN checks",
    });
  });

  it("finds the free-check heading phrase in every public locale", () => {
    expect(wrapFirstVinCheckPhrase(getHomeV6HeroCopy("lv").freeCheck.title, "lv")?.phrase).toBe(
      "VIN koda pārbaude",
    );
    expect(wrapFirstVinCheckPhrase(getHomeV6HeroCopy("en").freeCheck.title, "en")?.phrase).toBe(
      "VIN check",
    );
    expect(wrapFirstVinCheckPhrase(getHomeV6HeroCopy("de").freeCheck.title, "de")?.phrase).toBe(
      "VIN-Check",
    );
    expect(wrapFirstVinCheckPhrase(getHomeV6HeroCopy("ru").freeCheck.title, "ru")?.phrase).toBe(
      "проверка VIN",
    );
  });

  it("does not invent a match when the page never mentions VIN checking", () => {
    expect(wrapFirstVinCheckPhrase("Kas ir PROVIN audits?", "lv")).toBeNull();
  });
});
