"use client";

import { useEffect, useState } from "react";

import { normalizeVin } from "@/lib/order-field-validation";
import type { CcVinBlockState } from "@/lib/cc-vin-report";

type Status = {
  enabled: boolean;
  used: number;
  cap: number;
  cachedSummary: string;
  cachedAt: string;
};

type Props = {
  orderVin: string;
  sessionId?: string;
  editable: boolean;
  value: CcVinBlockState;
  onChange: (next: CcVinBlockState) => void;
  /** Testiem: bez GET. */
  preset?: Status;
};

const DISABLED = "TheCarApi izslēgts (nav apmaksāts / nav atslēgas)";

function errorLv(code: string, summary?: string): string {
  if (summary && code !== "unauthorized") return summary;
  switch (code) {
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "missing_thecarapi_credentials":
    case "thecarapi_disabled":
      return DISABLED;
    case "monthly_cap":
      return "Šomēnes TheCarApi limits ir sasniegts. Jauns izsaukums netika sūtīts.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    default:
      return summary || "TheCarApi neatbildēja. Mēģini vēlreiz.";
  }
}

export function AdminThecarapiIngestBar({
  orderVin,
  sessionId = "",
  editable,
  value,
  onChange,
  preset,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(preset ?? null);
  const vin = normalizeVin(orderVin);

  useEffect(() => {
    if (preset) {
      setStatus(preset);
      return;
    }
    if (!vin) return;
    let alive = true;
    void fetch(`/api/admin/sources/thecarapi?vin=${encodeURIComponent(vin)}`, { credentials: "include" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          enabled?: boolean;
          used?: number;
          cap?: number;
          cache?: { summary?: string; cachedAt?: string } | null;
        } | null;
        if (!alive || !body) return;
        setStatus({
          enabled: body.enabled === true,
          used: typeof body.used === "number" ? body.used : 0,
          cap: typeof body.cap === "number" ? body.cap : 150,
          cachedSummary: body.cache?.summary || "",
          cachedAt: body.cache?.cachedAt || "",
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [preset, vin]);

  const enabled = status?.enabled === true;
  const used = status?.used ?? 0;
  const cap = status?.cap ?? 150;
  const cached = Boolean(status?.cachedSummary);

  const load = async (skipCache: boolean) => {
    if (!editable || busy || !enabled || !vin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/thecarapi", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin,
          sessionId: sessionId || undefined,
          block: value,
          skipCache,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        summary?: string;
        block?: CcVinBlockState;
        used?: number;
        cap?: number;
        fromCache?: boolean;
        cachedAt?: string;
      };
      if (typeof body.used === "number" || typeof body.cap === "number") {
        setStatus((prev) => ({
          enabled: prev?.enabled === true && body.error !== "thecarapi_disabled" && body.error !== "missing_thecarapi_credentials",
          used: typeof body.used === "number" ? body.used : prev?.used ?? 0,
          cap: typeof body.cap === "number" ? body.cap : prev?.cap ?? 150,
          cachedSummary: body.fromCache ? body.summary || prev?.cachedSummary || "" : prev?.cachedSummary || "",
          cachedAt: body.cachedAt || prev?.cachedAt || "",
        }));
      }
      if (!res.ok || body.error) {
        setError(errorLv(body.error || "upstream_error", body.summary));
        if (body.block) onChange(body.block);
        return;
      }
      if (body.block) onChange(body.block);
      setStatus((prev) => ({
        enabled: true,
        used: typeof body.used === "number" ? body.used : prev?.used ?? used,
        cap: typeof body.cap === "number" ? body.cap : prev?.cap ?? cap,
        cachedSummary: body.summary || prev?.cachedSummary || "",
        cachedAt: body.cachedAt || prev?.cachedAt || "",
      }));
    } catch {
      setError(errorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  const onClick = () => {
    if (!enabled) return;
    if (cached) {
      const ok = window.confirm(
        `Šim VIN jau ir TheCarApi kešs${status?.cachedAt ? ` (${status.cachedAt.slice(0, 10)})` : ""}. Atjaunot (maksas)?`,
      );
      if (!ok) return;
      void load(true);
      return;
    }
    void load(false);
  };

  return (
    <div className="mb-3 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">EU izsoles (TheCarApi)</p>
      <p className="mb-2 text-[10px] leading-snug text-slate-500">
        {enabled ? `maksas izsaukums · šomēnes ${used}/${cap}` : DISABLED}
      </p>
      {cached ? (
        <p className="mb-2 text-[11px] text-slate-600">
          Kešs: {status?.cachedSummary}
          {status?.cachedAt ? ` · ${status.cachedAt.slice(0, 10)}` : ""}
        </p>
      ) : null}
      <button
        type="button"
        data-admin-paid="thecarapi"
        className="admin-paid-load rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] disabled:opacity-50"
        disabled={!editable || busy || !vin || !enabled}
        onClick={onClick}
      >
        {busy ? "Ielādē…" : !enabled ? DISABLED : cached ? "Atjaunot (maksas)" : "Ielādēt EU izsoles (TheCarApi)"}
      </button>
      {error ? <p className="mt-1.5 text-[10px] text-red-700">{error}</p> : null}
    </div>
  );
}
