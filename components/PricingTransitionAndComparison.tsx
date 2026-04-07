import { getMessages, getTranslations } from "next-intl/server";
import { sectionH2Class } from "@/lib/home-layout";

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
  const messages = await getMessages();
  const rows = (messages as { Pricing: { comparisonRows: Row[] } }).Pricing.comparisonRows;

  return (
    <div className="min-w-0 space-y-0">
      <div className="min-w-0">
        <h2 className={`${sectionH2Class} text-center uppercase tracking-[0.04em]`}>{t("comparisonTitle")}</h2>

        <div className="mt-5 min-w-0 w-full overflow-x-auto rounded-xl border border-black/[0.1] bg-white pb-1 shadow-[0_8px_32px_rgba(0,0,0,0.06)] [-webkit-overflow-scrolling:touch] sm:mt-6">
          <table className="w-full min-w-[min(100%,560px)] border-separate border-spacing-0 text-center text-[11px] leading-tight sm:min-w-[620px] sm:text-[12px]">
            <caption className="sr-only">{t("comparisonTitle")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="rounded-tl-xl bg-provin-accent px-2 py-3.5 text-left text-[10px] font-bold uppercase tracking-wide text-white sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColFeature")}
                </th>
                <th
                  scope="col"
                  className="bg-provin-accent px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColStandard")}
                </th>
                <th
                  scope="col"
                  className="rounded-tr-xl bg-provin-accent-hover px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[inset_4px_0_12px_rgba(0,0,0,0.12)] sm:px-4 sm:text-[11px] sm:tracking-wider"
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
                      className={`px-2 py-3 align-middle shadow-[inset_3px_0_8px_rgba(0,0,0,0.04)] sm:px-3 ${zebra} bg-gradient-to-br from-[#f6f7f9] to-[#eceef2]/90`}
                    >
                      <ProvinValue value={row.provin} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
