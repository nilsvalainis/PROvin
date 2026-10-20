import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Footer } from "@/components/Footer";
import { GoogleAdsPurchaseConversion } from "@/components/GoogleAdsPurchaseConversion";
import { MetaPurchaseConversion } from "@/components/MetaPurchaseConversion";
import { ThanksSessionUrlCleanup } from "@/components/ThanksSessionUrlCleanup";
import { getGoogleAdsPurchaseLabel } from "@/lib/google-ads";
import { getPaidCheckoutConversionValueEur } from "@/lib/google-ads-purchase-value";
import { resolveThanksPageConversion } from "@/lib/google-ads-thanks-conversion";
import {
  THANKS_SESSION_COOKIE_NAME,
  parseThanksCheckoutSessionId,
  readThanksSessionIdFromToken,
  signThanksSessionToken,
  thanksSessionCookieOptions,
} from "@/lib/thanks-session";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("thanksTitle"),
    description: t("thanksDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function ThanksPage({ searchParams, params }: Props) {
  const sp = await searchParams;
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Thanks" });
  const cookieStore = await cookies();
  const fromQuery = parseThanksCheckoutSessionId(sp.session_id);
  if (fromQuery) {
    const token = await signThanksSessionToken(fromQuery);
    if (token) cookieStore.set(THANKS_SESSION_COOKIE_NAME, token, thanksSessionCookieOptions());
  }
  const sid =
    fromQuery ?? (await readThanksSessionIdFromToken(cookieStore.get(THANKS_SESSION_COOKIE_NAME)?.value));
  // Konversija tikai apmaksātai Stripe sesijai (neapmaksāta / viltota / Stripe kļūda = nekā).
  const paidValue = sid ? await getPaidCheckoutConversionValueEur(sid) : null;
  const conversion = await resolveThanksPageConversion({
    sessionId: sid,
    label: getGoogleAdsPurchaseLabel(),
    getPaidValueEur: async () => paidValue,
  });

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <div className="mx-auto max-w-lg px-4 pb-16 pt-28 text-center sm:px-8 sm:pt-32">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-provin-accent text-white">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-10 text-[32px] font-semibold tracking-tight text-white/[0.96] sm:text-[40px]">{t("title")}</h1>
          <p className="mx-auto mt-5 max-w-[65ch] text-[17px] font-normal leading-relaxed text-white/70">{t("body")}</p>
          {sid && (
            <p className="mt-8 break-all rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-mono text-[12px] font-normal text-white/55">
              {t("sessionLabel")} {sid}
            </p>
          )}
          {sid && (
            // PDF lejupielāde (API), ne lapas navigācija.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/api/invoice/download"
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-provin-accent px-6 text-[17px] font-normal text-white"
            >
              {t("downloadInvoice")}
            </a>
          )}
          <Link
            href="/"
            className="mt-10 inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 text-[17px] font-normal text-white/80"
          >
            {t("back")}
          </Link>
        </div>
        <Footer />
      </div>
      <ThanksSessionUrlCleanup />
      {conversion ? (
        <GoogleAdsPurchaseConversion
          transactionId={conversion.transactionId}
          value={conversion.value}
          label={conversion.label}
        />
      ) : null}
      {sid && paidValue != null ? <MetaPurchaseConversion transactionId={sid} value={paidValue} /> : null}
    </div>
  );
}
