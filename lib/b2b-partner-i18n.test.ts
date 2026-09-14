import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "@/i18n/locales";

function partnerKeys(locale: (typeof APP_LOCALES)[number]): string[] {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, "partner.json"), "utf8"),
  ) as { Partner: Record<string, string> };
  return Object.keys(raw.Partner).sort();
}

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenKeys(item, `${prefix}[${index}]`));
  }
  return [prefix];
}

function messageKeys(locale: (typeof APP_LOCALES)[number], file: string): string[] {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, file), "utf8"),
  ) as unknown;
  return flattenKeys(raw).sort();
}

describe("partner i18n", () => {
  it("keeps Partner keys in parity across lv, en, de and ru", () => {
    const lv = partnerKeys("lv");
    for (const locale of APP_LOCALES) {
      expect(partnerKeys(locale), locale).toEqual(lv);
    }
  });

  it("keeps header, footer and legal key shape across lv, en, de and ru", () => {
    for (const file of ["header.json", "footer.json", "legal.json"]) {
      const lv = messageKeys("lv", file);
      for (const locale of APP_LOCALES) {
        expect(messageKeys(locale, file), `${locale}/${file}`).toEqual(lv);
      }
    }
  });
});
