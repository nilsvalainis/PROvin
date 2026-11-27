"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminUiOpenKey, readAdminUiOpen, writeAdminUiOpen } from "@/lib/admin-ui-open-memory";
import { ChevronDown, ChevronUp, ScanLine } from "lucide-react";

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminDealerForecastRow } from "@/components/admin/AdminDealerForecastRow";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { AdminUserscriptUpdateHint } from "@/components/admin/AdminUserscriptUpdateHint";
import { AdminVinScanBrowserFetchHandoff } from "@/components/admin/AdminVinScanBrowserFetchHandoff";
import {
  AdminVinScanV4,
  VIN_SCAN_V4_BTN,
  VIN_SCAN_V4_BTN_DARK,
  type VinScanV4KfzContext,
  type VinScanV4Row,
} from "@/components/admin/vin-scan-v4/AdminVinScanV4";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";
import {
  ADMIN_MOBILE_VIN_SCAN_EVENT,
  ADMIN_MOBILE_VIN_SCAN_STATE_EVENT,
  requestOpenAdminBlock,
  type AdminMobileVinScanState,
} from "@/lib/admin-mobile-ds";
import { ORDER_VIN_SCAN_STUCK_MS } from "@/lib/order-vin-scan-run-decision";
import { browserImportRowNote, parseVinScanBrowserEventDetail } from "@/lib/vin-scan/browser-fetch";
import {
  buildOrderVinScanSummary,
  orderVinScanCollapsedDots,
  formatOrderVinScanClock,
  parseOrderVinScanRecord,
  sameOrderVinScanRecord,
  type OrderVinScanRecord,
  type OrderVinScanSourceRow,
} from "@/lib/order-vin-scan";

const BTN =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 text-[10px] font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-black/[0.04] disabled:opacity-50";

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
  kfz,
}: {
  sessionId: string;
  vin: string;
  listingUrl: string;
  initial: OrderVinScanRecord | null;
  onImportAuction: (record: OrderVinScanRecord) => void | Promise<void | { failed?: number }>;
  onImportCsdd: (record: OrderVinScanRecord) => void;
  onImportListing: (record: OrderVinScanRecord) => void;
  /** Austrija §57a: datums no pasūtījuma blokiem, CSDD iepriekšējā valsts, Tampermonkey tilts. */
  kfz?: VinScanV4KfzContext;
}) {
  const [record, setRecord] = useState<OrderVinScanRecord | null>(initial);
  const [showFields, setShowFieldsState] = useState(
    () => readAdminUiOpen(adminUiOpenKey(sessionId, "vin-scan-fields")) ?? true,
  );
  const [busy, setBusy] = useState(false);
  const [listExpanded, setListExpandedState] = useState(
    () => readAdminUiOpen(adminUiOpenKey(sessionId, "vin-scan-list")) ?? false,
  );
  // 24.11: stāvoklis paliek pēc FLASH MAX / vedņa soļa maiņas (komponente uzstādīta no jauna).
  const setShowFields = useCallback(
    (next: boolean) => {
      writeAdminUiOpen(adminUiOpenKey(sessionId, "vin-scan-fields"), next);
      setShowFieldsState(next);
    },
    [sessionId],
  );
  const setListExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setListExpandedState((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        writeAdminUiOpen(adminUiOpenKey(sessionId, "vin-scan-list"), v);
        return v;
      });
    },
    [sessionId],
  );
  /**
   * Pārlūka importa piezīmes pa avotiem. Agrāk viens globāls paziņojums virs saraksta tika notīrīts katrā
   * userscript ciklā un atkal parādīts («Lapa vēl nav gatava…»), tāpēc saraksts lēkāja (tas pats, kas #1152).
   */
  const [importNotes, setImportNotes] = useState<Record<string, string>>({});
  const [photoFail, setPhotoFail] = useState(0);

  // Tikai satura maiņa: jauns, bet tāds pats `initial` objekts (vecāka renderis) nedrīkst atiestatīt kartīti.
  const adoptRecord = useCallback((next: OrderVinScanRecord | null) => {
    setRecord((cur) => (sameOrderVinScanRecord(cur, next) ? cur : next));
  }, []);

  useEffect(() => {
    adoptRecord(initial);
  }, [initial, adoptRecord]);

  useEffect(() => {
    setImportNotes({});
  }, [vin]);

  useEffect(() => {
    if (record?.status !== "running") return;
    const started = Date.parse(record.at);
    const age = Number.isFinite(started) ? Date.now() - started : 0;
    if (age >= ORDER_VIN_SCAN_STUCK_MS) {
      adoptRecord({ ...record, status: "error", error: record.error || "Skenēšana apstājās" });
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
        if (next) adoptRecord(next);
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
  }, [sessionId, record?.status, record?.at, adoptRecord]);

  useEffect(() => {
    const onResult = (ev: Event) => {
      const d = parseVinScanBrowserEventDetail((ev as CustomEvent).detail);
      if (!d || d.vin !== vin.trim().toUpperCase()) return;
      const html = d.html;
      const sourceId = d.id;
      const noteFor = (text: string) =>
        setImportNotes((prev) => (prev[sourceId] === text ? prev : { ...prev, [sourceId]: text }));
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
            summary: d.summary,
            ...(html.trim()
              ? {
                  html,
                  pageUrl: d.pageUrl,
                  ...(typeof d.httpStatus === "number" ? { httpStatus: d.httpStatus } : {}),
                }
              : {}),
          },
        }),
      })
        .then(async (r) => {
          const json = (await r.json().catch(() => null)) as { vinScan?: unknown; error?: string } | null;
          if (!r.ok) {
            noteFor(browserImportRowNote(json?.error));
            return;
          }
          setImportNotes((prev) => {
            if (!(sourceId in prev)) return prev;
            const rest = { ...prev };
            delete rest[sourceId];
            return rest;
          });
          const next = parseOrderVinScanRecord(json?.vinScan);
          if (next) adoptRecord(next);
        })
        .catch(() => noteFor("Importēšana neizdevās"));
    };
    document.addEventListener("provin-vin-scan-result", onResult);
    return () => document.removeEventListener("provin-vin-scan-result", onResult);
  }, [sessionId, vin, adoptRecord]);

  const summary = useMemo(() => buildOrderVinScanSummary(record), [record]);
  // VIN SCAN v4: tā pati komponente kā Ātrajā pārbaudē (pasūtījuma ieraksta rindas + pasūtījuma pogas).
  const v4Rows = useMemo<VinScanV4Row[]>(
    () =>
      (record?.indicators ?? []).map((ind) => ({
        ...ind,
        openUrl: ind.openUrl ?? "",
        status: record?.status === "running" && ind.status === "unknown" ? "checking" : ind.status,
        ...(importNotes[ind.id] ? { note: importNotes[ind.id] } : {}),
      })) as VinScanV4Row[],
    [record, importNotes],
  );
  const v4Csdd = record?.indicators.find((r) => r.id === "csdd");
  // Dīlera datu prognoze (27.11): CSDD marka + gads (pasūtījuma 1. reģ.), citādi VIN.
  const forecastYear = v4Csdd?.vehicle?.year || kfz?.firstRegDate || null;
  const sourceCount = record?.indicators.length ?? 0;
  const clock = record?.at ? formatOrderVinScanClock(record.at) : "";
  const meta =
    record?.status === "running"
      ? "pārbauda…"
      : clock
        ? `skenēts automātiski ${clock}${sourceCount ? ` · ${sourceCount} bezmaksas avoti` : ""}`
        : "vēl nav skenēts";

  // 27.11 (Nils): sakļautajā joslā punkti tikai avotiem ar datiem; «Rādīt sarakstu» - visi.
  const dotRows = useMemo(() => orderVinScanCollapsedDots(summary), [summary]);

  const startScan = useCallback(async (sourceId?: string): Promise<OrderVinScanRecord | null> => {
    if (busy || !vin.trim()) return null;
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
      if (!res.ok) return null;
      const json = (await res.json()) as { vinScan?: unknown };
      const next = parseOrderVinScanRecord(json.vinScan);
      if (next) adoptRecord(next);
      return next;
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  }, [adoptRecord, busy, listingUrl, sessionId, vin]);

  useEffect(() => {
    const emit = (detail: AdminMobileVinScanState) => {
      try {
        document.dispatchEvent(new CustomEvent(ADMIN_MOBILE_VIN_SCAN_STATE_EVENT, { detail }));
      } catch {
        /* ignore */
      }
    };
    const onMobileScan = () => {
      if (busy) return;
      // Telefonā kartīte ir sakļauta - atveram un parādām, lai redz progresu.
      requestOpenAdminBlock("vin-scan-avoti");
      window.setTimeout(() => {
        document.querySelector('[data-admin-block="vin-scan-avoti"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      emit({ phase: "running" });
      void startScan().then((next) => {
        const s = buildOrderVinScanSummary(next);
        emit(s ? { phase: "done", found: s.found, total: next?.indicators.length ?? 0 } : { phase: "error" });
      });
    };
    document.addEventListener(ADMIN_MOBILE_VIN_SCAN_EVENT, onMobileScan);
    return () => document.removeEventListener(ADMIN_MOBILE_VIN_SCAN_EVENT, onMobileScan);
  }, [busy, startScan]);

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
      if (/^https:\/\//i.test(row.openUrl)) window.open(row.openUrl, "provin-vin-scan");
      return;
    }
    if (row.action === "retry") {
      void startScan(row.id);
      return;
    }
    if (row.openUrl && /^https:\/\//i.test(row.openUrl)) window.open(row.openUrl, "_blank", "noopener,noreferrer");
  };


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
            {summary.none > 0 ? <Counter state="none" count={summary.none} label="nav datu" /> : null}
            {summary.error > 0 ? <Counter state="error" count={summary.error} label="kļūda" /> : null}
            {summary.blocked > 0 ? <Counter state="blocked" count={summary.blocked} label="bloķē" /> : null}
            {summary.timeout > 0 ? <Counter state="timeout" count={summary.timeout} label="noildze" /> : null}
            {summary.configMissing > 0 ? (
              <Counter state="config_missing" count={summary.configMissing} label="nav atslēgas" />
            ) : null}
            {summary.browserOnly > 0 ? <Counter state="browser_only" count={summary.browserOnly} label="pārlūks" /> : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5" aria-label="Avoti ar datiem">
            {dotRows.map((row) => (
              <span
                key={row.id}
                className="inline-flex p-0.5"
                title={`${row.label}: atrasta info`}
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
      {vin.trim() ? (
        <AdminDealerForecastRow
          className="basis-full"
          make={v4Csdd?.vehicle?.make ?? ""}
          year={forecastYear}
          vin={vin.trim().toUpperCase()}
        />
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
      {record && record.status !== "running" ? (
        <AdminVinScanBrowserFetchHandoff
          vin={vin}
          at={record.at}
          rows={record.indicators}
          sessionId={sessionId}
        />
      ) : (
        <span hidden data-provin-order-vin={vin.trim().toUpperCase()} data-provin-order-session={sessionId} />
      )}
      {showFields ? (
        <div className="px-2 pb-2">
          <AdminUserscriptUpdateHint showInactive={false} />
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

              {record ? (
                <AdminVinScanV4
                  vin={vin.trim().toUpperCase()}
                  title={[v4Csdd?.vehicle?.make, v4Csdd?.vehicle?.model].filter(Boolean).join(" ")}
                  rows={v4Rows}
                  busy={record.status === "running" || busy}
                  scannedAt={record.at}
                  kfz={kfz ?? { orderId: sessionId, listingUrl }}
                  forecastYear={forecastYear}
                  onRetry={(ids) => {
                    // Tas pats ceļš kā rindas «Atkārtot» (tikai lietotāja klikšķis).
                    const row = summary?.rows.find((x) => x.id === ids[0]);
                    if (row) runAction({ ...row, action: "retry" });
                  }}
                  rowAction={(r) => {
                    const row = summary?.rows.find((x) => x.id === r.id) ?? summary?.noneRows.find((x) => x.id === r.id);
                    if (!row || row.action === "open" || row.action === "retry") return null;
                    return (
                      <button
                        type="button"
                        className={row.action === "import_auction" ? VIN_SCAN_V4_BTN_DARK : VIN_SCAN_V4_BTN}
                        disabled={busy}
                        onClick={() => runAction(row)}
                      >
                        {actionLabel(row.action)}
                      </button>
                    );
                  }}
                />
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
