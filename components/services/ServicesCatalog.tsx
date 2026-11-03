"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { SampleReportLightbox } from "@/components/home/SampleReportLightbox";
import { Link } from "@/i18n/navigation";
import {
  catalogPackageAnchorId,
  getCatalogFeatureBreakdownPackages,
  type HomeFeatureBreakdownPackage,
  type HomeFeatureBreakdownPackageId,
} from "@/lib/home-feature-breakdown";
import { homeContentMaxClass, homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { renderProvinText } from "@/lib/provin-wordmark";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import { sampleMobilePage1Src, samplePdfHref } from "@/lib/sample-public-assets";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";
import type { Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

const SAMPLES_ANCHOR_ID = "paraugi";
const ORDER: HomeFeatureBreakdownPackageId[] = ["audits", "mini", "dealer", "koreaUsa", "partner"];
const DESKTOP_MQ = "(min-width: 1024px)";

type Sample = { id: string; href: string; anchorId?: string; title: string };

/** Cena no CTA teksta („… 99,99 €” / „… €99.99”), lai tā vienmēr sakristu ar pogu. */
export function packagePriceLabel(buttonText: string): string | null {
  const m = buttonText.match(/€\s?\d+[.,]\d{2}|\d+[.,]\d{2}\s?€/);
  return m ? m[0] : null;
}

/** Īsais nosaukums segmentiem: „PROVIN AUDITS” -> „AUDITS”. */
export function packageShortLabel(title: string): string {
  return title.replace(/^PROVIN\s+/i, "");
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M3 12h11M10 8l4 4-4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="svc-ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ServicesCatalog() {
  const locale = useLocale();
  const t = useTranslations("Samples");
  const uiCopy = getTp5UiCopy(locale);
  const packages = ORDER.map((id) => getCatalogFeatureBreakdownPackages(locale).find((p) => p.id === id)).filter(
    (p): p is HomeFeatureBreakdownPackage => Boolean(p),
  );
  const [activeId, setActiveId] = useState<HomeFeatureBreakdownPackageId>(packages[0]?.id ?? "audits");
  const [lightbox, setLightbox] = useState<Sample | null>(null);

  const auditSamples: Sample[] = SAMPLE_REPORTS.map((s) => ({
    id: s.id,
    href: s.href,
    anchorId: sampleReportAnchorId(s.id),
    title: t(`items.${s.id}.title`),
  }));

  const samplesFor = (pkg: HomeFeatureBreakdownPackage): Sample[] => {
    if (pkg.id === "audits") return auditSamples;
    return pkg.sampleReportHref ? [{ id: pkg.id, href: pkg.sampleReportHref, title: pkg.title }] : [];
  };

  const selectFromHash = useCallback(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    let target: HomeFeatureBreakdownPackageId | null = null;
    if (hash === SAMPLES_ANCHOR_ID || hash.startsWith("paraugs-")) target = "audits";
    else target = packages.find((p) => catalogPackageAnchorId(p.id) === hash)?.id ?? null;
    if (!target) return;
    setActiveId(target);
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    });
    // packages ir atvasināti no locale; pietiek ar to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [selectFromHash]);

  const onSampleClick = (event: MouseEvent<HTMLAnchorElement>, sample: Sample) => {
    recordSampleReportClick();
    if (!window.matchMedia(DESKTOP_MQ).matches) return;
    event.preventDefault();
    setLightbox(sample);
  };

  const tabId = (id: string, variant: "d" | "m") => `svc-tab-${variant}-${id}`;

  return (
    <section
      id="pakalpojumi"
      className="scroll-mt-16 bg-transparent px-4 pb-4 sm:px-6"
      aria-labelledby="svc-catalog-heading"
    >
      <div className={homeContentMaxClass}>
        <h2 id="svc-catalog-heading" className="sr-only">
          {uiCopy.catalogHeading}
        </h2>

        {/* Dators: cenu josla */}
        <div className="svc-strip" role="tablist" aria-label={uiCopy.catalogNavAria} style={{ gridTemplateColumns: `repeat(${packages.length}, minmax(0, 1fr))` }}>
          {packages.map((pkg) => {
            const active = pkg.id === activeId;
            const price = packagePriceLabel(pkg.buttonText);
            return (
              <div key={pkg.id} className={`svc-cell${active ? " is-on" : ""}`}>
                <button
                  type="button"
                  role="tab"
                  id={tabId(pkg.id, "d")}
                  aria-selected={active}
                  aria-controls={catalogPackageAnchorId(pkg.id)}
                  className="svc-cell-btn"
                  onClick={() => setActiveId(pkg.id)}
                >
                  <b>{pkg.title}</b>
                  {price ? <em>{price}</em> : <span className="svc-cell-gap" aria-hidden />}
                </button>
                {pkg.ctaHref ? (
                  <Link href={pkg.ctaHref} className="svc-login" aria-label={pkg.buttonText} title={pkg.buttonText}>
                    <LoginIcon />
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Telefons: segmenti */}
        <div className="svc-seg" role="tablist" aria-label={uiCopy.catalogNavAria} style={{ gridTemplateColumns: `repeat(${packages.length}, minmax(0, 1fr))` }}>
          {packages.map((pkg) => {
            const active = pkg.id === activeId;
            return (
              <button
                key={pkg.id}
                type="button"
                role="tab"
                id={tabId(pkg.id, "m")}
                aria-selected={active}
                aria-controls={catalogPackageAnchorId(pkg.id)}
                className={`svc-seg-btn${active ? " is-on" : ""}`}
                onClick={() => setActiveId(pkg.id)}
              >
                {packageShortLabel(pkg.title)}
              </button>
            );
          })}
        </div>

        <div className="svc-panels">
          {packages.map((pkg) => {
            const active = pkg.id === activeId;
            const price = packagePriceLabel(pkg.buttonText);
            const [goalFirst, ...goalMore] = pkg.goal.split(/\n\n+/);
            const samples = samplesFor(pkg);
            const checkoutHref = pkg.ctaHref ?? homeHeroCheckoutHref(pkg.id as Tp5MobileServiceId);
            return (
              <article
                key={pkg.id}
                id={catalogPackageAnchorId(pkg.id)}
                role="tabpanel"
                aria-labelledby={tabId(pkg.id, "d")}
                hidden={!active}
                className="svc-panel scroll-mt-24"
              >
                {pkg.newBadge ? (
                  <p className="svc-badge is-new">{uiCopy.newBadge}</p>
                ) : pkg.badge ? (
                  <p className="svc-badge">{pkg.badge}</p>
                ) : null}
                <h3 className="svc-name">{renderProvinText(pkg.title, homeDarkProvinWordmarkOptions)}</h3>
                <p className="svc-price">
                  {price ?? (
                    pkg.ctaHref ? (
                      <Link href={pkg.ctaHref} className="svc-login is-big" aria-label={pkg.buttonText}>
                        <LoginIcon />
                      </Link>
                    ) : null
                  )}
                </p>
                <p className="svc-goal-label">{uiCopy.goalLabel}</p>
                <p className="svc-goal">{renderProvinText(goalFirst ?? "", homeDarkProvinWordmarkOptions)}</p>
                {goalMore.length > 0 ? (
                  <details className="svc-more">
                    <summary>{t("readMore")}</summary>
                    {goalMore.map((para, i) => (
                      <p key={i} className="svc-goal">
                        {renderProvinText(para, homeDarkProvinWordmarkOptions)}
                      </p>
                    ))}
                  </details>
                ) : null}

                <div className="svc-fan" id={pkg.id === "audits" ? SAMPLES_ANCHOR_ID : undefined}>
                  <div className={`svc-fan-stack n${Math.max(1, samples.length)}`}>
                    {samples.length === 0 ? (
                      <div className="svc-pdf is-soon">
                        <span>{uiCopy.sampleReportComingSoon}</span>
                      </div>
                    ) : (
                      samples.map((s, i) => {
                        const img = sampleMobilePage1Src(s.href);
                        return (
                          <a
                            key={s.id}
                            id={s.anchorId}
                            href={samplePdfHref(s.href)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`svc-pdf p${i}`}
                            aria-label={`${uiCopy.sampleReportPreviewLabel}: ${s.title} - ${t("enlargeLabel")}`}
                            onClick={(e) => onSampleClick(e, s)}
                          >
                            {img ? (
                              <Image src={img} alt="" width={236} height={334} sizes="118px" className="svc-pdf-img" />
                            ) : null}
                            <em>PDF</em>
                          </a>
                        );
                      })
                    )}
                  </div>
                  {samples.length > 0 ? (
                    <p className="svc-fan-cap">
                      {pkg.id === "audits"
                        ? renderProvinText(
                            `${t("exampleLabel")} ${auditSamples.map((s) => s.title).join(" · ")}`,
                            homeDarkProvinWordmarkOptions,
                          )
                        : uiCopy.sampleReportPreviewLabel}
                    </p>
                  ) : null}
                </div>

                <ul className="svc-features">
                  {pkg.items.map((item) => (
                    <li key={item.title}>
                      <CheckIcon />
                      <div>
                        <b>{renderProvinText(item.title, homeDarkProvinWordmarkOptions)}</b>
                        <span>{renderProvinText(item.description, homeDarkProvinWordmarkOptions)}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="svc-cta">
                  {pkg.ctaHref ? (
                    <Link
                      href={checkoutHref}
                      className="provin-press inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.05] px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90 no-underline transition hover:border-white/50 sm:w-auto sm:min-w-[18rem]"
                    >
                      {pkg.buttonText}
                    </Link>
                  ) : (
                    <div className={`${tp5Styles.ctaWrap} w-full sm:w-auto sm:min-w-[20rem]`}>
                      <Link href={checkoutHref} className={tp5Styles.liquidCtaLink}>
                        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                        <span className={tp5Styles.liquidCtaLabel}>{pkg.buttonText}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {lightbox ? (
        <SampleReportLightbox
          open
          href={samplePdfHref(lightbox.href)}
          title={lightbox.title}
          closeLabel={t("closeLabel")}
          openPdfLabel={t("openPdfLabel")}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}
