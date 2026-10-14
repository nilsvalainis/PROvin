"use client";

import { useEffect, useMemo, useState } from "react";
import { ScanLine } from "lucide-react";

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";
import {
  buildOrderVinScanSummary,
  formatOrderVinScanClock,
  parseOrderVinScanRecord,
  type OrderVinScanRecord,
  type OrderVinScanSourceRow,
} from "@/lib/order-vin-scan";

const BTN =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 text-[10px] font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-black/[0.04] disabled:opacity-50";
const BTN_AUCTION =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-teal-800/20 bg-[#0f766e] px-2 text-[10px] font-semibold text-white shadow-sm hover:bg-[#0d6962] disabled:opacity-50";

function Dot({ state }: { state: "found" | "none" | "error" }) {
  const cls =
    state === "found" ? "bg-emerald-500" : state === "error" ? "bg-rose-600" : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function Counter({ state, count, label }: { state: "found" | "none" | "error"; count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border-subtle)] px-2 py-0.5 text-[10.5px] text-[var(--color-apple-text)]">
      <Dot state={state} />
      <b className="tabular-nums">{count}</b>
      {label}
    </span>
  );
}

function actionLabel(action: OrderVinScanSourceRow["action"]): string {
  if (action === "import_auction") return "Ielikt AUCTION";
  if (action === "import_csdd") return "Ielikt CSDD";
  if (action === "import_listing") return "Ielikt SLUDIN";
  if (action === "retry") return "Atkārtot";
  return "Atvērt";
}

export function AdminOrderVinScanCard({
  sessionId,
  vin,
  listingUrl,
  initial,
  onImportAuction,
  onImportCsdd,
  onImportListing,
}: {
  sessionId: string;
  vin: string;
  listingUrl: string;
  initial: OrderVinScanRecord | null;
  onImportAuction: (record: OrderVinScanRecord) => void | Promise<void>;
  onImportCsdd: (record: OrderVinScanRecord) => void;
  onImportListing: (record: OrderVinScanRecord) => void;
}) {
  const [record, setRecord] = useState<OrderVinScanRecord | null>(initial);
  const [showFields, setShowFields] = useState(true);
  const [showNone, setShowNone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecord(initial);
  }, [initial]);

  useEffect(() => {
    if (record?.status !== "running") return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&workspace=1`, {
          credentials: "include",
        });
        if (!res.ok || stop) return;
        const json = (await res.json()) as { vinScan?: unknown };
        const next = parseOrderVinScanRecord(json.vinScan);
        if (next) setRecord(next);
      } catch {
        /* ignore */
      }
    };
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sessionId, record?.status]);

  const summary = useMemo(() => buildOrderVinScanSummary(record), [record]);
  const sourceCount = record?.indicators.length ?? 0;
  const clock = record?.at ? formatOrderVinScanClock(record.at) : "";
  const meta =
    record?.status === "running"
      ? "pārbauda…"
      : clock
        ? `skenēts automātiski ${clock}${sourceCount ? ` · ${sourceCount} bezmaksas avoti` : ""}`
        : "vēl nav skenēts";

  const startScan = async (sourceId?: string) => {
    if (busy || !vin.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/order-vin-scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          vin,
          listingUrl,
          force: true,
          ...(sourceId ? { sourceId } : {}),
        }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { vinScan?: unknown };
      const next = parseOrderVinScanRecord(json.vinScan);
      if (next) setRecord(next);
    } finally {
      setBusy(false);
    }
  };

  const runAction = (row: OrderVinScanSourceRow) => {
    if (!record) return;
    if (row.action === "import_auction") {
      void (async () => {
        setBusy(true);
        try {
          await onImportAuction(record);
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    if (row.action === "import_csdd") {
      onImportCsdd(record);
      return;
    }
    if (row.action === "import_listing") {
      onImportListing(record);
      return;
    }
    if (row.action === "retry") {
      void startScan(row.id);
      return;
    }
    if (row.openUrl) window.open(row.openUrl, "_blank", "noopener,noreferrer");
  };

  const rowLabel = (row: OrderVinScanSourceRow) =>
    row.id === "stat_vin" && row.state === "found" ? `${row.label} ★` : row.label;

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="vin-scan-avoti"
      className="rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)]"
      header={
        <h2
          className={`flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2 font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`}
        >
          <AdminProvinLucide icon={ScanLine} />
          VIN SCAN avoti
        </h2>
      }
      headerActions={
        <AdminPdfIncludeToggle
          id={`vin-scan-show-fields-${sessionId}`}
          checked={showFields}
          onChange={setShowFields}
        />
      }
    >
      {showFields ? (
        <div className="px-2 pb-2">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--color-provin-muted)]">
            <span>{meta}</span>
            <button type="button" className={BTN} disabled={busy || !vin.trim()} onClick={() => void startScan()}>
              Skenēt vēlreiz
            </button>
            {summary ? (
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <Counter state="found" count={summary.found} label="atrasta info" />
                <Counter state="none" count={summary.none} label="nav datu" />
                <Counter state="error" count={summary.error} label="kļūda" />
              </span>
            ) : null}
          </div>

          {summary?.rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[14px_minmax(5.5rem,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-100 py-1.5 text-[11px] text-[var(--color-apple-text)]"
            >
              <Dot state={row.state} />
              <b className="truncate font-semibold">{rowLabel(row)}</b>
              <span className={`min-w-0 truncate ${row.state === "error" ? "text-rose-700" : ""}`}>
                {row.hint || (row.state === "error" ? "Kļūda" : "")}
              </span>
              <span className="flex items-center justify-end gap-1">
                {row.photoUrls.slice(0, 3).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-[22px] w-[30px] rounded-[3px] object-cover"
                  />
                ))}
                <button
                  type="button"
                  className={row.action === "import_auction" ? BTN_AUCTION : BTN}
                  disabled={busy || (row.action === "open" && !row.openUrl)}
                  onClick={() => runAction(row)}
                >
                  {actionLabel(row.action)}
                </button>
              </span>
            </div>
          ))}

          {summary && summary.none > 0 ? (
            <>
              <div className="grid grid-cols-[14px_minmax(5.5rem,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-100 py-1.5 text-[11px] text-slate-500">
                <Dot state="none" />
                <b className="font-semibold">Nav datu ({summary.none})</b>
                <span className="min-w-0 truncate">
                  {showNone ? "" : summary.noneCollapsedLabels.slice(0, 8).join(" · ")}
                </span>
                <button type="button" className={BTN} onClick={() => setShowNone((v) => !v)}>
                  {showNone ? "Slēpt" : "Rādīt"}
                </button>
              </div>
              {showNone
                ? summary.noneRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[14px_minmax(5.5rem,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-100 py-1.5 text-[11px] text-slate-500"
                    >
                      <Dot state="none" />
                      <b className="truncate font-semibold">{row.label}</b>
                      <span className="min-w-0 truncate">{row.hint || "Nav datu"}</span>
                      <button
                        type="button"
                        className={BTN}
                        disabled={!row.openUrl}
                        onClick={() => runAction(row)}
                      >
                        Atvērt
                      </button>
                    </div>
                  ))
                : null}
            </>
          ) : null}

          {!record ? (
            <p className="text-[11px] text-[var(--color-provin-muted)]">VIN SCAN: vēl nav skenēts</p>
          ) : null}
        </div>
      ) : null}
    </AdminCollapsibleShell>
  );
}
