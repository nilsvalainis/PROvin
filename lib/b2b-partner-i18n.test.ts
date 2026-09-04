import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function partnerKeys(locale: "lv" | "en"): string[] {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, "partner.json"), "utf8"),
  ) as { Partner: Record<string, string> };
  return Object.keys(raw.Partner).sort();
}

describe("partner i18n", () => {
  it("keeps lv and en Partner keys in parity", () => {
    expect(partnerKeys("en")).toEqual(partnerKeys("lv"));
  });
});
