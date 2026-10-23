"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import { ecsddAutoCanApply, ecsddSessionSummaryLv } from "@/lib/ecsdd-auto-logic";
import { isEcsddAutoActive, type EcsddAutoStatus, type EcsddRelaySession } from "@/lib/ecsdd-auto-types";

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
  value: CsddFormFields;
  disabled?: boolean;
  readOnly: boolean;
  /** Teksts iet caur to pašu RAW parseri, ko Nila ielīmējums. */
  onApplyRaw: (raw: string) => void;
};

/**
 * e.csdd automātika CSDD blokā: uzziņas stāvoklis, servera e.csdd sesija, Smart-ID kods, pogas.
 * Tukšā RAW laukā teksts tiek ievietots automātiski vienreiz; citādi ar pogu (aizvieto RAW).
 * Ja relejs nav pieslēgts un pieprasījumu nav bijis, neko nerāda.
 */
export function AdminEcsddAutoPanel({ sessionId, orderVin, value, disabled, readOnly, onApplyRaw }: Props) {
  const [status, setStatus] = useState<EcsddAutoStatus | null>(null);
  const [session, setSession] = useState<EcsddRelaySession | null>(null);
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoAppliedFor = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ecsdd?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: EcsddAutoStatus | null; relayConfigured: boolean; session: EcsddRelaySession | null };
      setStatus(data.status);
      setSession(data.session);
      setRelayConfigured(data.relayConfigured);
    } catch {
      /* tīkla kļūda: mēģinās nākamajā reizē */
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = isEcsddAutoActive(status);
  const sessionBusy = session?.state === "logging_in" || session?.state === "awaiting_smartid";
  // Ja relejs pazudis (nav ziņu 15 min), ļauj pieprasīt vēlreiz.
  const stale = active && Date.now() - Date.parse(status?.updatedAt ?? "") > 15 * 60_000;
  useEffect(() => {
    if (!active && !sessionBusy) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [active, sessionBusy, load]);

  const apply = useCallback(
    async (raw: string) => {
      onApplyRaw(raw);
      try {
        const res = await fetch("/api/admin/ecsdd/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as { status?: EcsddAutoStatus };
        if (data.status) setStatus(data.status);
      } catch {
        /* teksts jau blokā; atzīme tiks mēģināta nākamreiz */
      }
    },
    [onApplyRaw, sessionId],
  );

  useEffect(() => {
    if (readOnly || disabled || !status?.rawText) return;
    const key = `${status.jobId ?? ""}:${status.checkedAt ?? ""}`;
    if (autoAppliedFor.current === key) return;
    if (!ecsddAutoCanApply(status, valueRef.current)) return;
    autoAppliedFor.current = key;
    void apply(status.rawText);
  }, [status, readOnly, disabled, apply]);

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ecsdd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, vin: orderVin, force: stale }),
      });
      const data = (await res.json()) as { status?: EcsddAutoStatus };
      if (data.status) setStatus(data.status);
      if (!res.ok) setError("e.csdd pieprasījums neizdevās");
      void load();
    } catch {
      setError("e.csdd pieprasījums neizdevās");
    } finally {
      setBusy(false);
    }
  };

  const sessionAction = async (action: "login" | "release") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ecsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, minutes: 60 }),
      });
      const data = (await res.json()) as { session?: EcsddRelaySession | null };
      if (data.session) setSession(data.session);
      if (!res.ok) setError(action === "login" ? "Neizdevās sākt e.csdd pieslēgšanos" : "Neizdevās atbrīvot e.csdd");
    } catch {
      setError("e.csdd relejs nav sasniedzams");
    } finally {
      setBusy(false);
    }
  };

  if (!status && !relayConfigured) return null;

  const done = status?.state === "found" || status?.state === "not_found";
  const canReplace = status?.state === "found" && Boolean(status.rawText) && !status.appliedAt && Boolean(value.rawUnprocessedData.trim());
  const when = fmtWhen(status?.checkedAt ?? status?.updatedAt);
  const code = status?.state === "awaiting_smartid" ? status.verificationCode : session?.state === "awaiting_smartid" ? session.verificationCode : undefined;
  const loggedIn = session?.state === "active";

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">e.csdd automātika</span>
        <span>{status?.message ?? "Nav pieprasīts"}</span>
        {status?.query ? <span className="text-slate-500">· {status.query}</span> : null}
        {when ? <span className="text-slate-500">· {when}</span> : null}
      </div>
      {relayConfigured ? <p className="mt-0.5 text-slate-500">{ecsddSessionSummaryLv(session, fmtTime)}</p> : null}
      {code ? (
        <p className="mt-1 text-[15px] font-semibold tracking-wide text-slate-900">
          Kods {code}
          <span className="ml-2 text-[11px] font-normal text-slate-600">Apstiprini Smart-ID tikai, ja kods telefonā sakrīt</span>
        </p>
      ) : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {relayConfigured && (!active || stale) ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void request()}>
              {done || stale || status?.state === "error" ? "Pieprasīt vēlreiz" : "Ņemt no e.csdd"}
            </button>
          ) : null}
          {canReplace && status?.rawText ? (
            <button
              type="button"
              className={btn}
              disabled={disabled || busy}
              onClick={() => {
                if (window.confirm("Aizvietot CSDD RAW tekstu ar e.csdd datiem?")) void apply(status.rawText ?? "");
              }}
            >
              Ievietot e.csdd datus
            </button>
          ) : null}
          {relayConfigured && session && !loggedIn && !sessionBusy ? (
            <button
              type="button"
              className={btn}
              disabled={disabled || busy}
              title="Kad apstiprināsi Smart-ID, tava e.csdd sesija citā pārlūkā tiks pārtraukta"
              onClick={() => void sessionAction("login")}
            >
              Pieslēgt e.csdd
            </button>
          ) : null}
          {relayConfigured && loggedIn ? (
            <button
              type="button"
              className={btn}
              disabled={disabled || busy}
              title="Serveris iziet un 60 min pats nepiesakās - vari strādāt e.csdd savā pārlūkā"
              onClick={() => void sessionAction("release")}
            >
              Atbrīvot e.csdd
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
