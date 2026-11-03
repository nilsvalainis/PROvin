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
import styles from "./paldies.module.css";

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
  const steps = t.raw("steps") as { title: string; note: string }[];
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
        <div className={styles.wrap}>
          <svg className={styles.check} viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r="36" />
            <path d="M24 41l11 11 21-23" />
          </svg>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.lead}>{t("body")}</p>
          <ol className={styles.steps}>
            {steps.map((step, j) => (
              <li key={step.title} className={styles.step} style={{ ["--j" as string]: j }}>
                <i className={styles.dot} aria-hidden>
                  {j === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : null}
                </i>
                <b className={styles.stepTitle}>{step.title}</b>
                {step.note ? <span className={styles.stepNote}>{step.note}</span> : null}
              </li>
            ))}
          </ol>
          {sid && (
            <p className={styles.session}>
              {t("sessionLabel")} {sid}
            </p>
          )}
          <div className={styles.actions}>
            {sid && (
              // PDF lejupielāde (API), ne lapas navigācija.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/api/invoice/download" className={`${styles.btnSolid} provin-press`}>
                {t("downloadInvoice")}
              </a>
            )}
            <Link href="/" className={`${styles.btn} provin-press`}>
              {t("back")}
            </Link>
          </div>
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
