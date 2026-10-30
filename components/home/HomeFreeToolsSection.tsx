"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { contactMailtoHref, whatsappWebUrl } from "@/lib/contact";
import { VinDecoderTool, type VinDecoderLabels } from "@/components/vin-decoder/VinDecoderTool";
import { FREE_EVAL_PREFILL_EVENT, type FreeEvalPrefillDetail } from "@/lib/free-eval-prefill";
import { requestHeroPrefill } from "@/lib/hero-prefill";
import { FREE_EVAL_SECTION_ID } from "@/lib/paths";


const ICON_PROPS = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 0.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "block h-full w-full",
};

const ICONS: Record<"vin" | "listing" | "ask", ReactNode> = {
  vin: (
    <svg {...ICON_PROPS}>
      <path d="M7 30v-6l4-9a3 3 0 0 1 2.8-2h14.4a3 3 0 0 1 2.8 2l4 9v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z" />
      <path d="M7 24h28" />
      <circle cx="13" cy="32" r="3" />
      <circle cx="29" cy="32" r="3" />
      <circle cx="36" cy="14" r="6" />
      <path d="m40.5 18.5 4 4" />
    </svg>
  ),
  listing: (
    <svg {...ICON_PROPS}>
      <path d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M29 4v9h9" />
      <path d="M15 26v-3l2-4h10l2 4v3a1 1 0 0 1-1 1H16a1 1 0 0 1-1-1Z" />
      <path d="M15 23h14" />
      <path d="M15 33h18M15 38h12" />
    </svg>
  ),
  ask: (
    <svg {...ICON_PROPS}>
      <path d="M8 10h24a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H18l-7 6v-6H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" />
      <path d="M38 18h2a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-2v5l-6-5H22a3 3 0 0 1-3-3" />
      <path d="M13 18h14M13 22h9" />
    </svg>
  ),
};

/** Projekta pogas: zila (HERO `liquidCta`) tikai VIN pārbaudei, pārējās - kontūras pogas. */
const GHOST_BTN =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 no-underline transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white";
const PRIMARY_BTN = `${tp5Styles.liquidCta} !w-auto !min-h-[44px] !px-6 !py-0 !text-[11px]`;

function Card({ icon, active, title, body, children, className = "" }: { icon: ReactNode; active?: boolean; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <article className={`flex flex-col gap-4 ${className}`}>
      <span aria-hidden className={`mx-auto mb-1 block h-24 w-24 sm:h-[6.5rem] sm:w-[6.5rem] ${active ? "text-[#5c9dff]" : "text-[#4a5a78]"}`}>
        {icon}
      </span>
      <h3 className={`text-balance border-t pt-5 text-center text-[1.4rem] font-bold leading-tight text-zinc-50 ${active ? "border-[#2563eb]" : "border-[#262a36]"}`}>{title}</h3>
      <p className="flex-1 text-center text-[0.94rem] leading-relaxed text-zinc-400">{body}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </article>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * Sākumlapa zem HERO: trīs bezmaksas soļi. Pirmajā solī tikai pogas; VIN / numurzīmes pārbaude
 * atveras turpat (bez pārejas uz /vin-dekoders), rezultāts nodod VIN uz HERO pasūtījumu vai sludinājuma formu.
 */
export function HomeFreeToolsSection({ decoderLabels, home }: { decoderLabels: VinDecoderLabels; home: string }) {
  const t = useTranslations("HomeFreeTools");
  const locale = useLocale();
  const id = useId();
  const [vinOpen, setVinOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function openVin() {
    setVinOpen(true);
    window.requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    });
  }

  function openListing(detail: FreeEvalPrefillDetail) {
    window.dispatchEvent(new CustomEvent<FreeEvalPrefillDetail>(FREE_EVAL_PREFILL_EVENT, { detail }));
    window.requestAnimationFrame(() => scrollToId(FREE_EVAL_SECTION_ID));
  }

  return (
    <section aria-labelledby={`${id}-h`} className="border-b border-[#1d2130] bg-[#07080b]">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-12 px-[max(1rem,env(safe-area-inset-left,0px))] py-14 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:gap-16 sm:py-20 lg:px-10 lg:pb-[4.5rem] lg:pt-[5.5rem]">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <h2
            id={`${id}-h`}
            className="text-balance text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[3.3rem] lg:col-span-7 lg:text-[4rem]"
          >
            {t("title")} <span className="text-[#5c9dff]">{t("titleAccent")}</span>
          </h2>
          <div className="flex flex-col gap-3 lg:col-span-5">
            <p className="text-[1.05rem] leading-relaxed text-zinc-200 sm:text-lg">{t("lead")}</p>
            <p className="text-sm text-zinc-400">
              <span className="text-[#f5b400]" aria-hidden>
                ★
              </span>{" "}
              {t("stats")}
            </p>
          </div>
        </div>

        <div className="grid gap-14 md:grid-cols-3 md:gap-x-10 md:gap-y-12 lg:gap-x-16 xl:gap-x-20">
          <Card icon={ICONS.vin} active title={t("vinTitle")} body={t("vinBody")} className="order-1">
            <button type="button" onClick={openVin} aria-expanded={vinOpen} aria-controls={`${id}-vin`} className={PRIMARY_BTN}>
              <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
              <span className={tp5Styles.liquidCtaLabel}>{t("vinOpen")}</span>
            </button>
          </Card>

          {vinOpen ? (
            <div
              ref={panelRef}
              id={`${id}-vin`}
              className="order-2 scroll-mt-[calc(4.75rem+env(safe-area-inset-top,0px))] rounded-[20px] border border-white/[0.09] bg-white/[0.02] p-4 sm:p-7 md:order-4 md:col-span-3"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-[15px] font-semibold text-zinc-50">{t("vinTitle")}</p>
                <button type="button" onClick={() => setVinOpen(false)} className="text-[13px] text-zinc-400 transition hover:text-white">
                  {t("close")} ✕
                </button>
              </div>
              <VinDecoderTool
                locale={locale}
                labels={decoderLabels}
                home={home}
                source="home"
                autoFocus
                onAudit={(q, plan) => requestHeroPrefill({ vin: q, plan })}
                onListing={(listingUrl, q) => openListing({ listingUrl, vin: q })}
              />
            </div>
          ) : null}

          <Card icon={ICONS.listing} title={t("listingTitle")} body={t("listingBody")} className="order-3 md:order-2">
            <button type="button" onClick={() => openListing({ listingUrl: "" })} className={GHOST_BTN}>
              {t("listingOpen")}
            </button>
          </Card>

          <Card icon={ICONS.ask} title={t("askTitle")} body={t("askBody")} className="order-4 md:order-3">
            <a href={whatsappWebUrl()} target="_blank" rel="noopener noreferrer" className={GHOST_BTN}>
              WhatsApp
            </a>
            <a href={contactMailtoHref()} className={GHOST_BTN}>
              {t("askEmail")}
            </a>
          </Card>
        </div>
      </div>
    </section>
  );
}
