import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "messages");
const LOCALES = ["lv", "en", "de", "ru"] as const;

function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => keyPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe("public message parity", () => {
  const files = readdirSync(path.join(ROOT, "lv")).filter((name) => name.endsWith(".json"));

  it("has the same files in lv, en, de and ru", () => {
    for (const locale of LOCALES) {
      const names = readdirSync(path.join(ROOT, locale)).filter((name) => name.endsWith(".json")).sort();
      expect(names).toEqual([...files].sort());
    }
  });

  it("keeps the same key paths in every locale", () => {
    const mismatches: string[] = [];
    for (const file of files) {
      const byLocale = Object.fromEntries(
        LOCALES.map((locale) => {
          const json = JSON.parse(readFileSync(path.join(ROOT, locale, file), "utf8")) as unknown;
          return [locale, keyPaths(json).sort()];
        }),
      ) as Record<(typeof LOCALES)[number], string[]>;
      for (const locale of LOCALES) {
        if (byLocale[locale].join("\n") !== byLocale.lv.join("\n")) {
          const missing = byLocale.lv.filter((key) => !byLocale[locale].includes(key));
          const extra = byLocale[locale].filter((key) => !byLocale.lv.includes(key));
          mismatches.push(`${locale}/${file} missing=${missing.join(",") || "-"} extra=${extra.join(",") || "-"}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("does not use unicode dashes in de or ru copy", () => {
    const bad: string[] = [];
    for (const locale of ["de", "ru"] as const) {
      for (const file of files) {
        const raw = readFileSync(path.join(ROOT, locale, file), "utf8");
        if (raw.includes("\u2014") || raw.includes("\u2013")) bad.push(`${locale}/${file}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
