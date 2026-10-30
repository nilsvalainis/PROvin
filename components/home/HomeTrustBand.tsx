import { getLocale, getTranslations } from "next-intl/server";
import { GOOGLE_REVIEWS, GOOGLE_REVIEWS_AGGREGATE_RATING, getGoogleReviewsProfileUrl } from "@/lib/google-reviews-data";
import { formatGoogleReviewRelativeDate } from "@/lib/google-reviews-relative";

/** Kopējie skaitļi (tie paši, kas «Trīs lietas» rindā zem virsraksta). */
const REVIEW_COUNT = "55";
const AUDITS_DONE = "300+";
const DATA_SOURCES = "5+";
const QUOTE_MAX = 200;
/** Īsākās un konkrētākās atsauksmes no `GOOGLE_REVIEWS`. */
const FEATURED_IDS = ["ieva-pilverte", "edgars-sulcs", "dzintars-jaunzems"];

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= QUOTE_MAX) return t;
  const cut = t.slice(0, QUOTE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), QUOTE_MAX * 0.6)).trim()}…`;
}

/** Sākumlapa zem «Bez maksas»: 4 skaitļi + 3 Google atsauksmes (makets «Pilna lapa»). */
export async function HomeTrustBand() {
  const t = await getTranslations("GoogleReviews");
  const locale = await getLocale();
  const rating = new Intl.NumberFormat(locale === "lv" ? "lv-LV" : locale, { minimumFractionDigits: 1 }).format(GOOGLE_REVIEWS_AGGREGATE_RATING);
  const reviews = FEATURED_IDS.map((id) => GOOGLE_REVIEWS.find((r) => r.id === id)).filter((r): r is (typeof GOOGLE_REVIEWS)[number] => Boolean(r));
  const kpis: Array<[string, string]> = [
    [rating, t("kpiRating")],
    [REVIEW_COUNT, t("kpiCount")],
    [AUDITS_DONE, t("kpiAudits")],
    [DATA_SOURCES, t("kpiSources")],
  ];

  return (
    <section id="atsauksmes" aria-labelledby="home-trust-heading" className="home-body-ink scroll-mt-16 bg-transparent">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-10 px-[max(1rem,env(safe-area-inset-left,0px))] py-14 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-16 lg:px-10">
        <h2 id="home-trust-heading" className="sr-only">
          {t("title")}
        </h2>
        <ul className="m-0 grid list-none grid-cols-2 border-y border-[#262a36] p-0 lg:grid-cols-4">
          {kpis.map(([value, label], i) => (
            <li
              key={label}
              className={`flex flex-col gap-2 py-6 pr-4 sm:py-8 lg:px-7 lg:first:pl-0 ${i % 2 === 0 ? "border-r border-[#262a36]" : ""} ${i < 2 ? "border-b border-[#262a36] lg:border-b-0" : ""} ${i === 1 ? "pl-4 lg:border-r" : ""} ${i === 3 ? "pl-4" : ""} ${i === 2 ? "lg:border-r" : ""}`}
            >
              <span className="whitespace-nowrap text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] text-zinc-50 sm:text-[3.5rem] lg:text-[4.5rem]">
                {value}
                {i === 0 ? (
                  <span className="ml-1 align-middle text-[1.4rem] text-[#f5b400]" aria-hidden>
                    ★
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] text-zinc-400 sm:text-sm">{label}</span>
            </li>
          ))}
        </ul>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="m-0 flex flex-col gap-3.5 rounded-[20px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 sm:p-7"
            >
              <div className="tracking-[3px] text-[15px] text-[#f5b400]" aria-label={t("starsAria")}>
                ★★★★★
              </div>
              <blockquote className="m-0 flex-1 text-[1.02rem] leading-relaxed text-zinc-200">“{clip(r.text)}”</blockquote>
              <figcaption className="text-[13px] text-zinc-400">
                <b className="font-semibold text-zinc-50">{r.author}</b> · Google · {formatGoogleReviewRelativeDate(locale, r.relative)}
              </figcaption>
            </figure>
          ))}
        </div>

        <a
          href={getGoogleReviewsProfileUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="self-center text-sm font-semibold text-[#5c9dff] no-underline transition hover:text-white"
        >
          {t("allReviews")} →
        </a>
      </div>
    </section>
  );
}
