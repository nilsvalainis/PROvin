import { getMessages, getTranslations } from "next-intl/server";

type CheckRow = {
  label: string;
  labelDetail?: string;
  standardYes: boolean;
  provinYes: boolean;
  standardText?: undefined;
  provinText?: undefined;
};

type TextRow = {
  label: string;
  standardText: string;
  provinText: string;
  standardYes?: undefined;
  provinYes?: undefined;
};

type Row = CheckRow | TextRow;

export type ReportComparisonProps = {
  /** Iekš «Cena» sadaļas — bez atsevišķas pilnas joslas fona */
  embedded?: boolean;
};

function isTextRow(row: Row): row is TextRow {
  return "standardText" in row && row.standardText !== undefined;
}

function RowLabel({ label, detail }: { label: string; detail?: string }) {
  return (
    <div>
      <div className="font-medium leading-snug text-[#1d1d1f]">{label}</div>
      {detail ? (
        <div className="mt-1 max-w-[42ch] text-[12px] font-normal leading-snug text-[#86868b] sm:text-[13px]">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

/** Trešā kolonna — viegls zils fons visā augstumā */
const provinCol =
  "bg-provin-accent-soft/40 border-l border-provin-accent/12 align-middle";

function CellCheck({ yes, labelYes, labelNo }: { yes: boolean; labelYes: string; labelNo: string }) {
  if (yes) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-provin-accent/12 text-provin-accent ring-1 ring-provin-accent/22"
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
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[#aeaeb2] ring-1 ring-black/[0.08]"
      aria-label={labelNo}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

export async function ReportComparison({ embedded = false }: ReportComparisonProps = {}) {
  const t = await getTranslations("Comparison");
  const messages = await getMessages();
  const rows = (messages as { Comparison: { rows: Row[] } }).Comparison.rows;
  const labelYes = t("ariaYes");
  const labelNo = t("ariaNo");

  const tableBlock = (
    <div className="overflow-x-auto sm:mt-2">
      <div className="provin-lift-subtle min-w-[min(100%,560px)] rounded-2xl border border-provin-accent/14 bg-white/90 shadow-[0_8px_36px_rgba(0,102,214,0.07)] backdrop-blur-[2px] sm:min-w-0">
        <table className="w-full min-w-[520px] border-collapse text-left text-[14px] sm:text-[15px]">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b border-provin-accent/12 bg-gradient-to-r from-white via-provin-accent-soft/35 to-provin-accent-soft/50">
              <th
                scope="col"
                className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868b] sm:px-6 sm:py-4 sm:text-[12px]"
              >
                {t("colFeature")}
              </th>
              <th
                scope="col"
                className="w-[26%] px-3 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73] sm:px-4 sm:text-[12px]"
              >
                {t("colStandard")}
              </th>
              <th
                scope="col"
                className="w-[26%] bg-provin-accent-soft/45 px-3 py-4 text-center ring-1 ring-inset ring-provin-accent/18 sm:px-4"
                aria-label={t("colProvin")}
              >
                <span
                  className="inline-flex items-center justify-center gap-x-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] sm:text-[12px]"
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
                    <th scope="row" className="px-4 py-3.5 text-left text-[14px] font-semibold text-[#1d1d1f] sm:px-6 sm:py-4 sm:text-[15px]">
                      {row.label}
                    </th>
                    <td className="px-3 py-3.5 text-center text-[12px] font-medium leading-snug text-[#424245] sm:px-4 sm:text-[13px]">
                      {row.standardText}
                    </td>
                    <td
                      className={`px-3 py-3.5 text-center text-[12px] font-semibold leading-snug text-[#1d1d1f] sm:px-4 sm:text-[13px] ${provinCol}`}
                    >
                      {row.provinText}
                    </td>
                  </tr>
                );
              }
              const check = row as CheckRow;
              return (
                <tr
                  key={check.label}
                  className="border-t border-black/[0.05] bg-white/55 odd:bg-white/70 even:bg-[#fafbfc]/90"
                >
                  <th scope="row" className="max-w-[min(100%,380px)] px-4 py-4 sm:px-6">
                    <RowLabel label={check.label} detail={check.labelDetail} />
                  </th>
                  <td className="px-3 py-4 align-middle sm:px-4">
                    <div className="flex justify-center">
                      <CellCheck yes={check.standardYes} labelYes={labelYes} labelNo={labelNo} />
                    </div>
                  </td>
                  <td className={`px-3 py-4 sm:px-4 ${provinCol}`}>
                    <div className="flex justify-center">
                      <CellCheck yes={check.provinYes} labelYes={labelYes} labelNo={labelNo} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
