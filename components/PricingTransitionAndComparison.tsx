import { getMessages, getTranslations } from "next-intl/server";

type Row = { feature: string; standard: string; provin: string };

export async function PricingTransitionAndComparison() {
  const t = await getTranslations("Pricing");
  const messages = await getMessages();
  const rows = (messages as { Pricing: { comparisonRows: Row[] } }).Pricing.comparisonRows;

  return (
    <div className="mt-6 min-w-0 space-y-8 sm:mt-8">
      <div
        className="relative overflow-hidden rounded-2xl bg-[#14161c] px-4 py-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.2)] sm:px-8 sm:py-10"
        role="region"
        aria-label={t("transitionQuote")}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,102,214,0.18),transparent_55%)]"
          aria-hidden
        />
        <p className="relative text-balance text-[1.125rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.375rem] sm:leading-tight md:text-2xl">
          {t("transitionQuote")}
        </p>
      </div>

      <div className="min-w-0">
        <h2 className="text-balance text-center text-[13px] font-bold uppercase leading-tight tracking-[0.06em] text-[#1d1d1f] sm:text-[14px] md:text-[15px]">
          {t("comparisonTitle")}
        </h2>

        <p className="mt-3 text-center text-[11px] font-normal text-[#86868b] sm:hidden">
          {t("comparisonMobileHint")}
        </p>
        <div className="mt-4 sm:hidden">
          <ul className="space-y-3">
            {rows.map((row, i) => (
              <li
                key={i}
                className="overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.06)]"
              >
                <p className="border-b border-black/[0.06] bg-[#f8f9fb] px-3 py-2.5 text-[12px] font-semibold leading-snug text-[#1d1d1f]">
                  {row.feature}
                </p>
                <div className="grid grid-cols-2 divide-x divide-black/[0.06]">
                  <div className="px-2.5 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#86868b]">
                      {t("comparisonColStandard")}
                    </p>
                    <p className="mt-1 text-[11px] font-normal leading-snug text-[#424245]">{row.standard}</p>
                  </div>
                  <div className="bg-gradient-to-b from-[#e8f4ff] to-[#dceeff] px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(0,102,214,0.12)]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-provin-accent">
                      {t("comparisonColProvin")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[#1d1d1f]">{row.provin}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 hidden min-w-0 overflow-x-auto overflow-y-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.07)] sm:block">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[12px] leading-snug lg:text-[13px]">
            <caption className="sr-only">{t("comparisonTitle")}</caption>
            <thead>
              <tr className="border-b border-black/[0.08] bg-[#f5f6f8]">
                <th
                  scope="col"
                  className="w-[28%] px-2 py-3 font-bold uppercase tracking-wide text-[#1d1d1f] sm:px-3 lg:px-4"
                >
                  {t("comparisonColFeature")}
                </th>
                <th
                  scope="col"
                  className="w-[30%] px-2 py-3 font-bold uppercase tracking-wide text-[#5c5d62] sm:px-3 lg:px-4"
                >
                  {t("comparisonColStandard")}
                </th>
                <th
                  scope="col"
                  className="w-[42%] bg-gradient-to-b from-[#e8f4ff] to-[#d6ebff] px-2 py-3 font-bold uppercase tracking-wide text-provin-accent shadow-[inset_0_0_0_1px_rgba(0,102,214,0.14),4px_0_18px_rgba(0,102,214,0.12)] sm:px-3 lg:px-4"
                >
                  {t("comparisonColProvin")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-black/[0.06] last:border-b-0">
                  <td className="px-2 py-2.5 align-top font-medium text-[#1d1d1f] sm:px-3 lg:px-4 lg:py-3">
                    {row.feature}
                  </td>
                  <td className="px-2 py-2.5 align-top text-[#5c5d62] sm:px-3 lg:px-4 lg:py-3">{row.standard}</td>
                  <td className="bg-gradient-to-b from-[#f0f7ff] to-[#e5f2fc] px-2 py-2.5 align-top font-semibold text-[#1d1d1f] shadow-[inset_1px_0_0_rgba(0,102,214,0.1),4px_0_14px_rgba(0,102,214,0.08)] sm:px-3 lg:px-4 lg:py-3">
                    {row.provin}
                  </td>
                </tr>
              ))}
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
