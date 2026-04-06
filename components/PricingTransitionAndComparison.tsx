import { getMessages, getTranslations } from "next-intl/server";

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

/** PROVIN slejas šūna: metālisks tonis + „izcelts” rāmis (vienots vertikāli). */
function provinHeaderClass() {
  return [
    "relative z-[2] min-w-[132px] rounded-tr-xl border-2 border-b-0 border-l-provin-accent/50 border-r-provin-accent/50 border-t-provin-accent/50",
    "bg-gradient-to-b from-[#5aa3eb] via-provin-accent to-provin-accent-hover",
    "px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white",
    "shadow-[inset_0_2px_0_rgba(255,255,255,0.38),inset_0_-3px_6px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.12)_inset,4px_0_28px_rgba(0,102,214,0.28)]",
    "sm:min-w-[148px] sm:px-4 sm:text-[11px] sm:tracking-wider",
  ].join(" ");
}

function provinBodyClass(isLast: boolean) {
  const base = [
    "relative z-[1] min-w-[132px] border-2 border-t-0 border-l-provin-accent/40 border-r-provin-accent/40",
    "bg-gradient-to-br from-[#fafdff] via-[#e8f4fc] to-[#d0e4f8]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-2px_4px_rgba(0,82,163,0.07),4px_0_20px_rgba(0,102,214,0.12)]",
    "px-2 py-3 align-middle ring-1 ring-inset ring-white/70 sm:min-w-[148px] sm:px-3",
  ];
  if (isLast) {
    base.push(
      "rounded-br-xl border-b-2 border-b-provin-accent/45",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-2px_4px_rgba(0,82,163,0.07),4px_0_24px_rgba(0,102,214,0.16),0_6px_0_-2px_rgba(0,102,214,0.12)]",
    );
  }
  return base.join(" ");
}

export async function PricingTransitionAndComparison() {
  const t = await getTranslations("Pricing");
  const messages = await getMessages();
  const rows = (messages as { Pricing: { comparisonRows: Row[] } }).Pricing.comparisonRows;

  return (
    <div className="mt-6 min-w-0 space-y-8 sm:mt-8">
      <div className="min-w-0">
        <h2 className="text-balance text-center text-[13px] font-bold uppercase leading-tight tracking-[0.06em] text-[#1d1d1f] sm:text-[14px] md:text-[15px]">
          {t("comparisonTitle")}
        </h2>

        <div className="mt-5 min-w-0 overflow-x-auto rounded-xl border border-provin-accent/20 bg-white pb-1 shadow-[0_8px_36px_rgba(0,102,214,0.14)] [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[min(100%,560px)] border-separate border-spacing-0 text-center text-[11px] leading-tight sm:min-w-[620px] sm:text-[12px]">
            <caption className="sr-only">{t("comparisonTitle")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="rounded-tl-xl bg-provin-accent px-2 py-3.5 text-left text-[10px] font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColFeature")}
                </th>
                <th
                  scope="col"
                  className="bg-provin-accent px-2 py-3.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:px-4 sm:text-[11px] sm:tracking-wider"
                >
                  {t("comparisonColStandard")}
                </th>
                <th scope="col" className={provinHeaderClass()}>
                  {t("comparisonColProvin")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const zebra = i % 2 === 1 ? "bg-[#f4f4f7]" : "bg-white";
                const isLast = i === rows.length - 1;
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
                    <td className={provinBodyClass(isLast)}>
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
