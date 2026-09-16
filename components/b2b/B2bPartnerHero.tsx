"use client";

import { type ReactNode } from "react";
import {
  Camera,
  ClipboardCheck,
  Gauge,
  Globe2,
  Layers,
  List,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { CONTACT_PHONE_TEL, contactEmail } from "@/lib/contact";
import { getB2bHeroSourceItems, type B2bCatalogItem } from "@/lib/b2b-partner-copy";
import { homeFooterColumnClass } from "@/lib/home-layout";

const SOURCE_ICON_CLASS = "h-4 w-4 shrink-0 [stroke-width:1.6] text-[#60a5fa]";

function SourceGlyph({ icon }: { icon: B2bCatalogItem["icon"] }) {
  if (icon === "store") return <Store className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "globe") return <Globe2 className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "camera") return <Camera className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "shield") return <ShieldCheck className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "clipboard") return <ClipboardCheck className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "list") return <List className={SOURCE_ICON_CLASS} aria-hidden />;
  if (icon === "gauge") return <Gauge className={SOURCE_ICON_CLASS} aria-hidden />;
  return <Layers className={SOURCE_ICON_CLASS} aria-hidden />;
}

function B2bHeroSourceList({ items }: { items: B2bCatalogItem[] }) {
  return (
    <ul className="mt-8 grid max-w-[34rem] grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-center gap-2.5 border-b border-white/[0.08] py-[0.7rem]"
        >
          <SourceGlyph icon={item.icon} />
          <span className="min-w-0 text-[0.74rem] font-semibold leading-snug text-zinc-100">
            {item.title}
          </span>
        </li>
      ))}
    </ul>
  );
}

function B2bHeroContactLinks({ email, labeled }: { email: string; labeled: boolean }) {
  const t = useTranslations("Partner");
  return (
    <p className="text-[0.82rem] leading-relaxed text-zinc-400">
      {labeled ? `${t("loginEmail")}: ` : null}
      <a
        href={`mailto:${email}`}
        className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
      >
        {email}
      </a>
      {" | "}
      {labeled ? `${t("heroPhoneLabel")}: ` : null}
      <a
        href={`tel:${CONTACT_PHONE_TEL}`}
        className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
      >
        {CONTACT_PHONE_TEL}
      </a>
    </p>
  );
}

export function B2bPartnerHero({
  afterContact,
  panel,
  hideContact = false,
  widePanel = false,
}: {
  afterContact?: ReactNode;
  /** Login by default; invite register (or invalid-token copy) replaces the aside. */
  panel?: ReactNode;
  hideContact?: boolean;
  widePanel?: boolean;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const email = contactEmail();
  const sources = getB2bHeroSourceItems(locale);
  const aside = panel ?? <B2bPartnerLogin />;
  const beats = [
    { label: t("heroBeatRisk"), body: t("heroLead") },
    { label: t("heroBeatReputation"), body: t("heroLeadProof") },
    { label: t("heroBeatSafety"), body: t("heroLeadTrust") },
  ];

  return (
    <div className={styles.heroPricingShell}>
      <section
        id="b2b-partner-hero"
        className={styles.heroSurface}
        aria-labelledby="b2b-partner-hero-title"
      >
        <div
          className={`${homeFooterColumnClass} grid items-start gap-6 pt-[calc(3.2rem+env(safe-area-inset-top,0px))] pb-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:pb-12 lg:pt-20 ${
            widePanel ? "" : "lg:min-h-[calc(100svh-1rem)]"
          }`}
        >
          <div className="min-w-0 lg:col-span-7">
            <p className="mb-3 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("heroPartnerEyebrow")}
            </p>
            <h1
              id="b2b-partner-hero-title"
              className={`${styles.heroTitleDesktop} text-[2rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-white`}
            >
              {t("titlePrefix")}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>{t("titleAccent")}</span>
            </h1>
            <p className="mt-3 max-w-[32rem] text-[0.95rem] leading-[1.45] text-zinc-200 lg:mt-5 lg:text-[1.05rem]">
              {t("heroSubhead")}
            </p>
            <div className={`${styles.tp5DesktopFeatureRow} mt-8`}>
              <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
            </div>
            <div className="hidden lg:block">
              <B2bHeroSourceList items={sources} />
            </div>
          </div>

          <div
            className={`mx-auto w-full lg:col-span-5 lg:mx-0 ${
              widePanel ? "max-w-[36rem] lg:max-w-none" : "max-w-[22rem] lg:ml-auto lg:max-w-[27.5rem]"
            }`}
          >
            <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
              <div className={styles.spatialCard}>
                <h2 className="mb-4 text-center text-[1.05rem] font-bold tracking-[-0.01em] text-zinc-100">
                  {t("heroCardTitle")}
                </h2>
                {aside}
              </div>
            </div>
            {hideContact ? null : (
              <div className="mt-4 text-center lg:hidden">
                <B2bHeroContactLinks email={email} labeled={false} />
              </div>
            )}
          </div>
        </div>

        <div className={`${homeFooterColumnClass} relative z-[3] pb-10 lg:pb-14`}>
          <div>
            <h2 className="mb-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd] lg:mb-5">
              {t("heroWhyHeading")}
            </h2>
            <div className="grid grid-cols-1 items-start lg:grid-cols-3">
              {beats.map((beat) => (
                <article
                  key={beat.label}
                  className="min-w-0 border-b border-white/10 py-6 first:pt-0 last:border-b-0 last:pb-0 lg:border-b-0 lg:border-l lg:border-white/10 lg:px-10 lg:py-0 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
                >
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
                    {beat.label}
                  </p>
                  <p className="mt-2.5 text-[0.84rem] font-normal leading-[1.58] text-zinc-300 lg:text-[0.88rem] lg:leading-[1.6]">
                    {beat.body}
                  </p>
                </article>
              ))}
            </div>
            {hideContact && !afterContact ? null : (
              <div className={`space-y-2 ${hideContact ? "mt-6" : "mt-6 hidden lg:block"}`}>
                {hideContact ? null : (
                  <>
                    <p className="text-[0.84rem] font-medium leading-snug text-zinc-100 sm:text-[0.9rem]">
                      {t("heroContactLead")}
                    </p>
                    <B2bHeroContactLinks email={email} labeled />
                  </>
                )}
                {afterContact}
              </div>
            )}
          </div>
          <div className="lg:hidden">
            <B2bHeroSourceList items={sources} />
          </div>
        </div>
      </section>
    </div>
  );
}
