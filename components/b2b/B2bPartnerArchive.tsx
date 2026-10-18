"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  mergePartnerArchiveRows,
  readPendingPartnerArchiveRows,
} from "@/lib/b2b-partner-archive-rows";
import { formatB2bPartnerOrderDate, type B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const TH_CLASS = "pb-3 text-left text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const TD_CLASS = "py-3.5 text-[0.8125rem] font-medium text-zinc-100 sm:text-[0.875rem]";

function archiveAmountText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (row.kind === "pack") return row.amountLabel;
  if (row.amountKind === "credit" || row.amountKind === "credit_restored") return t("archiveCreditUsed");
  return row.amountLabel;
}

function archiveVinText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (row.kind === "pack") {
    return row.plan === "dealer"
      ? t("archivePackDealer", { count: row.packQty ?? 1 })
      : t("archivePackBusiness", { count: row.packQty ?? 1 });
  }
  return row.vin;
}

function archiveStatusText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (row.kind === "pack") return "";
  if (row.status === "credit_restored") return t("archiveCreditRestored");
  if (row.status === "ready") return t("archiveStatusReady");
  if (row.status === "processing") return t("archiveStatusProcessing");
  return t("archiveStatusReceived");
}

function FileLink({ href, label }: { href: string | null | undefined; label: string }) {
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

function StatusCell({
  row,
  t,
}: {
  row: B2bPartnerOrderRow;
  t: ReturnType<typeof useTranslations>;
}) {
  const status = archiveStatusText(row, t);
  const download =
    row.kind === "pack" ? (
      <FileLink href={row.invoiceHref} label={t("archiveOpenInvoice")} />
    ) : (
      <FileLink href={row.reportHref} label={t("archiveOpenReport")} />
    );
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {status ? <span>{status}</span> : null}
      {download}
    </span>
  );
}

export function B2bPartnerArchive({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [rows, setRows] = useState<B2bPartnerOrderRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pending = readPendingPartnerArchiveRows();
    if (pending.length > 0) setRows(pending);
    void (async () => {
      try {
        const res = await fetch("/api/partner/archive", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setRows(readPendingPartnerArchiveRows());
          return;
        }
        const data = (await res.json()) as { orders?: B2bPartnerOrderRow[] };
        const server = Array.isArray(data.orders) ? data.orders : [];
        if (!cancelled) setRows(mergePartnerArchiveRows(server, readPendingPartnerArchiveRows()));
      } catch {
        if (!cancelled) setRows(readPendingPartnerArchiveRows());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = rows ?? [];
  const loading = rows === null;
  const HeadingTag = embedded ? "h2" : "h1";
  const headingClass = embedded
    ? "text-balance text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100"
    : TITLE_CLASS;

  return (
    <section aria-labelledby="b2b-partner-archive-title">
      <HeadingTag id="b2b-partner-archive-title" className={headingClass}>
        {t("archiveTitle")}
      </HeadingTag>
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
                  <th className={`${TH_CLASS} text-right`}>{t("archiveStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06]">
                    <td className={TD_CLASS}>{formatB2bPartnerOrderDate(row.createdAt, locale)}</td>
                    <td className={`${TD_CLASS} ${row.kind === "pack" ? "" : "font-mono tracking-wide"}`}>
                      {archiveVinText(row, t)}
                    </td>
                    <td className={TD_CLASS}>{row.invoiceNumber}</td>
                    <td className={`${TD_CLASS} text-right tabular-nums`}>{archiveAmountText(row, t)}</td>
                    <td className={`${TD_CLASS} text-right`}>
                      <StatusCell row={row} t={t} />
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
                  <span className={row.kind === "pack" ? "text-[0.8125rem] text-zinc-100" : "font-mono text-[0.8125rem] tracking-wide text-zinc-100"}>
                    {archiveVinText(row, t)}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[0.8125rem] font-medium tabular-nums text-zinc-100">
                      {archiveAmountText(row, t)}
                    </span>
                    <StatusCell row={row} t={t} />
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
