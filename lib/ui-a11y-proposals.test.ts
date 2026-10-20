import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "@/i18n/locales";
import { ACCENT_ON_BLACK_HEX, BRAND_ACCENT_HEX } from "./contrast-on-black";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("UI a11y / i18n proposals", () => {
  it("keeps skip-to-content copy in all public locales", () => {
    for (const locale of APP_LOCALES) {
      const header = JSON.parse(read(`messages/${locale}/header.json`)) as {
        Header: { skipToContent?: string };
      };
      expect(header.Header.skipToContent?.trim().length, locale).toBeGreaterThan(2);
    }
  });

  it("puts the skip link in the locale layout, not HeaderClient", () => {
    const layout = read("app/[locale]/layout.tsx");
    const skip = read("components/SkipToContent.tsx");
    expect(layout).toContain("<SkipToContent");
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain("./public-a11y.css");
    expect(skip).toContain('href="#main-content"');
    expect(skip).toContain('t("skipToContent")');
    expect(read("components/HeaderClient.tsx")).not.toContain("skipToContent");
  });

  it("raises accent text on black without changing the brand fill token", () => {
    const css = read("app/[locale]/public-a11y.css");
    expect(css.toLowerCase()).toContain(ACCENT_ON_BLACK_HEX.toLowerCase());
    expect(css).not.toMatch(/--color-provin-accent\s*:/);
    const globals = read("app/globals.css");
    expect(globals.toLowerCase()).toContain(`--color-provin-accent: ${BRAND_ACCENT_HEX.toLowerCase()}`);
  });
});
