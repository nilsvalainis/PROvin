"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LtabBlockState } from "@/lib/admin-source-blocks";
import { ltabAutoCanApply } from "@/lib/ltab-auto-logic";
import { isLtabAutoActive, LTAB_SOURCE_PDF_LABEL, type LtabAutoStatus } from "@/lib/ltab-auto-types";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

type Props = {
  sessionId: string;
  orderVin: string;
  value: LtabBlockState;
  disabled?: boolean;
  readOnly: boolean;
  onApply: (next: LtabBlockState) => void;
};

/**
 * LTAB automātika LTAB blokā: stāvoklis (rindā / Smart-ID kods / meklē / rezultāts), oriģinālais PDF avotos kā "LTAB",
 * poga "Pieprasīt no LTAB". Rezultātu tukšā blokā ievieto automātiski vienreiz; citādi ar pogu.
 * Ja relejs nav pieslēgts un pieprasījumu nav bijis, neko nerāda.
 */
export function AdminLtabAutoPanel({ sessionId, orderVin, value, disabled, readOnly, onApply }: Props) {
  const [status, setStatus] = useState<LtabAutoStatus | null>(null);
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoAppliedFor = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ltab?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: LtabAutoStatus | null; relayConfigured: boolean };
      setStatus(data.status);
      setRelayConfigured(data.relayConfigured);
    } catch {
      /* tīkla kļūda: mēģinās nākamajā reizē */
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = isLtabAutoActive(status);
  // Ja relejs pazudis (nav ziņu 15 min), ļauj pieprasīt vēlreiz.
  const stale = active && Date.now() - Date.parse(status?.updatedAt ?? "") > 15 * 60_000;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [active, load]);

  const apply = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ltab/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ltab: valueRef.current }),
      });
      const data = (await res.json()) as { ok?: boolean; ltab?: LtabBlockState; status?: LtabAutoStatus | null; error?: string };
      if (!res.ok || !data.ltab) {
        setError("Neizdevās ievietot LTAB izziņu");
        return;
      }
      onApply(data.ltab);
      if (data.status) setStatus(data.status);
    } catch {
      setError("Neizdevās ievietot LTAB izziņu");
    } finally {
      setBusy(false);
    }
  }, [onApply, sessionId]);

  useEffect(() => {
    if (readOnly || disabled || !status) return;
    const key = `${status.jobId ?? ""}:${status.checkedAt ?? ""}`;
    if (autoAppliedFor.current === key) return;
    if (!ltabAutoCanApply(status, valueRef.current)) return;
    autoAppliedFor.current = key;
    void apply();
  }, [status, readOnly, disabled, apply]);

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ltab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, vin: orderVin, force: stale }),
      });
      const data = (await res.json()) as { status?: LtabAutoStatus };
      if (data.status) setStatus(data.status);
      if (!res.ok) setError("LTAB pieprasījums neizdevās");
    } catch {
      setError("LTAB pieprasījums neizdevās");
    } finally {
      setBusy(false);
    }
  };

  if (!status && !relayConfigured) return null;

  const done = status?.state === "claims" || status?.state === "no_claims";
  const canInsert = done && !status?.appliedAt && (status?.state === "no_claims" || Boolean(status?.certificate));
  const when = fmtWhen(status?.checkedAt ?? status?.updatedAt);

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">LTAB automātika</span>
        <span>{status?.message ?? "Nav pieprasīts"}</span>
        {status?.plate ? <span className="text-slate-500">· {status.plate}</span> : null}
        {when ? <span className="text-slate-500">· {when}</span> : null}
      </div>
      {status?.state === "awaiting_smartid" && status.verificationCode ? (
        <p className="mt-1 text-[15px] font-semibold tracking-wide text-slate-900">
          Kods {status.verificationCode}
          <span className="ml-2 text-[11px] font-normal text-slate-600">Apstiprini Smart-ID tikai, ja kods telefonā sakrīt</span>
        </p>
      ) : null}
      {status?.mismatch ? <p className="mt-1 text-amber-700">Pārbaudi: {status.mismatch}. Automātiski netika ievietots.</p> : null}
      {status?.pdf ? (
        <p className="mt-1 flex items-center gap-1.5">
          <a
            href={`/api/admin/ltab/pdf?sessionId=${encodeURIComponent(sessionId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 items-center rounded border border-slate-300 bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
            title={status.pdf.dropboxPath}
          >
            {LTAB_SOURCE_PDF_LABEL}
          </a>
          <span className="truncate text-slate-600">{status.pdf.name}</span>
        </p>
      ) : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {relayConfigured && (!active || stale) ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void request()}>
              {done || stale || status?.state === "error" ? "Pieprasīt vēlreiz" : "Pieprasīt no LTAB"}
            </button>
          ) : null}
          {canInsert ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void apply()}>
              {status?.state === "claims" ? "Ievietot LTAB izziņu" : "Ievietot \"Nav OCTA atlīdzības\""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
