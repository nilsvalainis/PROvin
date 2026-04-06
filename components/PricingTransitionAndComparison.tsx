import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

type Row = { feature: string; standard: string; provin: string };

/** Standarta kolonna: „Nav” → pelēks X; „1 avots” → dzeltens ✓ + teksts; garš teksts — tikai teksts. */
function StandardValue({ value }: { value: string }) {
  const nav = value.trim().toLowerCase() === "nav";
  if (nav) {
    return (
      <span className="inline-flex flex-col items-center justify-center gap-1" title="Nav">
        <IconX className="h-6 w-6 text-[#c4c4c8]" aria-hidden />
        <span className="sr-only">Nav</span>
      </span>
    );
  }
  if (value.trim() === "1 avots") {
    return (
      <span className="inline-flex flex-col items-center justify-center gap-1.5 text-center">
        <IconCheckLimited className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <span className="text-[10px] font-medium leading-snug text-[#5c5d62] sm:text-[11px]">{value}</span>
      </span>
    );
  }
  return (
    <span className="mx-auto block max-w-[20ch] text-[10px] font-medium leading-snug text-[#5c5d62] sm:max-w-[24ch] sm:text-[11px]">
      {value}
    </span>
  );
}

/** PROVIN kolonna: zaļš ✓ + trekns apakšteksts. */
function ProvinValue({ value }: { value: string }) {
  return (
    <span className="inline-flex flex-col items-center justify-center gap-1.5 text-center">
      <IconCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
      <span className="max-w-[18ch] text-[11px] font-semibold leading-snug text-[#1d1d1f] sm:text-[12px] sm:leading-snug">
        {value}
      </span>
    </span>
  );
}

export async function PricingTransitionAndComparison() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const orderHref = orderSectionHref(locale);
  const messages = await getMessages();
  const rows = (messages as { Pricing: { comparisonRows: Row[] } }).Pricing.comparisonRows;

  return (
    <div className="mt-6 min-w-0 space-y-8 sm:mt-8">
      <div
        className="relative overflow-hidden rounded-2xl bg-[#14161c] px-4 py-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.2)] sm:px-8 sm:py-10"
        role="region"
        aria-label={t("transitionQuoteAria")}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,102,214,0.18),transparent_55%)]"
          aria-hidden
        />
        <p className="relative text-balance text-[1.125rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.375rem] sm:leading-tight md:text-2xl">
          {t("transitionQuotePart1")}
          <Link
            href={orderHref}
            className="text-white underline decoration-white/45 underline-offset-[3px] transition hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {t("transitionQuoteLink")}
          </Link>
          {t("transitionQuotePart2")}
        </p>
      </div>

      <div className="min-w-0">
        <h2 className="text-balance text-center text-[13px] font-bold uppercase leading-tight tracking-[0.06em] text-[#1d1d1f] sm:text-[14px] md:text-[15px]">
          {t("comparisonTitle")}
        </h2>

        <p className="mt-3 text-center text-[11px] font-normal text-[#86868b]">{t("comparisonMobileHint")}</p>

        <div className="mt-4 min-w-0 overflow-x-auto rounded-xl border border-black/[0.1] bg-white pb-1 shadow-[0_8px_32px_rgba(76,29,149,0.12)] [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[min(100%,560px)] border-separate border-spacing-0 text-center text-[11px] leading-tight sm:min-w-[620px] sm:text-[12px]">
            <caption className="sr-only">{t("comparisonTitle")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="rounded-tl-xl bg-[#4c1d95] px-2 py-3.5 text-left text-[10px] font-bold uppercase tracking-wide text-white sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColFeature")}
                </th>
                <th
                  scope="col"
                  className="bg-[#4c1d95] px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColStandard")}
                </th>
                <th
                  scope="col"
                  className="rounded-tr-xl bg-[#6d28d9] px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[inset_4px_0_12px_rgba(0,0,0,0.12)] sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColProvin")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const zebra = i % 2 === 1 ? "bg-[#f4f4f7]" : "bg-white";
                return (
                  <tr key={i} className={`${zebra} border-b border-black/[0.06] last:border-b-0`}>
                    <th
                      scope="row"
                      className="max-w-[44vw] px-2 py-3 text-left text-[10px] font-medium leading-snug text-[#1d1d1f] sm:max-w-[220px] sm:px-4 sm:text-[12px] sm:leading-snug"
                    >
                      {row.feature}
                    </th>
                    <td className={`px-2 py-3 align-middle ${zebra}`}>
                      <StandardValue value={row.standard} />
                    </td>
                    <td
                      className={`px-2 py-3 align-middle shadow-[inset_3px_0_8px_rgba(109,40,217,0.08)] sm:px-3 ${zebra} bg-gradient-to-br from-violet-50/95 to-[#ede9fe]/90`}
                    >
                      <ProvinValue value={row.provin} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-5 max-w-[52ch] text-balance text-center text-[13px] font-medium leading-relaxed text-[#3a3a3e] sm:mt-6 sm:text-[14px]">
          {t("comparisonTagline")}
        </p>
        <p className="mx-auto mt-3 max-w-[60ch] text-balance text-center text-[10px] font-normal leading-relaxed text-[#86868b] sm:text-[11px]">
          {t("comparisonTableFootnote")}
        </p>
      </div>
    </div>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Ierobežots / daļējs iekļauts — dzeltens checks (ne pilns „premium”). */
function IconCheckLimited({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
