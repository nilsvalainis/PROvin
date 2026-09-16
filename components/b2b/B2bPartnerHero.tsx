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
          className={`${homeFooterColumnClass} grid items-center gap-8 pt-[calc(3.2rem+env(safe-area-inset-top,0px))] pb-8 lg:grid-cols-12 lg:gap-16 lg:pb-12 lg:pt-20 ${
            widePanel ? "" : "min-h-[calc(100svh-1rem)]"
          }`}
        >
          <div className="order-2 hidden min-w-0 lg:order-1 lg:col-span-7 lg:block">
            <p className="mb-3 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("heroPartnerEyebrow")}
            </p>
            <h1 className={styles.heroTitleDesktop}>
              {t("titlePrefix")}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>{t("titleAccent")}</span>
            </h1>
            <p className="mt-5 max-w-[32rem] text-[1.05rem] leading-[1.45] text-zinc-200">
              {t("heroSubhead")}
            </p>
            <div className={`${styles.tp5DesktopFeatureRow} mt-8 !block`}>
              <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
            </div>
            <B2bHeroSourceList items={sources} />
          </div>

          <div
            className={`order-1 mx-auto w-full lg:order-2 lg:col-span-5 lg:mx-0 ${
              widePanel ? "max-w-[36rem] lg:max-w-none" : "max-w-[22rem] lg:ml-auto lg:max-w-[27.5rem]"
            }`}
          >
            <h1 id="b2b-partner-hero-title" className="sr-only lg:hidden">
              {t("titlePrefix")}
              {t("titleAccent")}
            </h1>
            <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
              <div className={styles.spatialCard}>
                <h2 className="mb-4 text-center text-[1.05rem] font-bold tracking-[-0.01em] text-zinc-100">
                  {t("heroCardTitle")}
                </h2>
                {aside}
              </div>
            </div>
          </div>
        </div>

        <div className={`${homeFooterColumnClass} relative z-[3] pb-10 lg:pb-14`}>
          <div>
            <h2 className="mb-5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("heroWhyHeading")}
            </h2>
            <div className="grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {beats.map((beat, index) => (
                <article key={beat.label} className="min-w-0">
                  <p className="flex items-baseline gap-2.5">
                    <span className="text-[0.58rem] font-bold tabular-nums tracking-[0.12em] text-[#60a5fa]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
                      {beat.label}
                    </span>
                  </p>
                  <p className="mt-2.5 text-[0.84rem] font-normal leading-[1.58] text-zinc-300 lg:text-[0.88rem] lg:leading-[1.6]">
                    {beat.body}
                  </p>
                </article>
              ))}
            </div>
            {hideContact && !afterContact ? null : (
              <div className="mt-6 space-y-2">
                {hideContact ? null : (
                  <>
                    <p className="text-[0.84rem] font-medium leading-snug text-zinc-100 sm:text-[0.9rem]">
                      {t("heroContactLead")}
                    </p>
                    <p className="text-[0.82rem] leading-relaxed text-zinc-400 sm:text-[0.875rem]">
                      {t("loginEmail")}:{" "}
                      <a
                        href={`mailto:${email}`}
                        className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
                      >
                        {email}
                      </a>
                      {" | "}
                      {t("heroPhoneLabel")}:{" "}
                      <a
                        href={`tel:${CONTACT_PHONE_TEL}`}
                        className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
                      >
                        {CONTACT_PHONE_TEL}
                      </a>
                    </p>
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
