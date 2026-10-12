"use client";

import { useEffect, useState } from "react";

import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import {
  VIN_SCAN_BROWSER_CATALOG,
  VIN_SCAN_CATALOG,
  vinScanUserscriptMeetsMin,
  vinScanUserscriptMinLabel,
} from "@/lib/vin-scan/catalog";
import { buildVinScanOverview, formatVinScanExportJson, formatVinScanExportText, formatVinScanScannedAt } from "@/lib/vin-scan/summary";
import { countVinScanStatuses, VIN_SCAN_STATUSES, type VinScanIndicator, type VinScanStatus } from "@/lib/vin-scan/types";
import {
  isVinScanWantedSource,
  vinScanWantedDotClass,
  vinScanWantedStatusLabel,
  vinScanWantedTileClass,
} from "@/lib/vin-scan/wanted";

type ScanRow = {
  id: string;
  label: string;
  country: string;
  status: VinScanStatus;
  summary: string;
  detail: string;
  openUrl: string | null;
  vehicle?: VinScanIndicator["vehicle"];
  mileage: NonNullable<VinScanIndicator["mileage"]>;
  media?: VinScanIndicator["media"];
};

type ScanCatalogItem = {
  id: string;
  label: string;
  country: string;
  hint: string;
  openUrl: (vin: string) => string | null;
};

const SERVER_CATALOG: readonly ScanCatalogItem[] = VIN_SCAN_CATALOG;
const CATALOG: readonly ScanCatalogItem[] = [...VIN_SCAN_CATALOG, ...VIN_SCAN_BROWSER_CATALOG];

const DOT: Record<VinScanStatus | "idle" | "checking", string> = {
  found: "bg-emerald-500",
  none: "bg-rose-500",
  unknown: "bg-slate-400",
  manual: "bg-amber-400",
  skipped: "bg-slate-300 dark:bg-slate-600",
  idle: "bg-transparent ring-1 ring-slate-300 dark:ring-slate-600",
  checking: "animate-pulse bg-sky-400",
};

const STATUS_LV: Record<VinScanStatus | "idle" | "checking", string> = {
  found: "Ir dati",
  none: "Nav",
  unknown: "Neizdevās",
  manual: "Līdz pogai",
  skipped: "Nav atslēgas",
  idle: "Gaida",
  checking: "Pārbauda…",
};

function statusLabel(id: string, status: VinScanStatus | "idle" | "checking"): string {
  const wanted = isVinScanWantedSource(id) ? vinScanWantedStatusLabel(status) : "";
  return wanted || STATUS_LV[status];
}

function statusDot(id: string, status: VinScanStatus | "idle" | "checking"): string {
  const wanted = isVinScanWantedSource(id) ? vinScanWantedDotClass(status) : "";
  return wanted || DOT[status];
}

function isStatus(v: unknown): v is VinScanStatus {
  return typeof v === "string" && (VIN_SCAN_STATUSES as readonly string[]).includes(v);
}

function isServerIndicator(v: unknown): v is ScanRow {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && isStatus(o.status) && typeof o.summary === "string" && typeof o.detail === "string";
}

function asMileage(v: unknown): ScanRow["mileage"] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      return {
        date: String(o.date || ""),
        odometer: String(o.odometer || ""),
        source: String(o.source || ""),
      };
    })
    .filter((row): row is ScanRow["mileage"][number] => Boolean(row && (row.date || row.odometer)));
}

function asVehicle(v: unknown): ScanRow["vehicle"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const make = String(o.make || "");
  const model = String(o.model || "");
  const year = String(o.year || "");
  if (!make && !model && !year) return undefined;
  return { make, model, year };
}

function asMedia(v: unknown, photoUrl?: unknown, photoCount?: unknown): ScanRow["media"] {
  const fromObj = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const url = String(fromObj.photoUrl || photoUrl || "");
  const countRaw = fromObj.photoCount ?? photoCount;
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
  if (!url && !Number.isFinite(count)) return undefined;
  return { photoUrl: url || undefined, photoCount: Number.isFinite(count) ? count : undefined };
}

function browserRow(item: ScanCatalogItem, vin: string, status: VinScanStatus, summary: string): ScanRow {
  return {
    id: item.id,
    label: item.label,
    country: item.country,
    status,
    summary,
    detail: "",
    openUrl: item.openUrl(vin),
    mileage: [],
  };
}

export function AdminVinScanPanel({
  vin,
  scanNonce = 0,
}: {
  vin: string;
  scanNonce?: number;
}) {
  const clean = normalizeVin(vin);
  const valid = isValidVin(clean);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [byId, setById] = useState<Record<string, ScanRow>>({});
  const [checking, setChecking] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState("");
  const [copyNote, setCopyNote] = useState("");

  useEffect(() => {
    setById({});
    setChecking([]);
    setError("");
    setOpenId(null);
    setScannedAt("");
    setCopyNote("");
  }, [clean]);

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id?: string;
          vin?: string;
          status?: string;
          summary?: string;
          detail?: string;
          openUrl?: string;
          photoUrl?: string;
          photoCount?: number;
          vehicle?: unknown;
          mileage?: unknown;
          media?: unknown;
        }>
      ).detail;
      if (!detail || normalizeVin(detail.vin || "") !== clean) return;
      const item = VIN_SCAN_BROWSER_CATALOG.find((source) => source.id === detail.id);
      if (!item || !isStatus(detail.status)) return;
      setById((prev) => ({
        ...prev,
        [item.id]: {
          id: item.id,
          label: item.label,
          country: item.country,
          status: detail.status as VinScanStatus,
          summary: String(detail.summary || (detail.status === "none" && item.id === "plc_auction" ? "Nav ierakstu" : "")),
          detail: String(detail.detail || ""),
          openUrl: typeof detail.openUrl === "string" && detail.openUrl ? detail.openUrl : item.openUrl(clean),
          vehicle: asVehicle(detail.vehicle),
          mileage: asMileage(detail.mileage),
          media: asMedia(detail.media, detail.photoUrl, detail.photoCount),
        },
      }));
      setChecking((prev) => prev.filter((id) => id !== item.id));
    };
    document.addEventListener("provin-vin-scan-result", onResult);
    return () => document.removeEventListener("provin-vin-scan-result", onResult);
  }, [clean]);

  const rows = CATALOG.map((item) => byId[item.id]).filter((row): row is ScanRow => Boolean(row));
  const counts = rows.length > 0 ? countVinScanStatuses(rows) : null;
  const open = openId ? byId[openId] : undefined;
  const overview = rows.length > 0 ? buildVinScanOverview(rows) : null;
  const unknownServer = SERVER_CATALOG.filter((item) => byId[item.id]?.status === "unknown").map((item) => item.id);
  const unknownBrowser = VIN_SCAN_BROWSER_CATALOG.filter((item) => byId[item.id]?.status === "unknown").map((item) => item.id);
  const canRetry = !busy && (unknownServer.length > 0 || unknownBrowser.length > 0);

  function startBrowserScan(sourceIds: readonly string[] = VIN_SCAN_BROWSER_CATALOG.map((item) => item.id)) {
    if (sourceIds.length === 0) return;
    const ready = vinScanUserscriptMeetsMin(document.documentElement.getAttribute("data-provin-userscript") || "");
    if (!ready) {
      const installed = document.documentElement.getAttribute("data-provin-userscript");
      const summary = installed ? `Atjauniniet PROVIN skriptu līdz ${vinScanUserscriptMinLabel()}` : "PROVIN skripts nav ieslēgts";
      const manual: Record<string, ScanRow> = {};
      for (const item of VIN_SCAN_BROWSER_CATALOG.filter((source) => sourceIds.includes(source.id))) {
        manual[item.id] = browserRow(item, clean, "manual", summary);
      }
      setById((prev) => ({ ...prev, ...manual }));
      setChecking((prev) => prev.filter((id) => !sourceIds.includes(id)));
      return;
    }
    const first = VIN_SCAN_BROWSER_CATALOG.find((item) => item.id === sourceIds[0]);
    const popup = window.open(first?.openUrl(clean) || "about:blank", "provin-vin-scan");
    if (!popup) {
      setError("Pārlūks bloķēja cilni. Atļaujiet uznirstošos logus šai lapai.");
      return;
    }
    setChecking((prev) => [...new Set([...prev.filter((id) => !sourceIds.includes(id)), ...sourceIds])]);
    document.dispatchEvent(
      new CustomEvent("provin-vin-scan-browser", {
        detail: {
          vin: clean,
          sources: sourceIds,
          opened: true,
        },
      }),
    );
  }

  async function scanServer(sourceIds?: string[]) {
    const res = await fetch("/api/admin/vin-scan", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sourceIds?.length ? { vin: clean, sources: sourceIds } : { vin: clean }),
    });
    const data = (await res.json().catch(() => null)) as {
      indicators?: unknown;
      scannedAt?: string;
    } | null;
    if (!res.ok || !data || !Array.isArray(data.indicators)) {
      setError(res.status === 401 ? "Nav admin sesijas" : "Servera skenēšana neizdevās");
      return;
    }
    if (typeof data.scannedAt === "string") setScannedAt(data.scannedAt);
    const next: Record<string, ScanRow> = {};
    for (const item of data.indicators) {
      if (!isServerIndicator(item)) continue;
      const meta = VIN_SCAN_CATALOG.find((source) => source.id === item.id);
      const rec = item as ScanRow & { vehicle?: unknown; mileage?: unknown; media?: unknown };
      next[item.id] = {
        id: item.id,
        label: meta?.label || item.label,
        country: meta?.country || item.country,
        status: item.status,
        summary: item.summary,
        detail: item.detail,
        openUrl: meta?.openUrl(clean) ?? item.openUrl,
        vehicle: asVehicle(rec.vehicle) ?? item.vehicle,
        mileage: asMileage(rec.mileage).map((row) => ({ ...row, source: row.source || meta?.label || item.label })),
        media: asMedia(rec.media) ?? item.media,
      };
    }
    setById((prev) => ({ ...prev, ...next }));
    setOpenId((current) => (current && (next[current] || byId[current]) ? current : null));
  }

  async function scan() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    setScannedAt(new Date().toISOString());
    startBrowserScan();
    try {
      await scanServer();
    } catch {
      setError("Servera skenēšana neizdevās");
    } finally {
      setBusy(false);
    }
  }

  async function retryUnknown() {
    if (!valid || busy || !canRetry) return;
    setBusy(true);
    setError("");
    startBrowserScan(unknownBrowser);
    try {
      if (unknownServer.length > 0) await scanServer(unknownServer);
    } catch {
      setError("Servera skenēšana neizdevās");
    } finally {
      setBusy(false);
    }
  }

  async function copyExport(kind: "text" | "json") {
    const payload =
      kind === "json"
        ? formatVinScanExportJson({ vin: clean, scannedAt, rows: rows as VinScanIndicator[] })
        : formatVinScanExportText({ vin: clean, scannedAt, rows: rows as VinScanIndicator[] });
    try {
      await navigator.clipboard.writeText(payload);
      setCopyNote(kind === "json" ? "JSON nokopēts" : "Teksts nokopēts");
    } catch {
      setCopyNote("Neizdevās kopēt");
    }
  }

  useEffect(() => {
    if (scanNonce > 0 && valid) void scan();
    // scanNonce is the only trigger; scan reads current VIN.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanNonce]);

  return (
    <section
      className="rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)]"
      aria-busy={busy || checking.length > 0}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">Ātrā avotu pārbaude</p>
          <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
            Servera avoti atbild uzreiz. Pārējie atveras vienā cilnē. CarVertical VIN aizpilda, bet pogu nespied: jaunu atskaiti pērk tikai CarVertical blokā.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canRetry ? (
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => void retryUnknown()}
              className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] disabled:opacity-50 dark:border-slate-600"
            >
              Atkārtot neizdevušos
            </button>
          ) : null}
          {rows.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => void copyExport("text")}
                className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:border-slate-600"
              >
                Kopēt
              </button>
              <button
                type="button"
                onClick={() => void copyExport("json")}
                className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:border-slate-600"
              >
                JSON
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void scan()}
            className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
          >
            {busy ? "Skenē…" : "Skenēt avotus"}
          </button>
        </div>
      </div>
      {overview ? (
        <div className="mx-2 mb-1 rounded-lg border border-[var(--admin-border-subtle)] px-2 py-1.5">
          <p className="text-[11px] font-semibold text-[var(--color-apple-text)]">
            {[overview.vehicleLine, overview.mileageLine].filter(Boolean).join(" · ")}
          </p>
          {scannedAt ? (
            <p className="text-[10px] text-[var(--color-provin-muted)]">Skenēts: {formatVinScanScannedAt(scannedAt)}</p>
          ) : null}
        </div>
      ) : null}
      {!valid ? (
        <p className="px-2.5 pb-2 text-[10px] text-[var(--color-provin-muted)]">Ievadi VIN.</p>
      ) : null}
      {error ? <p className="px-2.5 pb-2 text-[10px] text-rose-600 dark:text-rose-300">{error}</p> : null}
      {copyNote ? <p className="px-2.5 pb-1 text-[10px] text-[var(--color-provin-muted)]">{copyNote}</p> : null}
      <ul className="grid grid-cols-2 gap-1 px-2 pb-2 sm:grid-cols-4">
        {CATALOG.map((item) => {
          const row = byId[item.id];
          const status = checking.includes(item.id) ? "checking" : (row?.status ?? "idle");
          const active = openId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                title={item.hint}
                onClick={() => setOpenId(active ? null : item.id)}
                className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition ${
                  vinScanWantedTileClass(item.id, status) ||
                  (active
                    ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/35"
                    : "border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(item.id, status)}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold text-[var(--color-apple-text)]">{item.label}</span>
                  <span
                    className={`block truncate text-[9px] ${
                      isVinScanWantedSource(item.id) && status === "found"
                        ? "font-semibold text-rose-700 dark:text-rose-300"
                        : "text-[var(--color-provin-muted)]"
                    }`}
                  >
                    {statusLabel(item.id, status)}
                    {status !== "checking" && row?.summary ? ` · ${row.summary}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <div className="mx-2 mb-2 rounded-lg border border-[var(--admin-border-subtle)] px-2 py-1.5">
          <p
            className={`text-[10px] font-semibold ${
              isVinScanWantedSource(open.id) && open.status === "found"
                ? "text-rose-700 dark:text-rose-300"
                : "text-[var(--color-apple-text)]"
            }`}
          >
            {open.label} · {statusLabel(open.id, checking.includes(open.id) ? "checking" : open.status)}
          </p>
          <p
            className={`mt-0.5 text-[10px] leading-snug ${
              isVinScanWantedSource(open.id) && open.status === "found"
                ? "font-semibold text-rose-700 dark:text-rose-300"
                : "text-[var(--color-apple-text)]"
            }`}
          >
            {open.summary}
          </p>
          {open.detail ? (
            <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-[var(--color-provin-muted)]">{open.detail}</p>
          ) : null}
          {open.media?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.media.photoUrl} alt="" className="mt-1 h-16 w-24 rounded object-cover" />
          ) : null}
          {open.openUrl ? (
            <a
              href={open.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-provin-handoff-vin={clean || undefined}
              className="mt-1 inline-block text-[10px] font-medium text-[var(--color-provin-accent)] hover:underline"
            >
              Atvērt avotu
            </a>
          ) : null}
        </div>
      ) : null}
      {counts ? (
        <p className="px-2.5 pb-2 text-[9px] text-[var(--color-provin-muted)]">
          {`Ir dati: ${counts.found}. Nav: ${counts.none}. Neizdevās: ${counts.unknown}. Līdz pogai: ${counts.manual}. Nav atslēgas: ${counts.skipped}.`}
        </p>
      ) : null}
    </section>
  );
}
