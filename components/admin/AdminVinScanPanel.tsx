"use client";

import { useEffect, useState } from "react";

import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { VIN_SCAN_BROWSER_CATALOG, VIN_SCAN_CATALOG } from "@/lib/vin-scan/catalog";
import { countVinScanStatuses, VIN_SCAN_STATUSES, type VinScanStatus } from "@/lib/vin-scan/types";

type ScanRow = {
  id: string;
  label: string;
  country: string;
  status: VinScanStatus;
  summary: string;
  detail: string;
  openUrl: string | null;
};

type ScanCatalogItem = {
  id: string;
  label: string;
  country: string;
  hint: string;
  openUrl: (vin: string) => string | null;
};

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

function isStatus(v: unknown): v is VinScanStatus {
  return typeof v === "string" && (VIN_SCAN_STATUSES as readonly string[]).includes(v);
}

function isServerIndicator(v: unknown): v is ScanRow {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && isStatus(o.status) && typeof o.summary === "string" && typeof o.detail === "string";
}

function userscriptSupportsBrowserScan(): boolean {
  const raw = document.documentElement.getAttribute("data-provin-userscript") || "";
  const parts = raw.split(".").map((n) => Number.parseInt(n, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major > 1 || (major === 1 && minor >= 9);
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
  };
}

export function AdminVinScanPanel({ vin }: { vin: string }) {
  const clean = normalizeVin(vin);
  const valid = isValidVin(clean);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [byId, setById] = useState<Record<string, ScanRow>>({});
  const [checking, setChecking] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setById({});
    setChecking([]);
    setError("");
    setOpenId(null);
  }, [clean]);

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; vin?: string; status?: string; summary?: string; detail?: string }>).detail;
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
          summary: String(detail.summary || ""),
          detail: String(detail.detail || ""),
          openUrl: item.openUrl(clean),
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

  function startBrowserScan() {
    const ready = userscriptSupportsBrowserScan();
    if (!ready) {
      const installed = document.documentElement.getAttribute("data-provin-userscript");
      const summary = installed ? "Atjauniniet PROVIN skriptu līdz 1.9" : "PROVIN skripts nav ieslēgts";
      const manual: Record<string, ScanRow> = {};
      for (const item of VIN_SCAN_BROWSER_CATALOG) manual[item.id] = browserRow(item, clean, "manual", summary);
      setById((prev) => ({ ...prev, ...manual }));
      setChecking([]);
      return;
    }
    const first = VIN_SCAN_BROWSER_CATALOG[0];
    const popup = window.open(first?.openUrl(clean) || "about:blank", "provin-vin-scan");
    if (!popup) {
      setError("Pārlūks bloķēja cilni. Atļaujiet uznirstošos logus šai lapai.");
      return;
    }
    setChecking(VIN_SCAN_BROWSER_CATALOG.map((item) => item.id));
    document.dispatchEvent(
      new CustomEvent("provin-vin-scan-browser", {
        detail: {
          vin: clean,
          sources: VIN_SCAN_BROWSER_CATALOG.map((item) => item.id),
          opened: true,
        },
      }),
    );
  }

  async function scan() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    startBrowserScan();
    try {
      const res = await fetch("/api/admin/vin-scan", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin: clean }),
      });
      const data = (await res.json().catch(() => null)) as { indicators?: unknown } | null;
      if (!res.ok || !data || !Array.isArray(data.indicators)) {
        setError(res.status === 401 ? "Nav admin sesijas" : "Servera skenēšana neizdevās");
        return;
      }
      const next: Record<string, ScanRow> = {};
      for (const item of data.indicators) {
        if (!isServerIndicator(item)) continue;
        const meta = VIN_SCAN_CATALOG.find((source) => source.id === item.id);
        next[item.id] = {
          id: item.id,
          label: meta?.label || item.label,
          country: meta?.country || item.country,
          status: item.status,
          summary: item.summary,
          detail: item.detail,
          openUrl: meta?.openUrl(clean) ?? item.openUrl,
        };
      }
      setById((prev) => ({ ...prev, ...next }));
      setOpenId((current) => (current && (next[current] || byId[current]) ? current : null));
    } catch {
      setError("Servera skenēšana neizdevās");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)]"
      aria-busy={busy || checking.length > 0}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">Ātrā avotu pārbaude</p>
          <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
            Servera avoti atbild uzreiz. Pārējie atveras vienā cilnē: skripts ieraksta VIN un nolasa, vai ieraksts ir redzams pirms pirkuma.
          </p>
        </div>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => void scan()}
          className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
        >
          {busy ? "Skenē…" : "Skenēt avotus"}
        </button>
      </div>
      {!valid ? (
        <p className="px-2.5 pb-2 text-[10px] text-[var(--color-provin-muted)]">Ievadi VIN.</p>
      ) : null}
      {error ? <p className="px-2.5 pb-2 text-[10px] text-rose-600 dark:text-rose-300">{error}</p> : null}
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
                  active
                    ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/35"
                    : "border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold text-[var(--color-apple-text)]">{item.label}</span>
                  <span className="block truncate text-[9px] text-[var(--color-provin-muted)]">
                    {STATUS_LV[status]}
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
          <p className="text-[10px] font-semibold text-[var(--color-apple-text)]">
            {open.label} · {STATUS_LV[checking.includes(open.id) ? "checking" : open.status]}
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-apple-text)]">{open.summary}</p>
          {open.detail ? (
            <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-[var(--color-provin-muted)]">{open.detail}</p>
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
