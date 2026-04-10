import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";
import {
  comparisonTableHeaderAccentClass,
  comparisonTableHeaderMutedClass,
  comparisonTableFeatureCellClass,
  homeSectionEyebrowClass,
} from "@/lib/home-layout";

type Row = { feature: string; standard: string; provin: string };

const transitionRow = "transition-all duration-300 ease-in-out";

/** Standarta kolonna: pelēkas ikonas (x / mīnus). */
function StandardValue({ value }: { value: string }) {
  const nav = value.trim().toLowerCase() === "nav";
  if (nav) {
    return (
      <span className="inline-flex flex-col items-center justify-center gap-1" title="Nav">
        <XCircle className="h-6 w-6 text-[#d1d5db]" strokeWidth={1.35} aria-hidden />
        <span className="sr-only">Nav</span>
      </span>
    );
  }
  if (value.trim() === "1 avots") {
    return (
      <span className="inline-flex flex-col items-center justify-center gap-1.5 text-center">
        <MinusCircle className="h-5 w-5 shrink-0 text-[#d1d5db]" strokeWidth={1.35} aria-hidden />
        <span className="text-[13px] font-medium leading-snug text-[#86868b] sm:text-[14px]">{value}</span>
      </span>
    );
  }
  return (
    <span className="mx-auto block max-w-[20ch] text-[13px] font-medium leading-snug text-[#86868b] sm:max-w-[24ch] sm:text-[14px]">
      {value}
    </span>
  );
}

/** PROVIN kolonna: zila check-circle. */
function ProvinValue({ value }: { value: string }) {
  return (
    <span className="inline-flex flex-col items-center justify-center gap-1.5 text-center">
      <CheckCircle2 className="h-6 w-6 shrink-0 text-provin-accent" strokeWidth={1.5} aria-hidden />
      <span className="max-w-[18ch] text-[13px] font-semibold leading-snug text-[#1d1d1f] sm:max-w-[22ch] sm:text-[14px] sm:leading-snug">
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
    <div className="hidden min-w-0 md:block">
      <div className="min-w-0 space-y-0">
        <div className="min-w-0">
          <h2 className={`${homeSectionEyebrowClass} text-balance text-center`}>{t("comparisonTitle")}</h2>

          <div
            className={`mt-6 min-w-0 w-full overflow-x-auto rounded-2xl bg-white/60 [-webkit-overflow-scrolling:touch] md:mt-7`}
          >
            <table className="w-full min-w-[620px] border-separate border-spacing-0 text-center text-[13px] leading-snug sm:text-[14px]">
              <caption className="sr-only">{t("comparisonTitle")}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={`rounded-tl-xl bg-white px-3 py-4 text-left ${comparisonTableHeaderMutedClass} sm:px-4`}
                  >
                    {t("comparisonColFeature")}
                  </th>
                  <th scope="col" className={`bg-white px-3 py-4 ${comparisonTableHeaderMutedClass} sm:px-4`}>
                    {t("comparisonColStandard")}
                  </th>
                  <th
                    scope="col"
                    className={`rounded-tr-xl bg-[#f0f7ff] px-3 py-4 ${comparisonTableHeaderAccentClass} sm:px-4`}
                  >
                    {t("comparisonColProvin")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isLast = i === rows.length - 1;
                  const provinRound = isLast ? "rounded-br-xl" : "";
                  return (
                    <tr key={i} className={`border-b border-[#ececec] last:border-b-0 ${transitionRow}`}>
                      <th
                        scope="row"
                        className={`max-w-[220px] px-3 py-3.5 text-left ${comparisonTableFeatureCellClass} sm:px-4`}
                      >
                        {row.feature}
                      </th>
                      <td className="bg-white px-3 py-3.5 align-middle sm:px-4">
                        <StandardValue value={row.standard} />
                      </td>
                      <td
                        className={`bg-[#f0f7ff] px-3 py-3.5 align-middle sm:px-4 ${provinRound} ${transitionRow}`}
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
    </div>
  );
}
