"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatB2bPartnerOrderDate, type B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const TH_CLASS = "pb-3 text-left text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const TD_CLASS = "py-3.5 text-[0.8125rem] font-medium text-zinc-100 sm:text-[0.875rem]";

function ReportCell({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex text-zinc-300 transition-colors hover:text-white"
      aria-label={label}
    >
      <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </a>
  );
}

export function B2bPartnerArchive() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [rows, setRows] = useState<B2bPartnerOrderRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/archive", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setRows([]);
          return;
        }
        const data = (await res.json()) as { orders?: B2bPartnerOrderRow[] };
        if (!cancelled) setRows(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = rows ?? [];
  const loading = rows === null;

  return (
    <section aria-labelledby="b2b-partner-archive-title">
      <h1 id="b2b-partner-archive-title" className={TITLE_CLASS}>
        {t("archiveTitle")}
      </h1>
      <div className={TITLE_RULE_CLASS} aria-hidden />

      {loading ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("archiveLoading")}</p>
      ) : list.length === 0 ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("archiveEmpty")}</p>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto max-lg:hidden">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={TH_CLASS}>{t("archiveDate")}</th>
                  <th className={TH_CLASS}>{t("archiveVin")}</th>
                  <th className={TH_CLASS}>{t("archiveInvoice")}</th>
                  <th className={`${TH_CLASS} text-right`}>{t("archiveAmount")}</th>
                  <th className={`${TH_CLASS} w-14 text-right`}>{t("archiveReport")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06]">
                    <td className={TD_CLASS}>{formatB2bPartnerOrderDate(row.createdAt, locale)}</td>
                    <td className={`${TD_CLASS} font-mono tracking-wide`}>{row.vin}</td>
                    <td className={TD_CLASS}>{row.invoiceNumber}</td>
                    <td className={`${TD_CLASS} text-right tabular-nums`}>{row.amountLabel}</td>
                    <td className={`${TD_CLASS} text-right`}>
                      <ReportCell href={row.reportHref} label={t("archiveOpenReport")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-8 flex flex-col gap-1.5 lg:hidden">
            {list.map((row) => (
              <li key={row.id} className="rounded-[0.35rem] bg-white/[0.03] px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[0.8125rem] tracking-wide text-zinc-100">{row.vin}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[0.8125rem] font-medium tabular-nums text-zinc-100">{row.amountLabel}</span>
                    <ReportCell href={row.reportHref} label={t("archiveOpenReport")} />
                  </span>
                </div>
                <p className="mt-1.5 text-[0.7rem] text-zinc-500">
                  {formatB2bPartnerOrderDate(row.createdAt, locale)}
                  {" · "}
                  {row.invoiceNumber}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
