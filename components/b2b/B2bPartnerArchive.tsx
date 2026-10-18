"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, MonitorSmartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { B2B_WALLET_PRODUCT_COPY } from "@/components/b2b/b2b-partner-ui";
import { Link } from "@/i18n/navigation";
import {
  mergePartnerArchiveRows,
  readPendingPartnerArchiveRows,
} from "@/lib/b2b-partner-archive-rows";
import {
  emptyPartnerArchiveSearch,
  filterPartnerArchiveRows,
  type PartnerArchiveSearch,
} from "@/lib/b2b-partner-archive-search";
import { formatB2bPartnerOrderDate, type B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const TH_CLASS = "pb-3 text-left text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const TD_CLASS = "py-3.5 text-[0.8125rem] font-medium text-zinc-100 sm:text-[0.875rem]";

function archiveAmountText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (row.kind === "pack" || row.kind === "topup") return row.amountLabel;
  if (row.amountKind === "credit" || row.amountKind === "credit_restored") return t("archiveCreditUsed");
  return row.amountLabel;
}

function archiveVinText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (row.kind === "topup") return t("archiveTopup");
  if (row.kind === "pack") {
    return row.plan === "dealer"
      ? t("archivePackDealer", { count: row.packQty ?? 1 })
      : t("archivePackBusiness", { count: row.packQty ?? 1 });
  }
  return row.vin;
}

function isInfoRow(row: B2bPartnerOrderRow): boolean {
  return row.kind === "pack" || row.kind === "topup";
}

function archiveStatusText(
  row: B2bPartnerOrderRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (isInfoRow(row)) return "";
  if (row.status === "wallet_refunded") return t("archiveStatusRefunded");
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
  const internal = row.reportHref?.startsWith("/partneriem/") ? row.reportHref : null;
  const download = isInfoRow(row) ? (
    <FileLink href={row.invoiceHref} label={t("archiveOpenInvoice")} />
  ) : internal ? (
    <Link
      href={internal}
      className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-zinc-300 transition-colors hover:text-white"
    >
      <MonitorSmartphone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      {t("archiveDownloadReport")}
    </Link>
  ) : row.reportHref ? (
    <a
      href={row.reportHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-zinc-300 transition-colors hover:text-white"
    >
      <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      {t("archiveDownloadReport")}
    </a>
  ) : null;
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
  const [search, setSearch] = useState<PartnerArchiveSearch>(emptyPartnerArchiveSearch);

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

  const all = rows ?? [];
  const list = useMemo(() => filterPartnerArchiveRows(all, search), [all, search]);
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
      ) : all.length === 0 ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("archiveEmpty")}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block min-w-0">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t("archiveSearchVin")}
              </span>
              <input
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[0.8rem] text-zinc-100 outline-none focus:border-white/25"
                value={search.vin}
                onChange={(event) => setSearch((prev) => ({ ...prev, vin: event.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t("archiveSearchDateFrom")}
              </span>
              <input
                type="date"
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.8rem] text-zinc-100 outline-none focus:border-white/25"
                value={search.dateFrom}
                onChange={(event) => setSearch((prev) => ({ ...prev, dateFrom: event.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t("archiveSearchDateTo")}
              </span>
              <input
                type="date"
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.8rem] text-zinc-100 outline-none focus:border-white/25"
                value={search.dateTo}
                onChange={(event) => setSearch((prev) => ({ ...prev, dateTo: event.target.value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t("archiveSearchProduct")}
              </span>
              <select
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.8rem] text-zinc-100 outline-none focus:border-white/25"
                value={search.product}
                onChange={(event) =>
                  setSearch((prev) => ({
                    ...prev,
                    product: event.target.value as PartnerArchiveSearch["product"],
                  }))
                }
              >
                <option value="">{t("archiveSearchAll")}</option>
                <option value="business">{t(B2B_WALLET_PRODUCT_COPY.business.title)}</option>
                <option value="dealer_raw">{t(B2B_WALLET_PRODUCT_COPY.dealer_raw.title)}</option>
                <option value="dealer_pro">{t(B2B_WALLET_PRODUCT_COPY.dealer_pro.title)}</option>
              </select>
            </label>
          </div>
      {list.length === 0 ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("archiveSearchNoMatch")}</p>
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
                    <td className={`${TD_CLASS} ${isInfoRow(row) ? "" : "font-mono tracking-wide"}`}>
                      {archiveVinText(row, t)}
                      {row.walletProduct ? (
                        <span className="block font-sans text-[0.68rem] font-normal tracking-normal text-zinc-500">
                          {t(B2B_WALLET_PRODUCT_COPY[row.walletProduct].title)}
                        </span>
                      ) : null}
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
                  <span className={isInfoRow(row) ? "text-[0.8125rem] text-zinc-100" : "font-mono text-[0.8125rem] tracking-wide text-zinc-100"}>
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
                  {row.walletProduct ? `${t(B2B_WALLET_PRODUCT_COPY[row.walletProduct].title)} · ` : ""}
                  {formatB2bPartnerOrderDate(row.createdAt, locale)}
                  {" · "}
                  {row.invoiceNumber}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}
    </section>
  );
}
