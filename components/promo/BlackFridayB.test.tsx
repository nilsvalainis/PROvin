import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));

import {
  BlackFridayCapsuleB,
  BlackFridayDealerBoxB,
  BlackFridayDealerKickerB,
  BlackFridayDialogB,
  BlackFridayHeroOmnibusB,
  BlackFridayHeroPriceB,
  BlackFridayTopBarB,
} from "@/components/promo/BlackFridayB";
import { BlackFridayProvider } from "@/components/promo/BlackFridayPromo";
import { getBlackFridayPlanPrice } from "@/lib/promo/black-friday";
import { blackFridayCountdownLine, blackFridayCountdownParts } from "@/lib/promo/black-friday-copy";
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

const all = (
  <>
    <BlackFridayTopBarB />
    <BlackFridayCapsuleB />
    <BlackFridayHeroPriceB regularLabel="REGULAR" />
    <BlackFridayHeroOmnibusB />
    <BlackFridayDealerKickerB label="Datu atskaite" regularLabel="REGULAR" />
    <BlackFridayDealerBoxB />
  </>
);

const LOC: Array<[string, string, string, string, string]> = [
  ["lv", "17,49 €", "24,99 €", "Iepriekšējā cena: 24,99 €", "Beidzas pēc"],
  ["en", "€17.49", "€24.99", "Previous price: €24.99", "Ends in"],
  ["de", "17,49 €", "24,99 €", "Vorheriger Preis: 24,99 €", "Endet in"],
  ["ru", "17,49 €", "24,99 €", "Предыдущая цена: 24,99 €", "До конца"],
];

describe("Black Friday B dizains", () => {
  for (const [locale, now, old, omni, ends] of LOC) {
    it(`${locale}: josla, kapsula, hero cena, #dilera-dati bloks ar -30 %, pārsvītroto cenu un Omnibus`, () => {
      const html = renderHtml(wrap(locale, true, IN, all));
      const text = renderText(wrap(locale, true, IN, all));
      expect(html).toContain("data-promo-banner");
      expect(html).toContain("data-promo-capsule");
      expect(html).toContain("data-promo-box");
      expect(text).toContain(ends);
      expect(text).toContain("-30 %");
      expect(text).toContain(now);
      expect(html).toContain(`>${old}</s>`);
      expect(text).toContain(omni);
      expect(text).not.toContain("REGULAR");
      expect(html).toContain('role="timer"');
      expect(html).toContain('href="/?plan=dealer#home-hero"');
      expect(text).not.toMatch(/[–—]/);
    });
  }

  it("slēdzis izslēgts vai pēc beigām: nekā no akcijas, parastā cena", () => {
    for (const [enabled, at] of [
      [false, IN],
      [true, AFTER],
      [true, null],
    ] as const) {
      const html = renderHtml(wrap("lv", enabled, at, all));
      expect(html).not.toContain("data-promo");
      expect(html).not.toContain("Black Friday");
      expect(renderText(wrap("lv", enabled, at, all))).toContain("REGULAR");
    }
  });

  it("logs: dialogs ar aria-modal, virsrakstu, aizvēršanu, «Nē, paldies» un saiti uz dīlera datiem", () => {
    const promo = getBlackFridayPlanPrice("dealer", { nowMs: IN, enabled: true })!;
    for (const [locale, now, , omni] of LOC) {
      const html = renderHtml(
        <NextIntlClientProvider locale={locale} messages={{}}>
          <BlackFridayDialogB promo={promo} locale={locale} onClose={() => {}} />
        </NextIntlClientProvider>,
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      const labelled = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
      expect(labelled).toBeTruthy();
      expect(html).toContain(`id="${labelled}"`);
      /** Virsraksts tikai «Black Friday» (CSS lielie burti). */
      expect(new RegExp(`id="${labelled}"[^>]*>Black Friday</span>`).test(html)).toBe(true);
      expect(html).toContain("data-bf-close");
      expect(html).toMatch(/aria-label="(Aizvērt|Close|Schließen|Закрыть)"/);
      expect(html).toMatch(/Nē, paldies|No, thanks|Nein, danke|Нет, спасибо/);
      expect(html).toContain(now);
      expect(html).toContain(omni);
      /** B4: faktu rinda un CTA ar produkta nosaukumu. */
      expect(html).toMatch(/Pēc VIN vai numurzīmes|By VIN or licence plate|Per FIN oder Kennzeichen|По VIN или номерному знаку/);
      expect(html).toContain("Google");
      expect(html).toMatch(/Pasūtīt dīlera datus - |Order dealer data - |Händlerdaten bestellen - |Заказать данные дилера - /);
    }
  });
});

describe("Black Friday taimeris", () => {
  it("atlikušais laiks līdz 01.12. 23:59:59 Rīga", () => {
    expect(blackFridayCountdownParts(Date.parse("2026-12-01T21:59:00Z"))).toEqual(["00", "00", "01", "00"]);
    expect(blackFridayCountdownParts(Date.parse("2026-11-26T22:00:00Z"))).toEqual(["05", "00", "00", "00"]);
    expect(blackFridayCountdownParts(AFTER)).toEqual(["00", "00", "00", "00"]);
    const n = (x: string) => x.replace(/\u00a0/g, " ");
    expect(n(blackFridayCountdownLine(Date.parse("2026-11-30T21:00:00Z"), "lv"))).toBe("1 d 01:00:00");
    expect(n(blackFridayCountdownLine(Date.parse("2026-11-30T21:00:00Z"), "ru"))).toBe("1 д 01:00:00");
  });
});

import { blackFridayGuaranteeText } from "@/lib/promo/black-friday-copy";
import { getHomeV6Copy } from "@/lib/home-v6-copy";
import { popupDueAt, BF_POPUP_INTERVAL_MS } from "@/lib/promo/black-friday-hero";

describe("Black Friday B4 noteikumi", () => {
  it("garantija akcijas laikā: samaksātā summa, nevis 24,99 € (4 valodas)", () => {
    const want: Record<string, string> = {
      lv: "samaksāto summu ieskaitām",
      en: "the amount paid is credited",
      de: "den bezahlten Betrag auf",
      ru: "уплаченную сумму засчитаем",
    };
    for (const loc of ["lv", "en", "de", "ru"]) {
      const out = blackFridayGuaranteeText(getHomeV6Copy(loc).dealer.guaranteeText, loc);
      expect(out, loc).toContain(want[loc]);
      expect(out, loc).not.toMatch(/24[.,]99/);
    }
  });

  it("logs ne biežāk kā reizi 7 dienās", () => {
    const now = Date.parse("2026-11-28T10:00:00Z");
    expect(popupDueAt(null, now)).toBe(true);
    expect(popupDueAt(now - 1000, now)).toBe(false);
    expect(popupDueAt(now - BF_POPUP_INTERVAL_MS + 1, now)).toBe(false);
    expect(popupDueAt(now - BF_POPUP_INTERVAL_MS, now)).toBe(true);
  });
});
