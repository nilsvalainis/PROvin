"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import dynamic from "next/dynamic";

// Rezultātu kartītes vajag tikai pēc pārbaudes — atsevišķs gabals, nav sākuma JS.
const AdminVinScanResultCards = dynamic(
  () => import("@/components/admin/AdminVinScanResultCards").then((m) => m.AdminVinScanResultCards),
  { ssr: false },
);
import { isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { VIN_SCAN_CATALOG, resolveVinScanOpenUrl } from "@/lib/vin-scan/catalog";
import { applyFinlandLink } from "@/lib/vin-scan/finland-link";
import { hasAnyVinScanPlate, type VinScanPlates } from "@/lib/vin-scan/plates";
import {
  buildVinScanFacts,
  formatVinScanExportJson,
  formatVinScanExportText,
  formatVinScanScannedAt,
} from "@/lib/vin-scan/summary";
import { VIN_SCAN_STATUSES, type VinScanIndicator, type VinScanStatus } from "@/lib/vin-scan/types";
import {
  decodeVinLocal,
  nordicVinSearchLinks,
  vinDecodeParseFromLocal,
} from "@/lib/vin-scan/vin-decode";
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
  inspections?: VinScanIndicator["inspections"];
  recalls?: VinScanIndicator["recalls"];
  incidents?: VinScanIndicator["incidents"];
  auctions?: VinScanIndicator["auctions"];
  listings?: VinScanIndicator["listings"];
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
  inspections?: ScanRow["inspections"];
  recalls?: ScanRow["recalls"];
  incidents?: ScanRow["incidents"];
  auctions?: ScanRow["auctions"];
  listings?: ScanRow["listings"];
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

function asObjectArray<T>(v: unknown, map: (o: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      return map(row as Record<string, unknown>);
    })
    .filter((row): row is T => Boolean(row));
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

function localVinDecodeRow(vin: string): ScanRow | null {
  const parsed = vinDecodeParseFromLocal(decodeVinLocal(vin));
  if (parsed.status !== "found") return null;
  const meta = CATALOG.find((source) => source.id === "vin_decode");
  if (!meta) return null;
  return {
    id: "vin_decode",
    label: meta.label,
    country: meta.country,
    status: parsed.status,
    summary: parsed.summary,
    detail: parsed.detail ?? "",
    openUrl: meta.openUrl(vin),
    vehicle: parsed.vehicle,
    mileage: [],
    flags: parsed.flags,
  };
}

function rowsFromIndicators(
  indicators: unknown[],
  vin: string,
  plates: VinScanPlates,
  listingUrl = "",
): Record<string, ScanRow> {
  const next: Record<string, ScanRow> = {};
  for (const item of indicators) {
    if (!isServerIndicator(item)) continue;
    const meta = CATALOG.find((source) => source.id === item.id);
    const rec = item as ScanRow & {
      vehicle?: unknown;
      mileage?: unknown;
      media?: unknown;
      flags?: unknown;
      detail?: unknown;
      inspections?: unknown;
      recalls?: unknown;
      incidents?: unknown;
      auctions?: unknown;
      listings?: unknown;
    };
    next[item.id] = {
      id: item.id,
      label: meta?.label || item.label,
      country: meta?.country || item.country,
      status: item.status,
      summary: item.summary,
      detail: String(rec.detail || item.detail || ""),
      openUrl:
        typeof item.openUrl === "string" && item.openUrl
          ? item.openUrl
          : meta?.openUrl(vin, plates, listingUrl) ?? null,
      vehicle: asVehicle(rec.vehicle) ?? item.vehicle,
      mileage: asMileage(rec.mileage).map((row) => ({ ...row, source: row.source || meta?.label || item.label })),
      media: asMedia(rec.media) ?? item.media,
      flags: rec.flags && typeof rec.flags === "object" ? (rec.flags as ScanRow["flags"]) : item.flags,
      inspections: asObjectArray(rec.inspections, (o) => {
        const date = String(o.date || "");
        const result = String(o.result || "");
        const odometer = String(o.odometer || "");
        if (!date && !result && !odometer) return null;
        return { date, result, odometer };
      }),
      recalls: asObjectArray(rec.recalls, (o) => {
        const title = String(o.title || "");
        if (!title) return null;
        return { title, date: String(o.date || "") };
      }),
      incidents: asObjectArray(rec.incidents, (o) => {
        const summary = String(o.summary || "");
        if (!summary) return null;
        return { date: String(o.date || ""), summary };
      }),
      auctions: asObjectArray(rec.auctions, (o) => {
        const photoCountRaw = o.photoCount;
        const photoCount = typeof photoCountRaw === "number" ? photoCountRaw : Number(photoCountRaw);
        const row = {
          title: String(o.title || ""),
          date: String(o.date || ""),
          price: String(o.price || ""),
          venue: String(o.venue || ""),
          photoUrl: String(o.photoUrl || "") || undefined,
          photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
        };
        if (!row.title && !row.date && !row.price && !row.venue && !row.photoUrl && !row.photoCount) return null;
        return row;
      }),
      listings: asObjectArray(rec.listings, (o) => {
        const date = String(o.date || "");
        const price = String(o.price || "");
        const odometer = String(o.odometer || "");
        const photoUrl = String(o.photoUrl || "");
        if (!date && !price && !odometer && !photoUrl) return null;
        return { date, price, odometer, photoUrl: photoUrl || undefined };
      }),
    };
  }
  return next;
}

type HistoryEntry = { vin: string; scannedAt: string; found: number; none: number };

export function AdminVinScanPanel({
  vin,
  plates,
  listingUrl = "",
  scanNonce = 0,
  scanForce = false,
  onSnapshot,
  historyOpen = false,
}: {
  vin: string;
  plates: VinScanPlates;
  listingUrl?: string;
  scanNonce?: number;
  scanForce?: boolean;
  onSnapshot?: (snapshot: VinScanPanelSnapshot) => void;
  /** Iepriekšējās pārbaudes — ielādē un rāda tikai, kad atvērts. */
  historyOpen?: boolean;
}) {
  const clean = normalizeVin(vin);
  const valid = isValidVin(clean);
  const listing = listingUrl.trim();
  const canScan = valid || hasAnyVinScanPlate(plates) || isPlausibleListingUrl(listing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [byId, setById] = useState<Record<string, ScanRow>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const localDecode = valid ? localVinDecodeRow(clean) : null;
    setById(localDecode ? { vin_decode: localDecode } : {});
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
            setById({
              ...(localDecode ? { vin_decode: localDecode } : {}),
              ...rowsFromIndicators(parsed.indicators, clean, plates, listing),
            });
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
        setById({
          ...(localDecode ? { vin_decode: localDecode } : {}),
          ...rowsFromIndicators(data.snapshot.indicators, clean, plates, listing),
        });
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
    // plates/listing used only to rebuild openUrl; VIN is the cache key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, valid]);

  useEffect(() => {
    if (!historyOpen) return;
    void fetch("/api/admin/vin-scan?history=1", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { entries?: HistoryEntry[] }) => {
        if (Array.isArray(data?.entries)) setHistory(data.entries.slice(0, 12));
      })
      .catch(() => undefined);
  }, [scannedAt, historyOpen]);

  const displayById = useMemo(() => {
    const list = applyFinlandLink(Object.values(byId), plates);
    const next: Record<string, ScanRow> = {};
    for (const row of list) next[row.id] = row;
    return next;
  }, [byId, plates]);

  const rows = CATALOG.map((item) => displayById[item.id]).filter((row): row is ScanRow => Boolean(row));
  const facts = rows.length > 0 ? buildVinScanFacts(rows) : null;
  const unknownIds = CATALOG.filter((item) => displayById[item.id]?.status === "unknown").map((item) => item.id);
  const canRetry = !busy && unknownIds.length > 0;
  const nordicLinks = valid ? nordicVinSearchLinks(clean) : [];
  const linkBtn =
    "rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:border-slate-600";

  async function scanServer(opts: { force?: boolean; sources?: string[] } = {}) {
    const res = await fetch("/api/admin/vin-scan", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vin: clean,
        plates,
        listingUrl: listing,
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
    const next = rowsFromIndicators(data.indicators, clean, plates, listing);
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
        const row = displayById[item.id];
        return {
          id: item.id,
          label: item.label,
          country: item.country,
          status: row?.status ?? "idle",
          summary: row?.summary ?? "",
          openUrl: resolveVinScanOpenUrl(item, clean, row?.openUrl, plates, listing),
          vehicle: row?.vehicle,
          mileage: row?.mileage ?? [],
          detail: row?.detail,
          flags: row?.flags,
          media: row?.media,
          inspections: row?.inspections,
          recalls: row?.recalls,
          incidents: row?.incidents,
          auctions: row?.auctions,
          listings: row?.listings,
        };
      }),
    });
  }, [displayById, scannedAt, busy, clean, onSnapshot, plates, listing]);

  return (
    <section className="rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)]" aria-busy={busy}>
      {canRetry || rows.length > 0 || nordicLinks.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5 px-2.5 py-2">
          {nordicLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-provin-handoff-vin={clean || undefined}
              className={linkBtn}
            >
              {link.label}
            </a>
          ))}
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
      {historyOpen ? (
        <div className="mx-2 mt-2 mb-1 flex flex-wrap gap-1" aria-label="Iepriekšējās pārbaudes">
          {history.length === 0 ? <span className="text-[11px] text-[#86868b]">Vēsture tukša vai ielādējas…</span> : null}
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
      {facts && (facts.wanted.length || facts.mileageRollback || scannedAt) ? (
        <div className="mx-2 mb-1 space-y-0.5 px-1 py-1">
          {facts.mileageRollback ? (
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Nobraukuma nesakritība</p>
          ) : null}
          {facts.wanted.length ? (
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">{facts.wanted.join(", ")}</p>
          ) : null}
          {scannedAt ? (
            <p className="text-[10px] text-[var(--color-provin-muted)]">{formatVinScanScannedAt(scannedAt)}</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="px-2.5 pb-2 text-[10px] text-rose-600 dark:text-rose-300">{error}</p> : null}
      {copyNote ? <p className="px-2.5 pb-1 text-[10px] text-[var(--color-provin-muted)]">{copyNote}</p> : null}
      <ul className="grid grid-cols-2 gap-1 px-2 py-2 sm:grid-cols-4">
        {CATALOG.map((item) => {
          const row = displayById[item.id];
          const status = busy && !row ? "checking" : busy && row?.status === "unknown" ? "checking" : (row?.status ?? (busy ? "checking" : "idle"));
          const active = openId === item.id;
          const href = canScan ? resolveVinScanOpenUrl(item, clean, row?.openUrl, plates, listing) : "";
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
      {rows.length > 0 ? <AdminVinScanResultCards rows={rows} /> : null}
    </section>
  );
}
