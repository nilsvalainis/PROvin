import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
import { NextIntlClientProvider } from "next-intl";
import {
  BlackFridayBannerSlot,
  BlackFridayProvider,
  PromoOmnibusLine,
  PromoPrice,
} from "@/components/promo/BlackFridayPromo";
import { renderHtml as renderHtmlRaw, renderText as renderTextRaw } from "@/lib/test-render";

const renderHtml = (el: Parameters<typeof renderHtmlRaw>[0]) => renderHtmlRaw(el).replace(/\u00a0/g, " ");

const renderText = (el: Parameters<typeof renderTextRaw>[0]) => renderTextRaw(el).replace(/\u00a0/g, " ");

const IN = Date.parse("2026-11-28T10:00:00Z");
const AFTER = Date.parse("2026-12-02T10:00:00Z");

function wrap(locale: string, enabled: boolean, nowMs: number | null, el: ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <BlackFridayProvider enabled={enabled} initialNowMs={nowMs}>
        {el}
      </BlackFridayProvider>
    </NextIntlClientProvider>
  );
}

const ui = (
  <>
    <BlackFridayBannerSlot />
    <PromoPrice planId="dealer" regularLabel="REGULAR" />
    <PromoOmnibusLine planId="dealer" />
    <PromoPrice planId="premium" regularLabel="99,99 €" />
  </>
);

describe("Black Friday publiskās cenas", () => {
  const cases: Array<[string, string, string, string]> = [
    ["lv", "24,99 €", "17,49 €", "Iepriekšējā cena: 24,99 €"],
    ["en", "€24.99", "€17.49", "Previous price: €24.99"],
    ["de", "24,99 €", "17,49 €", "Vorheriger Preis: 24,99 €"],
    ["ru", "24,99 €", "17,49 €", "Предыдущая цена: 24,99 €"],
  ];

  for (const [locale, oldPrice, newPrice, omnibus] of cases) {
    it(`${locale}: pārsvītrotā vecā cena, jaunā cena, -30 %, Omnibus rinda un josla`, () => {
      const html = renderHtml(wrap(locale, true, IN, ui));
      const text = renderText(wrap(locale, true, IN, ui));
      expect(html).toContain(`<s`);
      expect(html).toMatch(new RegExp(`<s[^>]*>${oldPrice.replace(/[.€]/g, "\\$&")}</s>`));
      expect(text).toContain(newPrice);
      expect(text).toContain("-30 %");
      expect(text).toContain(omnibus);
      expect(html).toContain("data-promo-banner");
      expect(text).not.toContain("REGULAR");
      /** AUDITS paliek bez akcijas. */
      expect(text).toContain("99,99 €");
    });
  }

  it("slēdzis izslēgts: parastā cena, nav Omnibus rindas, nav joslas", () => {
    const text = renderText(wrap("lv", false, IN, ui));
    expect(text).toContain("REGULAR");
    expect(text).not.toContain("Iepriekšējā cena");
    expect(renderHtml(wrap("lv", false, IN, ui))).not.toContain("data-promo-banner");
  });

  it("pēc beigām: parastā cena", () => {
    const text = renderText(wrap("lv", true, AFTER, ui));
    expect(text).toContain("REGULAR");
    expect(text).not.toContain("17,49");
  });

  it("servera HTML (laiks vēl nav zināms) vienmēr bez akcijas - nav hidratācijas nesakritības", () => {
    const text = renderText(wrap("lv", true, null, ui));
    expect(text).toContain("REGULAR");
    expect(text).not.toContain("Iepriekšējā cena");
  });
});
