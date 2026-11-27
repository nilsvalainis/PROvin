"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdminTraficomBrowserCodeForm } from "@/components/admin/AdminTraficomBrowserCodeForm";
import type { VinRegistryBlockState } from "@/lib/admin-source-blocks";
import {
  applyTraficomFiResultToBlock,
  traficomFiCanApplyManually,
  traficomFiCanRestorePrevious,
  traficomFiClientShouldSync,
  traficomFiSessionSummaryLv,
} from "@/lib/traficom-fi-auto-logic";
import { isTraficomFiAutoActive, type TraficomFiAutoStatus, type TraficomFiRelaySession } from "@/lib/traficom-fi-auto-types";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" }).format(d);
}

type Props = {
  sessionId: string;
  orderVin: string;
  value: VinRegistryBlockState;
  disabled?: boolean;
  readOnly: boolean;
  /** Bloka atjaunināšana (tā pati funkcija, ko serveris lieto automātiskajai ievietošanai). */
  onChange: (next: VinRegistryBlockState) => void;
  /** «Atjaunot iepriekšējo RAW»: iepriekšējais teksts iet caur esošo ielīmējuma parseri. */
  onRestoreRaw: (raw: string) => void;
};

/**
 * «Traficom automātika» Somijas (FIN) blokā - kā «e.csdd automātika» CSDD blokā (#1277): stāvoklis, eParaksts kods,
 * pogas «Ielasīt no reģistra» / «Pieprasīt vēlreiz», «Ievietot datus», «Atjaunot iepriekšējo RAW», «Atbrīvot sesiju».
 * Ja relejs nav pieslēgts un pieprasījuma nav bijis, neko nerāda (manuālā ielīmēšana paliek, kā ir).
 */
export function AdminTraficomFiAutoPanel({ sessionId, orderVin, value, disabled, readOnly, onChange, onRestoreRaw }: Props) {
  const [status, setStatus] = useState<TraficomFiAutoStatus | null>(null);
  const [session, setSession] = useState<TraficomFiRelaySession | null>(null);
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const autoAppliedFor = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/traficom?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: TraficomFiAutoStatus | null; relayConfigured: boolean; session: TraficomFiRelaySession | null };
      setStatus(data.status);
      setSession(data.session);
      setRelayConfigured(data.relayConfigured);
    } catch {
      /* tīkla kļūda: nākamreiz */
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = isTraficomFiAutoActive(status);
  // eParaksts gaida līdz 5 min; ja relejs klusē 15 min - ļauj pieprasīt vēlreiz.
  const stale = active && Date.now() - Date.parse(status?.updatedAt ?? "") > 15 * 60_000;
  // Pārlūka kods: no šī pasūtījuma statusa vai no releja sesijas (ja kodu gaida cits vaicājums, piem. VIN SCAN).
  const codeSource = status?.state === "awaiting_browser_code" ? status : session?.state === "awaiting_browser_code" ? session : null;
  const waitingBrowserCode = Boolean(codeSource);
  useEffect(() => {
    if (!active && !waitingBrowserCode) return;
    // Kods derīgs ~1 min - kamēr to gaida, aptauja biežāk.
    const t = setInterval(() => void load(), waitingBrowserCode ? 2000 : 5000);
    return () => clearInterval(t);
  }, [active, waitingBrowserCode, load]);


  const postApply = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/admin/traficom/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...body }),
        });
        const data = (await res.json()) as { status?: TraficomFiAutoStatus };
        if (data.status) setStatus(data.status);
      } catch {
        /* dati jau blokā; atzīme nākamreiz */
      }
    },
    [sessionId],
  );

  const apply = useCallback(
    async (s: TraficomFiAutoStatus) => {
      const previousRawText = valueRef.current.rawUnprocessedData ?? "";
      onChange(applyTraficomFiResultToBlock(valueRef.current, { rawText: s.rawText, data: s.data }));
      await postApply({ previousRawText });
    },
    [onChange, postApply],
  );

  const restore = useCallback(async () => {
    const prev = status?.previousRawText ?? "";
    if (!prev.trim()) return;
    onRestoreRaw(prev);
    await postApply({ action: "restore" });
  }, [onRestoreRaw, postApply, status?.previousRawText]);

  useEffect(() => {
    if (readOnly || disabled || !status?.rawText) return;
    const key = `${status.jobId ?? ""}:${status.checkedAt ?? ""}:${status.appliedAt ?? ""}`;
    if (autoAppliedFor.current === key) return;
    if (traficomFiClientShouldSync(status, valueRef.current)) {
      // Serveris jau ievietoja - cilne pārņem to pašu rezultātu (citādi autosave to pārrakstītu ar veco).
      autoAppliedFor.current = key;
      onChange(applyTraficomFiResultToBlock(valueRef.current, { rawText: status.rawText, data: status.data }));
      return;
    }
    const fresh = Date.now() - Date.parse(status.checkedAt ?? status.updatedAt ?? "") < 24 * 3_600_000;
    if (fresh && status.state === "found" && !status.appliedAt && !status.restoredAt && traficomFiCanApplyManually(status, valueRef.current)) {
      autoAppliedFor.current = key;
      void apply(status);
    }
  }, [status, readOnly, disabled, apply, onChange]);

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const done = status?.state === "found" || status?.state === "not_found";
      const res = await fetch("/api/admin/traficom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // «Pieprasīt vēlreiz» apiet releja kešu (7 d).
        body: JSON.stringify({ sessionId, vin: orderVin, force: stale || done || status?.state === "error" }),
      });
      const data = (await res.json()) as { status?: TraficomFiAutoStatus };
      if (data.status) setStatus(data.status);
      if (!res.ok) setError("Traficom pieprasījums neizdevās");
      void load();
    } catch {
      setError("Traficom pieprasījums neizdevās");
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/traficom/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      const data = (await res.json()) as { session?: TraficomFiRelaySession | null };
      if (data.session) setSession(data.session);
      if (!res.ok) setError("Neizdevās atbrīvot Traficom sesiju");
    } catch {
      setError("Traficom relejs nav sasniedzams");
    } finally {
      setBusy(false);
    }
  };

  if (!status && !relayConfigured) return null;

  const done = status?.state === "found" || status?.state === "not_found";
  const canReplace = traficomFiCanApplyManually(status, value);
  const canRestore = traficomFiCanRestorePrevious(status, value);
  const when = fmtWhen(status?.checkedAt ?? status?.updatedAt);
  const code = status?.state === "awaiting_eparaksts" ? status.verificationCode : session?.state === "awaiting_eparaksts" ? session.verificationCode : undefined;
  const waiting = status?.state === "awaiting_eparaksts";
  const data = status?.state === "found" ? status.data : undefined;
  const red = data?.flags.filter((f) => f.level === "red") ?? [];
  const yellow = data?.flags.filter((f) => f.level !== "red") ?? [];

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">Traficom automātika</span>
        <span className={status?.state === "error" ? "text-red-700" : undefined}>{status?.message ?? "Nav pieprasīts"}</span>
        {status?.reason ? <span className="text-slate-500">· FI pazīme: {status.reason}</span> : null}
        {when ? <span className="text-slate-500">· {when}</span> : null}
      </div>
      {relayConfigured ? <p className="mt-0.5 text-slate-500">{traficomFiSessionSummaryLv(session, fmtTime)}</p> : null}
      {waiting ? (
        <p className="mt-1 text-[13px] font-semibold text-slate-900">
          Gaida eParaksts apstiprinājumu telefonā{code ? ` · kods ${code}` : ""}
          {code ? <span className="ml-2 text-[11px] font-normal text-slate-600">Apstiprini tikai, ja kods lietotnē sakrīt</span> : null}
        </p>
      ) : null}
      {codeSource ? <AdminTraficomBrowserCodeForm source={codeSource} disabled={disabled} readOnly={readOnly} onSent={() => void load()} /> : null}
      {data ? (
        <div className="mt-1 space-y-0.5">
          {data.vehicleTitle ? <p className="font-medium text-slate-900">{data.vehicleTitle}</p> : null}
          {data.summary.map(([l, v]) => (
            <p key={`s-${l}`}>
              <span className="text-slate-500">{l}:</span> {v}
            </p>
          ))}
          {red.map((f) => (
            <p key={`r-${f.text}`} className="text-red-700">
              ! {f.text}
            </p>
          ))}
          {yellow.map((f) => (
            <p key={`y-${f.text}`} className="text-amber-700">
              ⚠ {f.text}
            </p>
          ))}
          {data.sections.length ? (
            <button type="button" className="text-[11px] text-slate-600 underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Paslēpt visas sadaļas" : `Visas sadaļas (${data.sections.length})`}
            </button>
          ) : null}
          {showAll
            ? data.sections.map((s) => (
                <div key={s.title} className="mt-1">
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  {s.rows.map(([l, v], i) => (
                    <p key={`${s.title}-${i}`}>
                      <span className="text-slate-500">{l}:</span> {v}
                    </p>
                  ))}
                </div>
              ))
            : null}
          {status?.pdf ? (
            <a className="text-slate-700 underline" href={`/api/admin/traficom/pdf?sessionId=${encodeURIComponent(sessionId)}`} target="_blank" rel="noopener noreferrer">
              Traficom PDF ({status.pdf.name})
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {relayConfigured && (!active || stale) ? (
            <button type="button" className={btn} disabled={disabled || busy || !orderVin.trim()} onClick={() => void request()}>
              {done || stale || status?.state === "error" ? "Pieprasīt vēlreiz" : "Ielasīt no reģistra"}
            </button>
          ) : null}
          {canReplace && status ? (
            <button type="button" className={btn} disabled={disabled || busy} title="Iepriekšējais RAW tiek saglabāts - to var atjaunot" onClick={() => void apply(status)}>
              Ievietot datus
            </button>
          ) : null}
          {canRestore ? (
            <button type="button" className={btn} disabled={disabled || busy} title="Atgriež RAW tekstu, kas bija pirms Traficom datu ievietošanas" onClick={() => void restore()}>
              Atjaunot iepriekšējo RAW
            </button>
          ) : null}
          {relayConfigured && session && session.state !== "logged_out" ? (
            <button type="button" className={btn} disabled={disabled || busy} title="Serveris aizver Traficom pārlūku; nākamais vaicājums prasīs eParaksts (pārlūka apstiprinājums paliek)" onClick={() => void release()}>
              Atbrīvot sesiju
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
