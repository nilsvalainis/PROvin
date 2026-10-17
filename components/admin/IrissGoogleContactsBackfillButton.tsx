"use client";

import { useCallback, useState } from "react";
import {
  formatGoogleContactBackfillConfirmLv,
  formatGoogleContactBackfillDryRunLv,
  formatGoogleContactBackfillResultLv,
  mergeGoogleContactBackfillCounts,
  emptyGoogleContactBackfillCounts,
  type GoogleContactBackfillCounts,
} from "@/lib/google-contacts-backfill";

type BackfillResponse = GoogleContactBackfillCounts & {
  error?: string;
  dryRun?: boolean;
  nextCursor?: string | null;
  done?: boolean;
};

async function runBackfillPass(dryRun: boolean): Promise<GoogleContactBackfillCounts> {
  let cursor = "0";
  let acc = emptyGoogleContactBackfillCounts(0);
  for (;;) {
    const qs = new URLSearchParams({ cursor, limit: dryRun ? "40" : "20" });
    if (dryRun) qs.set("dryRun", "1");
    const res = await fetch(`/api/admin/iriss-pasutijumi/google-contacts-backfill?${qs.toString()}`, {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as BackfillResponse;
    if (!res.ok) {
      if (data.error === "unconfigured") {
        throw new Error("Google Contacts nav konfigurēts (info@provin.lv).");
      }
      if (data.error === "unauthorized") throw new Error("Nav administratora sesijas.");
      if (data.error === "store_disabled") throw new Error("Pasūtījumu krātuve nav pieejama.");
      throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
    }
    acc = mergeGoogleContactBackfillCounts(acc, data);
    if (data.done || !data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return acc;
}

export function IrissGoogleContactsBackfillButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg("Pārbauda Google kontaktus…");
    try {
      const preview = await runBackfillPass(true);
      setMsg(formatGoogleContactBackfillDryRunLv(preview));
      const pending = preview.wouldCreate + preview.wouldMatch;
      if (pending === 0) {
        setMsg(formatGoogleContactBackfillResultLv({ ...preview, created: 0, matched: 0 }));
        return;
      }
      const ok = window.confirm(formatGoogleContactBackfillConfirmLv(preview));
      if (!ok) {
        setMsg("Sinhronizācija atcelta. " + formatGoogleContactBackfillDryRunLv(preview));
        return;
      }
      setMsg("Sinhronizē ar Google Contacts…");
      const result = await runBackfillPass(false);
      setMsg(formatGoogleContactBackfillResultLv(result));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sinhronizācija neizdevās.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const btnClass = compact
    ? "inline-flex h-8 items-center rounded-md border border-slate-200/90 bg-white px-2 text-[11px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50/90 disabled:opacity-40"
    : "inline-flex min-h-[40px] items-center rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50/90 disabled:opacity-40";

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col gap-1.5"}>
      <button type="button" className={btnClass} disabled={busy} onClick={() => void run()}>
        {busy ? "Sinhronizē…" : "Sinhronizēt klientus ar Google Contacts"}
      </button>
      {err ? (
        <p className="max-w-md text-[11px] leading-snug text-red-700" role="alert">
          {err}
        </p>
      ) : msg ? (
        <p className="max-w-lg text-[11px] leading-snug text-[var(--color-provin-muted)]">{msg}</p>
      ) : compact ? null : (
        <p className="max-w-lg text-[11px] leading-snug text-[var(--color-provin-muted)]">
          Piesaista esošos IRISS klientus kontam info@provin.lv. Esošos Google kontaktus nepārraksta.
        </p>
      )}
    </div>
  );
}
