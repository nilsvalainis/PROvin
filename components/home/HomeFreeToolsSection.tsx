"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { contactMailtoHref, whatsappWebUrl } from "@/lib/contact";
import { FREE_EVAL_PREFILL_EVENT, type FreeEvalPrefillDetail } from "@/lib/free-eval-prefill";
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

const INPUT =
  "box-border min-h-12 w-full rounded-xl border border-white/15 bg-[rgb(8_10_14/0.55)] px-3.5 py-2.5 text-base text-[rgb(245_248_252/0.96)] outline-none transition placeholder:text-[rgb(210_214_222/0.45)] focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgb(37_99_235/0.22)]";
const BTN =
  "flex min-h-12 items-center justify-center rounded-full text-[0.84rem] font-semibold uppercase tracking-[0.04em] no-underline transition";
const BTN_PRIMARY = `${BTN} bg-gradient-to-b from-[#1a6fd4] to-[#1459ad] text-white hover:from-[#1459ad] hover:to-[#1459ad]`;

function Card({ icon, accent, title, body, children }: { icon: ReactNode; accent?: boolean; title: string; body: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-4">
      <span aria-hidden className={`mx-auto mb-2 block h-24 w-24 sm:h-[7.5rem] sm:w-[7.5rem] ${accent ? "text-[#5c9dff]" : "text-[#4a5a78]"}`}>
        {icon}
      </span>
      <h3 className="whitespace-pre-line border-t border-[#262a36] pt-5 text-center text-2xl font-bold leading-tight text-zinc-50">{title}</h3>
      <p className="flex-1 text-center text-[0.94rem] leading-relaxed text-zinc-400">{body}</p>
      {children}
    </article>
  );
}

/** Sākumlapa zem HERO: trīs bezmaksas soļi (VIN dekoders, sludinājuma iesūtīšana, jautājums). */
export function HomeFreeToolsSection() {
  const t = useTranslations("HomeFreeTools");
  const router = useRouter();
  const id = useId();
  const [vin, setVin] = useState("");
  const [listing, setListing] = useState("");

  function onVin(event: FormEvent) {
    event.preventDefault();
    const clean = vin.replace(/\s+/g, "").toUpperCase();
    router.push(clean ? `/vin-dekoders?vin=${encodeURIComponent(clean)}` : "/vin-dekoders");
  }

  function onListing(event: FormEvent) {
    event.preventDefault();
    const listingUrl = listing.trim();
    window.dispatchEvent(new CustomEvent<FreeEvalPrefillDetail>(FREE_EVAL_PREFILL_EVENT, { detail: { listingUrl } }));
    const el = document.getElementById(FREE_EVAL_SECTION_ID);
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="border-b border-[#1d2130] bg-[#07080b]">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-12 px-[max(1rem,env(safe-area-inset-left,0px))] py-14 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:gap-16 sm:py-20 lg:px-10 lg:pb-[4.5rem] lg:pt-[5.5rem]">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <h2
            id={`${id}-h`}
            className="text-balance text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] text-zinc-50 sm:text-[3.4rem] lg:col-span-7 lg:text-[4.25rem]"
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

        <div className="grid gap-14 md:grid-cols-3 md:gap-12">
          <Card icon={ICONS.vin} accent title={t("vinTitle")} body={t("vinBody")}>
            <form className="flex flex-col gap-2.5" onSubmit={onVin}>
              <label htmlFor={`${id}-vin`} className="sr-only">
                {t("vinPlaceholder")}
              </label>
              <input
                id={`${id}-vin`}
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                placeholder={t("vinPlaceholder")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={24}
                className={`${INPUT} uppercase placeholder:normal-case`}
              />
              <button type="submit" className={BTN_PRIMARY}>
                {t("vinSubmit")}
              </button>
            </form>
          </Card>

          <Card icon={ICONS.listing} title={t("listingTitle")} body={t("listingBody")}>
            <form className="flex flex-col gap-2.5" onSubmit={onListing}>
              <label htmlFor={`${id}-listing`} className="sr-only">
                {t("listingPlaceholder")}
              </label>
              <input
                id={`${id}-listing`}
                type="url"
                inputMode="url"
                value={listing}
                onChange={(e) => setListing(e.target.value)}
                placeholder={t("listingPlaceholder")}
                autoComplete="off"
                className={INPUT}
              />
              <button type="submit" className={BTN_PRIMARY}>
                {t("listingSubmit")}
              </button>
            </form>
          </Card>

          <Card icon={ICONS.ask} title={t("askTitle")} body={t("askBody")}>
            <div className="flex gap-2.5">
              <a
                href={whatsappWebUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BTN} flex-1 bg-gradient-to-b from-[#1f9d4f] to-[#16833f] text-white hover:from-[#16833f] hover:to-[#16833f]`}
              >
                WhatsApp
              </a>
              <a href={contactMailtoHref()} className={`${BTN} flex-1 bg-white text-[#0a0a0b] hover:bg-zinc-200`}>
                {t("askEmail")}
              </a>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
