import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import lvPartner from "@/messages/lv/partner.json";
import { B2bPartnerWalletHome } from "@/components/b2b/B2bPartnerWalletHome";
import { applyB2bWalletTopup, emptyB2bWallet, type B2bWalletProductId } from "@/lib/b2b-wallet";
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

function render(hidden: B2bWalletProductId[]): string {
  const wallet = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 5000, sessionId: "cs_r" }).wallet;
  return renderToStaticMarkup(
    createElement(
      IntlProvider,
      { locale: "lv", messages: lvPartner, timeZone: "Europe/Riga" },
      createElement(B2bPartnerWalletHome, {
        initialWallet: buildB2bWalletView(wallet, null, 50, hidden),
        legacy: null,
      }),
    ),
  );
}

const RAW_SAMPLE = "/samples/b2b/dilera-dati-raw-paraugs.pdf";
const PRO_SAMPLE = "/samples/b2b/dilera-dati-pro-paraugs-lv.pdf";
const LANG_SWITCH = 'data-lang="de"';
const t = lvPartner.Partner;

describe("partner portal hides admin-hidden wallet cards", () => {
  it("shows all three cards with samples and the PRO language switcher by default", () => {
    const html = render([]);
    expect(html).toContain(t.walletProductBusinessTitle);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(t.walletProductProTitle);
    expect(html).toContain(RAW_SAMPLE);
    expect(html).toContain(PRO_SAMPLE);
    expect(html).toContain(LANG_SWITCH);
    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/<article/g)).toHaveLength(3);
  });

  it("hides the PRO card together with its language switcher and sample link", () => {
    const html = render(["dealer_pro"]);
    expect(html).not.toContain(t.walletProductProTitle);
    expect(html).not.toContain(LANG_SWITCH);
    expect(html).not.toContain(PRO_SAMPLE);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(RAW_SAMPLE);
    expect(html).toContain("md:grid-cols-2");
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
    expect(html).not.toContain(t.walletProductBusinessTitle);
    expect(html).not.toContain('aria-disabled="true"');
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain(t.walletProductRawTitle);
    expect(html).toContain(t.walletProductProTitle);
  });

  it("shows a notice when every product is hidden", () => {
    const html = render(["business", "dealer_raw", "dealer_pro"]);
    expect(html).toContain(t.walletNoProducts);
    expect(html).not.toContain(t.walletProductBusinessTitle);
    expect(html).not.toContain(t.walletProductRawTitle);
    expect(html).not.toContain(t.walletProductProTitle);
    expect(html).not.toContain("Skatīt paraugu");
  });
});
