"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ScanLine } from "lucide-react";

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { AdminUserscriptUpdateHint } from "@/components/admin/AdminUserscriptUpdateHint";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";
import { ORDER_VIN_SCAN_STUCK_MS } from "@/lib/order-vin-scan-run-decision";
import { browserFetchAwaiting, browserFetchToken } from "@/lib/vin-scan/browser-fetch";
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

type DotState = "found" | "none" | "error" | "blocked" | "timeout" | "config_missing" | "browser_only";

function Dot({ state }: { state: DotState }) {
  const cls =
    state === "found"
      ? "bg-emerald-500"
      : state === "blocked"
        ? "bg-orange-500"
        : state === "timeout"
          ? "bg-amber-600"
          : state === "config_missing"
            ? "bg-amber-400"
            : state === "browser_only"
              ? "bg-sky-500"
              : state === "error"
                ? "bg-rose-600"
                : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function Counter({ state, count, label }: { state: DotState; count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border-subtle)] px-2 py-0.5 text-[10.5px] text-[var(--color-apple-text)]">
      <Dot state={state} />
      <b className="tabular-nums">{count}</b>
      {label}
    </span>
  );
}

function browserImportErrorLv(code: string | undefined): string {
  if (code === "vin_mismatch") return "VIN lapā nesakrīt ar pasūtījumu";
  if (code === "too_large") return "Lapa ir par lielu importam";
  if (code === "page_not_ready") return "Lapa vēl nav gatava. Pagaidiet, kamēr ielādējas, un mēģiniet vēlreiz";
  return "Importēšana neizdevās";
}

function actionLabel(action: OrderVinScanSourceRow["action"]): string {
  if (action === "import_auction") return "Ielikt AUCTION";
  if (action === "import_csdd") return "Ielikt CSDD";
  if (action === "import_listing") return "Ielikt SLUDIN";
  if (action === "retry") return "Atkārtot";
  if (action === "open_import") return "Atvērt + importēt";
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
  onImportAuction: (record: OrderVinScanRecord) => void | Promise<void | { failed?: number }>;
  onImportCsdd: (record: OrderVinScanRecord) => void;
  onImportListing: (record: OrderVinScanRecord) => void;
}) {
  const [record, setRecord] = useState<OrderVinScanRecord | null>(initial);
  const [showFields, setShowFields] = useState(true);
  const [showNone, setShowNone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [importNote, setImportNote] = useState("");
  const [photoFail, setPhotoFail] = useState(0);

  useEffect(() => {
    setRecord(initial);
  }, [initial]);

  useEffect(() => {
    if (record?.status !== "running") return;
    const started = Date.parse(record.at);
    const age = Number.isFinite(started) ? Date.now() - started : 0;
    if (age >= ORDER_VIN_SCAN_STUCK_MS) {
      setRecord({ ...record, status: "error", error: record.error || "Skenēšana apstājās" });
      return;
    }
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
    const stopAt = window.setTimeout(() => {
      setRecord((cur) =>
        cur?.status === "running" ? { ...cur, status: "error", error: cur.error || "Skenēšana apstājās" } : cur,
      );
    }, ORDER_VIN_SCAN_STUCK_MS - age);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.clearTimeout(stopAt);
    };
  }, [sessionId, record?.status, record?.at]);

  useEffect(() => {
    const onResult = (ev: Event) => {
      const d = (ev as CustomEvent).detail as {
        id?: string;
        vin?: string;
        status?: string;
        summary?: string;
        html?: string;
        pageUrl?: string;
        httpStatus?: number;
      } | null;
      if (!d?.id || String(d.vin || "").toUpperCase() !== vin.trim().toUpperCase()) return;
      const html = typeof d.html === "string" ? d.html : "";
      if (!html.trim() && d.status !== "found" && d.status !== "none") return;
      setImportNote("");
      void fetch("/api/admin/order-vin-scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          vin,
          browserResult: {
            id: d.id,
            status: d.status,
            summary: d.summary ?? "",
            ...(html.trim()
              ? {
                  html,
                  pageUrl: typeof d.pageUrl === "string" ? d.pageUrl : "",
                  ...(typeof d.httpStatus === "number" ? { httpStatus: d.httpStatus } : {}),
                }
              : {}),
          },
        }),
      })
        .then(async (r) => {
          const json = (await r.json().catch(() => null)) as { vinScan?: unknown; error?: string } | null;
          if (!r.ok) {
            setImportNote(browserImportErrorLv(json?.error));
            return;
          }
          const next = parseOrderVinScanRecord(json?.vinScan);
          if (next) setRecord(next);
        })
        .catch(() => setImportNote("Importēšana neizdevās"));
    };
    document.addEventListener("provin-vin-scan-result", onResult);
    return () => document.removeEventListener("provin-vin-scan-result", onResult);
  }, [sessionId, vin]);

  const summary = useMemo(() => buildOrderVinScanSummary(record), [record]);
  const browserFetch = useMemo(() => {
    if (!record || record.status === "running") return null;
    const ids = record.indicators.filter((row) => browserFetchAwaiting(row)).map((row) => row.id);
    if (!ids.length) return null;
    const token = browserFetchToken(vin, record.at);
    return token ? { token, ids } : null;
  }, [record, vin]);
  const sourceCount = record?.indicators.length ?? 0;
  const clock = record?.at ? formatOrderVinScanClock(record.at) : "";
  const meta =
    record?.status === "running"
      ? "pārbauda…"
      : clock
        ? `skenēts automātiski ${clock}${sourceCount ? ` · ${sourceCount} bezmaksas avoti` : ""}`
        : "vēl nav skenēts";

  const dotRows = useMemo(() => {
    if (!summary) return [];
    const main = summary.rows.map((row) => ({
      id: row.id,
      state: row.state,
      label: row.label,
    }));
    const none = summary.noneRows.map((row) => ({ id: row.id, state: "none" as const, label: row.label }));
    return [...main, ...none];
  }, [summary]);

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
          const result = await onImportAuction(record);
          setPhotoFail(typeof result?.failed === "number" ? result.failed : 0);
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
    if (row.action === "open_import") {
      if (!row.openUrl) return;
      try {
        document.dispatchEvent(new CustomEvent("provin-vin-scan-browser", { detail: { vin, sources: [row.id] } }));
      } catch {
        /* ignore */
      }
      window.open(row.openUrl, "provin-vin-scan");
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

  const collapsedStrip = (
    <div className="flex min-w-0 flex-wrap items-center gap-2 py-1 text-[10.5px] text-[var(--color-provin-muted)]">
      <span className="shrink-0">{meta}</span>
      <button type="button" className={BTN} disabled={busy || !vin.trim()} onClick={() => void startScan()}>
        Skenēt vēlreiz
      </button>
      {summary ? (
        <>
          <span className="flex flex-wrap items-center gap-1">
            <Counter state="found" count={summary.found} label="atrasta info" />
            <Counter state="none" count={summary.none} label="nav datu" />
            <Counter state="error" count={summary.error} label="kļūda" />
            {summary.blocked > 0 ? <Counter state="blocked" count={summary.blocked} label="bloķē" /> : null}
            {summary.timeout > 0 ? <Counter state="timeout" count={summary.timeout} label="noildze" /> : null}
            {summary.configMissing > 0 ? (
              <Counter state="config_missing" count={summary.configMissing} label="nav atslēgas" />
            ) : null}
            {summary.browserOnly > 0 ? <Counter state="browser_only" count={summary.browserOnly} label="pārlūks" /> : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5" aria-label="Avotu indikatori">
            {dotRows.map((row) => (
              <span
                key={row.id}
                className="inline-flex p-0.5"
                title={`${row.label}: ${
                  row.state === "found"
                    ? "atrasta info"
                    : row.state === "blocked"
                      ? "bloķē"
                      : row.state === "timeout"
                        ? "noildze"
                        : row.state === "config_missing"
                          ? "nav atslēgas"
                          : row.state === "browser_only"
                            ? "pārlūks"
                            : row.state === "error"
                              ? "kļūda"
                              : "nav datu"
                }`}
              >
                <Dot state={row.state} />
              </span>
            ))}
          </span>
          <button
            type="button"
            className={`${BTN} gap-0.5`}
            onClick={() => setListExpanded(true)}
            aria-expanded={listExpanded}
          >
            <ChevronDown className="h-3 w-3" aria-hidden />
            Rādīt sarakstu
          </button>
        </>
      ) : null}
      {!record ? <span className="text-[11px]">VIN SCAN: vēl nav skenēts</span> : null}
      {photoFail > 0 ? (
        <span className="text-[10px] text-red-700">
          {photoFail} foto neizdevās.{" "}
          <button
            type="button"
            className={BTN}
            disabled={busy || !record}
            onClick={() => {
              const row = summary?.rows.find((item) => item.action === "import_auction");
              if (row) runAction(row);
            }}
          >
            Atkārtot
          </button>
        </span>
      ) : null}
    </div>
  );

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
      <span
        hidden
        data-provin-order-vin={vin.trim().toUpperCase()}
        data-provin-order-session={sessionId}
        {...(browserFetch
          ? {
              "data-provin-browser-fetch": browserFetch.token,
              "data-provin-browser-fetch-ids": browserFetch.ids.join(","),
              ...(browserFetch.ids.includes("stat_vin") ? { "data-provin-stat-vin-fetch": browserFetch.token } : {}),
            }
          : {})}
      />
      {showFields ? (
        <div className="px-2 pb-2">
          <AdminUserscriptUpdateHint />
          {importNote ? <p className="mb-2 text-[11px] text-rose-700">{importNote}</p> : null}
          {!listExpanded ? (
            collapsedStrip
          ) : (
            <>
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
                    {summary.blocked > 0 ? <Counter state="blocked" count={summary.blocked} label="bloķē" /> : null}
                    {summary.timeout > 0 ? <Counter state="timeout" count={summary.timeout} label="noildze" /> : null}
                    {summary.configMissing > 0 ? (
                      <Counter state="config_missing" count={summary.configMissing} label="nav atslēgas" />
                    ) : null}
                    {summary.browserOnly > 0 ? (
                      <Counter state="browser_only" count={summary.browserOnly} label="pārlūks" />
                    ) : null}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={`${BTN} ml-auto gap-0.5`}
                  onClick={() => setListExpanded(false)}
                  aria-expanded={listExpanded}
                >
                  <ChevronUp className="h-3 w-3" aria-hidden />
                  Sakļaut
                </button>
              </div>

              {summary?.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[14px_minmax(5.5rem,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-100 py-1.5 text-[11px] text-[var(--color-apple-text)]"
                >
                  <Dot state={row.state} />
                  <b className="truncate font-semibold">{rowLabel(row)}</b>
                  <span
                    className={`min-w-0 truncate ${
                      row.state === "blocked"
                        ? "text-orange-700"
                        : row.state === "error" || row.state === "timeout"
                          ? "text-rose-700"
                          : ""
                    }`}
                  >
                    {row.blocked
                      ? "Avots bloķē serveri - atver pārlūkā un importē"
                      : row.hint || (row.state === "error" ? "Kļūda" : "")}
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    {row.photoUrls.slice(0, 3).map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="" className="h-[22px] w-[30px] rounded-[3px] object-cover" />
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
              {photoFail > 0 ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-red-700">
                  <span>{photoFail} foto neizdevās ielādēt.</span>
                  <button
                    type="button"
                    className={BTN}
                    disabled={busy || !record}
                    onClick={() => {
                      const row = summary?.rows.find((item) => item.action === "import_auction");
                      if (row) runAction(row);
                    }}
                  >
                    Atkārtot
                  </button>
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </AdminCollapsibleShell>
  );
}
