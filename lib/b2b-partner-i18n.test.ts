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

describe("partner i18n", () => {
  it("keeps Partner keys in parity across lv, en, de and ru", () => {
    const lv = partnerKeys("lv");
    for (const locale of APP_LOCALES) {
      expect(partnerKeys(locale), locale).toEqual(lv);
    }
  });
});
