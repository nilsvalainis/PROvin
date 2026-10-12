"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { VIN_SCAN_CATALOG, resolveVinScanOpenUrl } from "@/lib/vin-scan/catalog";
import { hasAnyVinScanPlate, type VinScanPlates } from "@/lib/vin-scan/plates";
import {
  buildVinScanFacts,
  formatVinScanExportJson,
  formatVinScanExportText,
  formatVinScanScannedAt,
} from "@/lib/vin-scan/summary";
import { VIN_SCAN_STATUSES, type VinScanIndicator, type VinScanStatus } from "@/lib/vin-scan/types";
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
  flags?: VinScanIndicator["flags"];
};

export type VinScanPanelSnapshotRow = {
  id: string;
  label: string;
  country: string;
  status: VinScanStatus | "idle";
  summary: string;
  openUrl: string;
  vehicle?: ScanRow["vehicle"];
  mileage: ScanRow["mileage"];
  detail?: string;
  flags?: ScanRow["flags"];
  media?: ScanRow["media"];
};

export type VinScanPanelSnapshot = {
  scannedAt: string;
  rows: VinScanPanelSnapshotRow[];
  busy?: boolean;
};

const CATALOG = VIN_SCAN_CATALOG;

const DOT: Record<VinScanStatus | "idle" | "checking", string> = {
  found: "bg-emerald-500",
  none: "bg-rose-500",
  unknown: "bg-slate-400",
  manual: "bg-amber-400",
  skipped: "bg-slate-300 dark:bg-slate-600",
  needs_input: "bg-amber-300",
  idle: "bg-transparent ring-1 ring-slate-300 dark:ring-slate-600",
  checking: "animate-pulse bg-sky-400",
};

const STATUS_LV: Record<VinScanStatus | "idle" | "checking", string> = {
  found: "Ir dati",
  none: "Nav",
  unknown: "Neizdevās",
  manual: "Līdz pogai",
  skipped: "Nav atslēgas",
  needs_input: "Vajag ievadi",
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
  return typeof o.id === "string" && isStatus(o.status) && typeof o.summary === "string";
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

function asMedia(v: unknown): ScanRow["media"] {
  const fromObj = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const url = String(fromObj.photoUrl || "");
  const countRaw = fromObj.photoCount;
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
  if (!url && !Number.isFinite(count)) return undefined;
  return { photoUrl: url || undefined, photoCount: Number.isFinite(count) ? count : undefined };
}

function cacheKey(vin: string): string {
  return `provin-vin-scan-v2:${vin}`;
}

function rowsFromIndicators(indicators: unknown[], vin: string, plates: VinScanPlates): Record<string, ScanRow> {
  const next: Record<string, ScanRow> = {};
  for (const item of indicators) {
    if (!isServerIndicator(item)) continue;
    const meta = CATALOG.find((source) => source.id === item.id);
    const rec = item as ScanRow & { vehicle?: unknown; mileage?: unknown; media?: unknown; flags?: unknown; detail?: unknown };
    next[item.id] = {
      id: item.id,
      label: meta?.label || item.label,
      country: meta?.country || item.country,
      status: item.status,
      summary: item.summary,
      detail: String(rec.detail || item.detail || ""),
      openUrl: typeof item.openUrl === "string" && item.openUrl ? item.openUrl : meta?.openUrl(vin, plates) ?? null,
      vehicle: asVehicle(rec.vehicle) ?? item.vehicle,
      mileage: asMileage(rec.mileage).map((row) => ({ ...row, source: row.source || meta?.label || item.label })),
      media: asMedia(rec.media) ?? item.media,
      flags: rec.flags && typeof rec.flags === "object" ? (rec.flags as ScanRow["flags"]) : item.flags,
    };
  }
  return next;
}

type HistoryEntry = { vin: string; scannedAt: string; found: number; none: number };

export function AdminVinScanPanel({
  vin,
  plates,
  scanNonce = 0,
  scanForce = false,
  onSnapshot,
}: {
  vin: string;
  plates: VinScanPlates;
  scanNonce?: number;
  scanForce?: boolean;
  onSnapshot?: (snapshot: VinScanPanelSnapshot) => void;
}) {
  const clean = normalizeVin(vin);
  const valid = isValidVin(clean);
  const canScan = valid || hasAnyVinScanPlate(plates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [byId, setById] = useState<Record<string, ScanRow>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setById({});
    setError("");
    setOpenId(null);
    setScannedAt("");
    setCopyNote("");
    if (!valid) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(cacheKey(clean));
        if (raw) {
          const parsed = JSON.parse(raw) as { scannedAt?: string; indicators?: unknown[] };
          if (Array.isArray(parsed.indicators) && !cancelled) {
            setById(rowsFromIndicators(parsed.indicators, clean, plates));
            setScannedAt(typeof parsed.scannedAt === "string" ? parsed.scannedAt : "");
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch(`/api/admin/vin-scan?vin=${encodeURIComponent(clean)}`, { credentials: "include" });
        const data = (await res.json().catch(() => null)) as {
          snapshot?: { scannedAt?: string; indicators?: unknown[] } | null;
          stale?: boolean;
        } | null;
        if (cancelled || !res.ok || !data?.snapshot || !Array.isArray(data.snapshot.indicators)) return;
        setById(rowsFromIndicators(data.snapshot.indicators, clean, plates));
        setScannedAt(typeof data.snapshot.scannedAt === "string" ? data.snapshot.scannedAt : "");
        try {
          localStorage.setItem(cacheKey(clean), JSON.stringify(data.snapshot));
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // plates used only to rebuild openUrl; VIN is the cache key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, valid]);

  useEffect(() => {
    void fetch("/api/admin/vin-scan?history=1", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { entries?: HistoryEntry[] }) => {
        if (Array.isArray(data?.entries)) setHistory(data.entries.slice(0, 12));
      })
      .catch(() => undefined);
  }, [scannedAt]);

  const rows = CATALOG.map((item) => byId[item.id]).filter((row): row is ScanRow => Boolean(row));
  const open = openId ? byId[openId] : undefined;
  const openHref = open
    ? resolveVinScanOpenUrl(CATALOG.find((item) => item.id === open.id) || { openUrl: () => "" }, clean, open.openUrl, plates)
    : "";
  const facts = rows.length > 0 ? buildVinScanFacts(rows) : null;
  const unknownIds = CATALOG.filter((item) => byId[item.id]?.status === "unknown").map((item) => item.id);
  const canRetry = !busy && unknownIds.length > 0;

  async function scanServer(opts: { force?: boolean; sources?: string[] } = {}) {
    const res = await fetch("/api/admin/vin-scan", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vin: clean,
        plates,
        force: Boolean(opts.force),
        ...(opts.sources?.length ? { sources: opts.sources } : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      indicators?: unknown;
      scannedAt?: string;
      vin?: string;
      cached?: boolean;
    } | null;
    if (!res.ok || !data || !Array.isArray(data.indicators)) {
      setError(res.status === 401 ? "Nav admin sesijas" : "Servera skenēšana neizdevās");
      return;
    }
    if (typeof data.scannedAt === "string") setScannedAt(data.scannedAt);
    const next = rowsFromIndicators(data.indicators, clean, plates);
    setById((prev) => ({ ...prev, ...next }));
    try {
      localStorage.setItem(
        cacheKey(typeof data.vin === "string" && data.vin ? data.vin : clean),
        JSON.stringify({ vin: data.vin || clean, scannedAt: data.scannedAt, indicators: data.indicators, plates }),
      );
    } catch {
      /* ignore */
    }
  }

  async function scan(force = false) {
    if (!canScan || busy) return;
    setBusy(true);
    setError("");
    setScannedAt(new Date().toISOString());
    try {
      await scanServer({ force });
    } catch {
      setError("Servera skenēšana neizdevās");
    } finally {
      setBusy(false);
    }
  }

  async function retryUnknown() {
    if (!canScan || busy || !canRetry) return;
    setBusy(true);
    setError("");
    try {
      await scanServer({ force: true, sources: unknownIds });
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
    if (scanNonce > 0 && canScan) void scan(scanForce);
    // scanNonce is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanNonce]);

  useEffect(() => {
    onSnapshot?.({
      scannedAt,
      busy,
      rows: CATALOG.map((item) => {
        const row = byId[item.id];
        return {
          id: item.id,
          label: item.label,
          country: item.country,
          status: row?.status ?? "idle",
          summary: row?.summary ?? "",
          openUrl: resolveVinScanOpenUrl(item, clean, row?.openUrl, plates),
          vehicle: row?.vehicle,
          mileage: row?.mileage ?? [],
          detail: row?.detail,
          flags: row?.flags,
          media: row?.media,
        };
      }),
    });
  }, [byId, scannedAt, busy, clean, onSnapshot, plates]);

  return (
    <section className="rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)]" aria-busy={busy}>
      {canRetry || rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5 px-2.5 py-2">
          {canRetry ? (
            <button
              type="button"
              disabled={!canScan || busy}
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
        </div>
      ) : null}
      {history.length > 0 ? (
        <div className="mx-2 mt-2 mb-1 flex flex-wrap gap-1">
          {history.map((entry) => (
            <a
              key={`${entry.vin}-${entry.scannedAt}`}
              href={`/admin/vin-scan?vin=${encodeURIComponent(entry.vin)}`}
              className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] ${
                entry.vin === clean
                  ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40"
                  : "border-slate-200 text-[var(--color-provin-muted)] hover:bg-black/[0.04] dark:border-slate-700"
              }`}
            >
              {entry.vin} · {entry.found}
            </a>
          ))}
        </div>
      ) : null}
      {facts ? (
        <div className="mx-2 mb-1 space-y-0.5 rounded-lg border border-[var(--admin-border-subtle)] px-2 py-1.5">
          <p className="text-[11px] font-semibold text-[var(--color-apple-text)]">
            {[facts.vehicleLine, facts.mileageLine].filter(Boolean).join(" · ")}
          </p>
          {facts.mileageRollback ? (
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Nobraukuma nesakritība</p>
          ) : null}
          {facts.wanted.length ? (
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Meklēšanā / zagts: {facts.wanted.join(", ")}</p>
          ) : null}
          {facts.recalls.length ? (
            <p className="text-[10px] text-[var(--color-apple-text)]">Atsaukumi: {facts.recalls.join("; ")}</p>
          ) : null}
          {facts.auctionPhotos.length ? (
            <p className="text-[10px] text-[var(--color-apple-text)]">Izsoles foto: {facts.auctionPhotos.join("; ")}</p>
          ) : null}
          {facts.registrations.length ? (
            <p className="text-[10px] text-[var(--color-apple-text)]">Reģistrācijas: {facts.registrations.join(", ")}</p>
          ) : null}
          {scannedAt ? (
            <p className="text-[10px] text-[var(--color-provin-muted)]">
              {formatVinScanScannedAt(scannedAt)}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="px-2.5 pb-2 text-[10px] text-rose-600 dark:text-rose-300">{error}</p> : null}
      {copyNote ? <p className="px-2.5 pb-1 text-[10px] text-[var(--color-provin-muted)]">{copyNote}</p> : null}
      <ul className="grid grid-cols-2 gap-1 px-2 py-2 sm:grid-cols-4">
        {CATALOG.map((item) => {
          const row = byId[item.id];
          const status = busy && !row ? "checking" : busy && row?.status === "unknown" ? "checking" : (row?.status ?? (busy ? "checking" : "idle"));
          const active = openId === item.id;
          const href = canScan ? resolveVinScanOpenUrl(item, clean, row?.openUrl, plates) : "";
          return (
            <li key={item.id}>
              <div
                className={`flex min-w-0 items-stretch rounded-lg border ${
                  vinScanWantedTileClass(item.id, status) ||
                  (active
                    ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/35"
                    : "border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(active ? null : item.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left"
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
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    data-provin-handoff-vin={clean || undefined}
                    className="inline-flex shrink-0 items-center px-1.5 text-[var(--color-provin-accent)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : (
                  <span
                    className="inline-flex shrink-0 items-center px-1.5 text-slate-300 dark:text-slate-600"
                    aria-hidden
                  >
                    <ExternalLink className="h-3 w-3" />
                  </span>
                )}
              </div>
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
            {open.label} · {statusLabel(open.id, busy ? "checking" : open.status)}
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {openHref ? (
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                data-provin-handoff-vin={clean || undefined}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-provin-accent)] hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Atvērt
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
