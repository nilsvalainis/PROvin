"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminVinHandoff } from "@/components/admin/AdminVinHandoffContext";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { carverticalAutoCanApply, isLowCredits } from "@/lib/carvertical-auto-logic";
import {
  isCarverticalAutoActive,
  type CarverticalAutoStatus,
  type CarverticalBalance,
  type CarverticalSessionState,
} from "@/lib/carvertical-auto-types";
import { CARVERTICAL_PURCHASE_CONFIRM_LV } from "@/lib/carvertical-purchase";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

function creditsLabel(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? `${n} kredīts` : `${n} kredīti`;
}

type Props = {
  sessionId: string;
  disabled?: boolean;
  readOnly?: boolean;
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (patched: Partial<WorkspaceSourceBlocks>, changedKeys: CopilotSourceKey[]) => void;
};

/**
 * CarVertical bloks: "Pirkt CarVertical (fonā)" (apstiprinājuma dialogs, 1 kredīts), atlikums, stāvoklis,
 * pieteikšanās kods. Saņemto atskaiti vienreiz automātiski ievieto blokā (sapludina, ar roku labotu nepārraksta).
 * Ja relejs nav pieslēgts un pieprasījumu nav bijis, neko nerāda.
 */
export function AdminCarVerticalAutoPanel({ sessionId, disabled, readOnly, getSourceBlocks, applyPatchedBlocks }: Props) {
  const vin = normalizeVin(useAdminVinHandoff()?.vin ?? "");
  const [status, setStatus] = useState<CarverticalAutoStatus | null>(null);
  const [balance, setBalance] = useState<CarverticalBalance | null>(null);
  const [session, setSession] = useState<CarverticalSessionState>("unknown");
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const inFlight = useRef(false);
  const appliedFor = useRef("");

  const load = useCallback(
    async (refresh = false) => {
      try {
        const res = await fetch(`/api/admin/carvertical?sessionId=${encodeURIComponent(sessionId)}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: CarverticalAutoStatus | null;
          balance: CarverticalBalance | null;
          session: CarverticalSessionState;
          relayConfigured: boolean;
        };
        setStatus(data.status);
        setBalance(data.balance);
        setSession(data.session);
        setRelayConfigured(data.relayConfigured);
      } catch {
        /* nākamajā reizē */
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const active = isCarverticalAutoActive(status);
  const stale = active && Date.now() - Date.parse(status?.updatedAt ?? "") > 20 * 60_000;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [active, load]);

  const apply = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/carvertical/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sourceBlocks: getSourceBlocks() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
        changedKeys?: CopilotSourceKey[];
        status?: CarverticalAutoStatus | null;
      };
      if (!res.ok || !data.ok || !data.patchedSourceBlocks) {
        setError("Neizdevās ievietot CarVertical atskaiti - augšupielādē PDF ar roku");
        return;
      }
      applyPatchedBlocks(data.patchedSourceBlocks, data.changedKeys ?? []);
      if (data.status) setStatus(data.status);
    } catch {
      setError("Neizdevās ievietot CarVertical atskaiti");
    } finally {
      setBusy(false);
    }
  }, [applyPatchedBlocks, getSourceBlocks, sessionId]);

  useEffect(() => {
    if (readOnly || disabled || !carverticalAutoCanApply(status)) return;
    const key = `${status?.jobId ?? ""}:${status?.readyAt ?? ""}`;
    if (appliedFor.current === key) return;
    appliedFor.current = key;
    void apply();
  }, [status, readOnly, disabled, apply]);

  const post = async (body: Record<string, unknown>, failMsg: string) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/carvertical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { status?: CarverticalAutoStatus; session?: CarverticalSessionState; ok?: boolean; error?: string };
      if (data.status) setStatus(data.status);
      if (data.session) setSession(data.session);
      if (!res.ok) setError(failMsg);
      return data;
    } catch {
      setError(failMsg);
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const buy = async () => {
    if (!isValidVin(vin) || inFlight.current) return;
    if (!window.confirm(CARVERTICAL_PURCHASE_CONFIRM_LV)) return;
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    await post({ action: "purchase", sessionId, vin, confirm: true, requestId }, "CarVertical pirkumu neizdevās sākt");
  };

  const fetchExisting = () => post({ action: "report", sessionId, vin }, "Neizdevās pieprasīt nopirkto atskaiti");

  const sendCode = async () => {
    const data = await post({ action: "code", code }, "Kods netika pieņemts");
    if (data?.ok) {
      setCode("");
      void load(true);
    } else if (data) setError("Kods netika pieņemts - pārbaudi e-pastu (kods derīgs 15 min)");
  };

  if (!status && !relayConfigured) return null;

  const credits = balance?.credits;
  const low = isLowCredits(credits);
  const awaitingCode = session === "awaiting_code" || status?.state === "awaiting_login";
  const ready = status?.state === "ready";
  const when = fmtWhen(status?.readyAt ?? status?.updatedAt);
  const canBuy = relayConfigured && isValidVin(vin) && (!active || stale) && !(ready && status?.vin === vin);

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">CarVertical fonā</span>
        {typeof credits === "number" ? (
          <span className={low ? "font-semibold text-red-600" : "text-slate-600"} title={balance?.checkedAt ? `Pārbaudīts ${fmtWhen(balance.checkedAt)}` : undefined}>
            Atlikums: {creditsLabel(credits)}
          </span>
        ) : relayConfigured ? (
          <span className="text-red-600">Atlikums: nav datu</span>
        ) : null}
        {status ? <span>· {status.message ?? ""}</span> : null}
        {when && status ? <span className="text-slate-500">· {when}</span> : null}
      </div>
      {awaitingCode && !readOnly ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span>Kods no CarVertical e-pasta:</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            inputMode="text"
            autoComplete="one-time-code"
            className="h-7 w-24 rounded-md border border-slate-300 px-2 font-mono text-[12px] tracking-widest"
            aria-label="CarVertical pieteikšanās kods"
          />
          <button type="button" className={btn} disabled={busy || code.trim().length < 6} onClick={() => void sendCode()}>
            Ievadīt kodu
          </button>
        </div>
      ) : null}
      {status?.pdf ? (
        <p className="mt-1 flex items-center gap-1.5">
          <a
            href={`/api/admin/carvertical/pdf?sessionId=${encodeURIComponent(sessionId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 items-center rounded border border-slate-300 bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
            title={status.pdf.dropboxPath ?? status.pdf.name}
          >
            PDF
          </a>
          <span className="truncate text-slate-600">{status.pdf.name}</span>
          {status.appliedAt ? <span className="text-slate-500">· ievietots blokā</span> : null}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {canBuy ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void buy()}>
              Pirkt CarVertical (fonā)
            </button>
          ) : null}
          {relayConfigured && isValidVin(vin) && (!active || stale) ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void fetchExisting()}>
              Ielādēt nopirkto
            </button>
          ) : null}
          {ready && status?.pdf && status.appliedAt ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void apply()}>
              Ievietot vēlreiz
            </button>
          ) : null}
          {relayConfigured && session !== "active" && !awaitingCode ? (
            <button type="button" className={btn} disabled={busy} onClick={() => void post({ action: "login" }, "Pieslēgšana neizdevās")}>
              Pieslēgt CarVertical
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
