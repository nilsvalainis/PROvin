import { getMessages, getTranslations } from "next-intl/server";

type CheckRow = {
  label: string;
  labelDetail?: string;
  /** Pirmā rinda: 1 ķeksis vs 3 ķekši + */
  historyRow?: boolean;
  standardYes: boolean;
  provinYes: boolean;
  standardText?: undefined;
  provinText?: undefined;
  provinCheckOnly?: undefined;
};

type TextRow = {
  label: string;
  labelDetail?: string;
  standardText: string;
  /** PROVIN šūnā tikai zaļš ķeksis (bez teksta) */
  provinCheckOnly?: boolean;
  provinText?: string;
  standardYes?: undefined;
  provinYes?: undefined;
  historyRow?: undefined;
};

type Row = CheckRow | TextRow;

export type ReportComparisonProps = {
  embedded?: boolean;
};

function isTextRow(row: Row): row is TextRow {
  return "standardText" in row && row.standardText !== undefined;
}

/** Iezīme: pamatteksts + iekavas mazākā pelēkā fontā (vai otrā rindiņā) */
function FeatureLabel({ label, detail }: { label: string; detail?: string }) {
  return (
    <div>
      <span className="font-medium leading-snug text-[#1d1d1f]">{label}</span>
      {detail ? (
        <span className="text-[12px] font-normal leading-snug text-[#86868b] sm:text-[13px]"> {detail}</span>
      ) : null}
    </div>
  );
}

const provinCol = "bg-provin-accent-soft/50 border-l border-provin-accent/15 align-middle";

/** Parastā kolonna — mīkstināta ❌ */
function CellCheckStandard({ yes, labelYes, labelNo }: { yes: boolean; labelYes: string; labelNo: string }) {
  if (yes) {
    return (
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50/90 text-emerald-600 ring-1 ring-emerald-600/20"
        aria-label={labelYes}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f3f5] text-[#b0b0b8] ring-1 ring-black/[0.06]"
      aria-label={labelNo}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

/** PROVIN kolonna — izteiktāks ķeksis */
function CellCheckProvin({ yes, labelYes, labelNo }: { yes: boolean; labelYes: string; labelNo: string }) {
  if (yes) {
    return (
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-provin-accent/18 text-provin-accent shadow-sm ring-2 ring-provin-accent/25"
        aria-label={labelYes}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#aeaeb2] ring-1 ring-black/[0.08]"
      aria-label={labelNo}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function HistoryProvinMarks({ ariaLabel, labelYes }: { ariaLabel: string; labelYes: string }) {
  return (
    <div className="flex justify-center px-1" role="img" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5" aria-hidden>
        <CellCheckProvin yes={true} labelYes={labelYes} labelNo="–" />
        <CellCheckProvin yes={true} labelYes={labelYes} labelNo="–" />
        <CellCheckProvin yes={true} labelYes={labelYes} labelNo="–" />
        <span className="select-none pl-0.5 text-[18px] font-semibold leading-none text-provin-accent">+</span>
      </div>
    </div>
  );
}

export async function ReportComparison({ embedded = false }: ReportComparisonProps = {}) {
  const t = await getTranslations("Comparison");
  const messages = await getMessages();
  const rows = (messages as { Comparison: { rows: Row[] } }).Comparison.rows;
  const labelYes = t("ariaYes");
  const labelNo = t("ariaNo");
  const historyAria = t("ariaHistoryProvin");

  const tableBlock = (
    <div className="overflow-x-auto sm:mt-2">
      <div className="provin-lift-subtle min-w-[min(100%,560px)] rounded-2xl border border-provin-accent/18 bg-white/95 shadow-[0_10px_40px_rgba(0,102,214,0.09)] backdrop-blur-[2px] sm:min-w-0">
        <table className="w-full min-w-[520px] border-collapse text-left text-[14px] sm:text-[15px]">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b border-provin-accent/14 bg-gradient-to-r from-white via-provin-accent-soft/40 to-provin-accent-soft/55">
              <th
                scope="col"
                className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868b] sm:px-6 sm:py-4 sm:text-[12px]"
              >
                {t("colFeature")}
              </th>
              <th
                scope="col"
                className="w-[26%] px-3 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73] sm:px-4 sm:text-[11px]"
              >
                <span className="uppercase">{t("colStandard")}</span>
              </th>
              <th
                scope="col"
                className="w-[28%] bg-provin-accent-soft/55 px-2 py-4 text-center ring-1 ring-inset ring-provin-accent/22 sm:px-3"
                aria-label={t("colProvin")}
              >
                <span
                  className="inline-flex items-center justify-center gap-x-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] sm:text-[11px]"
                  aria-hidden
                >
                  <span>
                    <span className="text-[#1d1d1f]">PRO</span>
                    <span className="text-provin-accent">VIN</span>
                  </span>
                  <span className="text-[#1d1d1f]">ATSKAITE</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (isTextRow(row)) {
                return (
                  <tr key={row.label} className="border-t border-black/[0.05] bg-white/55">
                    <th scope="row" className="px-4 py-3.5 text-left sm:px-6 sm:py-4">
                      <FeatureLabel label={row.label} detail={row.labelDetail} />
                    </th>
                    <td className="px-3 py-3.5 text-center text-[13px] font-medium text-[#424245] sm:px-4 sm:text-[14px]">
                      {row.standardText}
                    </td>
                    <td className={`px-3 py-3.5 ${provinCol}`}>
                      <div className="flex justify-center">
                        {row.provinCheckOnly ? (
                          <CellCheckProvin yes labelYes={labelYes} labelNo={labelNo} />
                        ) : (
                          <span className="text-center text-[13px] font-semibold text-[#1d1d1f] sm:text-[14px]">
                            {row.provinText}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }
              const check = row as CheckRow;
              const isHistory = Boolean(check.historyRow);
              return (
                <tr
                  key={check.label}
                  className="border-t border-black/[0.05] bg-white/55 odd:bg-white/70 even:bg-[#fafbfc]/90"
                >
                  <th scope="row" className="max-w-[min(100%,400px)] px-4 py-4 sm:px-6">
                    <FeatureLabel label={check.label} detail={check.labelDetail} />
                  </th>
                  <td className="px-3 py-4 align-middle sm:px-4">
                    <div className="flex justify-center">
                      <CellCheckStandard yes={check.standardYes} labelYes={labelYes} labelNo={labelNo} />
                    </div>
                  </td>
                  <td className={`px-3 py-4 sm:px-4 ${provinCol}`}>
                    {isHistory ? (
                      <HistoryProvinMarks ariaLabel={historyAria} labelYes={labelYes} />
                    ) : (
                      <div className="flex justify-center">
                        <CellCheckProvin yes={check.provinYes} labelYes={labelYes} labelNo={labelNo} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-black/[0.06] px-4 py-3 text-center text-[10px] italic leading-relaxed text-[#86868b] sm:px-6 sm:text-[11px]">
          {t("tableFootnote")}
        </p>
      </div>
    </div>
  );

  const headings = (
    <div className="text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("sectionEyebrow")}</p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[24px] sm:leading-[1.15]">
        {t("title")}
      </h2>
    </div>
  );

  if (embedded) {
    return (
      <div id="salidzinajums" className="col-span-1 sm:col-span-2 lg:col-span-2">
        {tableBlock}
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-black/[0.06] bg-gradient-to-b from-white via-provin-surface to-provin-surface-2/50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 provin-noise opacity-[0.22]" aria-hidden />
      <div className="relative mx-auto max-w-[1024px]">
        {headings}
        <div className="mt-8 sm:mt-10">{tableBlock}</div>
      </div>
    </section>
  );
}
