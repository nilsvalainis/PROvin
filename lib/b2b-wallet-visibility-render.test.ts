import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import lvPartner from "@/messages/lv/partner.json";
import { B2bPartnerWalletHome } from "@/components/b2b/B2bPartnerWalletHome";
import {
  applyB2bWalletTopup,
  emptyB2bWallet,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
} from "@/lib/b2b-wallet";

function articleHtml(html: string, product: B2bWalletProductId): string {
  const marker = `data-wallet-product="${product}"`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const articleStart = html.lastIndexOf("<article", start);
  const end = html.indexOf("</article>", start);
  if (articleStart < 0 || end < 0) return "";
  return html.slice(articleStart, end + "</article>".length);
}
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never),
  useRouter: () => ({ replace: () => {}, push: () => {}, refresh: () => {} }),
}));

const IntlProvider = NextIntlClientProvider as unknown as FunctionComponent<{
  locale: string;
  messages: typeof lvPartner;
  timeZone: string;
}>;

function render(
  hidden: B2bWalletProductId[],
  overrides: B2bWalletPriceOverrides | null = null,
  reportLang: "lv" | "en" | "ru" | "de" | null = null,
): string {
  const wallet = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 5000, sessionId: "cs_r" }).wallet;
  return renderToStaticMarkup(
    createElement(
      IntlProvider,
      { locale: "lv", messages: lvPartner, timeZone: "Europe/Riga" },
      createElement(B2bPartnerWalletHome, {
        initialWallet: buildB2bWalletView(wallet, overrides, 50, hidden),
        legacy: null,
        initialReportLang: reportLang,
      }),
    ),
  );
}

const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

const RAW_SAMPLE = "/samples/b2b/dilera-dati-raw-paraugs.pdf";
const PRO_SAMPLE = "/samples/b2b/dilera-dati-pro-paraugs-lv.pdf";
const LANG_SWITCH = 'data-lang="de"';
const t = lvPartner.Partner;

describe("partner portal hides admin-hidden wallet cards", () => {
  it("shows all three cards with samples and an empty required PRO language selector", () => {
    const html = render([]);
    expect(textOf(html)).toContain(t.walletProductBusinessTitle);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(t.walletProductProTitle);
    expect(html).toContain(RAW_SAMPLE);
    expect(html).not.toContain(PRO_SAMPLE);
    expect(html).toContain(t.walletReportLangPlaceholder);
    expect(html).toContain(t.walletReportLangHint);
    expect(html).toContain(LANG_SWITCH);
    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/<article/g)).toHaveLength(3);
    const business = articleHtml(html, "business");
    const raw = articleHtml(html, "dealer_raw");
    const pro = articleHtml(html, "dealer_pro");
    expect(business).toContain('value="lv"');
    expect(business).toContain(LANG_SWITCH);
    expect(business).not.toContain(t.walletReportLangPlaceholder);
    expect(business).not.toContain(t.walletReportLangHint);
    expect(raw).not.toContain(t.walletReportLang);
    expect(raw).not.toContain(LANG_SWITCH);
    expect(pro).toContain(t.walletReportLangPlaceholder);
    expect(pro).toContain(t.walletReportLangHint);
    expect(pro).toContain('value=""');
  });

  it("shows the matching PRO sample after a language is chosen", () => {
    const html = render([], null, "lv");
    expect(html).toContain(PRO_SAMPLE);
    expect(html).not.toContain(t.walletReportLangHint);
    expect(html).toContain('value="lv"');
  });

  it("hides the PRO card together with its language switcher and sample link", () => {
    const html = render(["dealer_pro"]);
    expect(html).not.toContain(t.walletProductProTitle);
    expect(articleHtml(html, "dealer_pro")).toBe("");
    expect(html).not.toContain(PRO_SAMPLE);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(RAW_SAMPLE);
    expect(html).toContain("md:grid-cols-2");
    expect(articleHtml(html, "business")).toContain(LANG_SWITCH);
    expect(articleHtml(html, "dealer_raw")).not.toContain(LANG_SWITCH);
  });

  it("hides the RAW card and its sample link", () => {
    const html = render(["dealer_raw"]);
    expect(html).not.toContain(t.walletProductRawTitle);
    expect(html).not.toContain(RAW_SAMPLE);
    expect(html).toContain(t.walletProductProTitle);
    expect(html).toContain(LANG_SWITCH);
  });

  it("hides the Business card and its disabled sample badge", () => {
    const html = render(["business"]);
    expect(textOf(html)).not.toContain(t.walletProductBusinessTitle);
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(t.walletProductProTitle);
    expect(html).toContain(t.walletReportLangPlaceholder);
  });

  it("shows a notice when every product is hidden", () => {
    const html = render(["business", "dealer_raw", "dealer_pro"]);
    expect(html).toContain(t.walletNoProducts);
    expect(textOf(html)).not.toContain(t.walletProductBusinessTitle);
    expect(html).not.toContain(t.walletProductRawTitle);
    expect(html).not.toContain(t.walletProductProTitle);
    expect(html).not.toContain("Skatīt paraugu");
  });
});

describe("PROVIN Business product name", () => {
  it("is named PROVIN Business in every portal language", async () => {
    for (const loc of ["lv", "en", "de", "ru"] as const) {
      const msgs = (await import(`@/messages/${loc}/partner.json`)).default.Partner;
      expect(msgs.walletProductBusinessTitle).toBe("PROVIN Business");
      expect(msgs.titleAccent).toBe("Business");
      expect(JSON.stringify(msgs)).not.toContain("Business data");
    }
  });

  it("renders VIN in brand blue inside the Business card title only", () => {
    const html = render([]);
    expect(html).toContain(
      '<h2 class="mt-4 text-[1.08rem] font-bold leading-snug tracking-[-0.01em] text-zinc-100"><span><span class="inline"><span class="provin-wordmark-pro--rail-inherit">PRO</span><span class="provin-wordmark-logo-vin">VIN</span></span> Business</span></h2>',
    );
    expect(html.match(/provin-wordmark-logo-vin/g)).toHaveLength(1);
  });
});

describe("partner portal wallet card prices", () => {
  it("shows the default catalog prices without a discount badge", () => {
    const html = render([]);
    expect(html).toContain("79,99 €");
    expect(html).toContain("19,99 €");
    expect(html).toContain("24,99 €");
    expect(html).not.toContain("15,99 €");
    expect(html).not.toMatch(/-\d+%/);
  });

  it("badges a stored partner price against the new default", () => {
    const html = render([], { business: null, dealer_raw: 1599, dealer_pro: 1999 });
    expect(html).toContain("15,99 €");
    expect(html).toContain('aria-label="Iepriekšējā cena 19,99 €"');
    expect(html).toContain('aria-label="Iepriekšējā cena 24,99 €"');
    expect(html.match(/-20%/g)).toHaveLength(2);
  });
});
