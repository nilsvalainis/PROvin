"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminVinHandoff } from "@/components/admin/AdminVinHandoffContext";
import { AdminVendorArchivePhotosButton } from "@/components/admin/AdminVendorArchivePhotosButton";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { autodnaAutoCanApply, autodnaVinPageUrl, isLowCredits } from "@/lib/autodna-auto-logic";
import {
  isAutodnaAutoActive,
  type AutodnaAutoStatus,
  type AutodnaBalance,
  type AutodnaSessionState,
} from "@/lib/autodna-auto-types";
import { AUTODNA_PURCHASE_CONFIRM_LV } from "@/lib/autodna-background-purchase";
import { AUTODNA_PRECHECK_BLOCK_LV, autodnaPrecheckCountsLabel, type AutodnaPrecheckGuard } from "@/lib/autodna-purchase-guard";
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
 * AutoDNA bloks: "Pirkt AutoDNA (fonā)" (apstiprinājuma dialogs, 1 kredīts), atlikums, stāvoklis, "Ielādēt nopirkto",
 * "Pieslēgt AutoDNA". Saņemto atskaiti vienreiz automātiski ievieto blokā (sapludina, ar roku labotu nepārraksta).
 * Ja relejs nav pieslēgts un pieprasījumu nav bijis, neko nerāda.
 */
export function AdminAutodnaAutoPanel({ sessionId, disabled, readOnly, getSourceBlocks, applyPatchedBlocks }: Props) {
  const vin = normalizeVin(useAdminVinHandoff()?.vin ?? "");
  const [status, setStatus] = useState<AutodnaAutoStatus | null>(null);
  const [balance, setBalance] = useState<AutodnaBalance | null>(null);
  const [session, setSession] = useState<AutodnaSessionState>("unknown");
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [purchaseLive, setPurchaseLive] = useState(false);
  const [precheck, setPrecheck] = useState<AutodnaPrecheckGuard | null>(null);
  const [precheckBusy, setPrecheckBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const appliedFor = useRef("");

  const load = useCallback(
    async (refresh = false, livePrecheck = false) => {
      try {
        const q = new URLSearchParams({ sessionId });
        if (refresh) q.set("refresh", "1");
        if (isValidVin(vin)) q.set("vin", vin);
        if (livePrecheck && isValidVin(vin)) q.set("precheck", "live");
        const res = await fetch(`/api/admin/autodna/fona?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: AutodnaAutoStatus | null;
          balance: AutodnaBalance | null;
          session: AutodnaSessionState;
          relayConfigured: boolean;
          purchaseLive?: boolean;
          precheck?: AutodnaPrecheckGuard | null;
        };
        setStatus(data.status);
        setBalance(data.balance);
        setSession(data.session);
        setRelayConfigured(data.relayConfigured);
        setPurchaseLive(data.purchaseLive === true);
        if (data.precheck !== undefined) setPrecheck(data.precheck ?? null);
      } catch {
        /* nākamajā reizē */
      }
    },
    [sessionId, vin],
  );

  useEffect(() => {
    void load(false, true);
  }, [load]);

  const recheck = async () => {
    setPrecheckBusy(true);
    await load(false, true);
    setPrecheckBusy(false);
  };

  const active = isAutodnaAutoActive(status);
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
      const res = await fetch("/api/admin/autodna/fona/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sourceBlocks: getSourceBlocks() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
        changedKeys?: CopilotSourceKey[];
        status?: AutodnaAutoStatus | null;
      };
      if (!res.ok || !data.ok || !data.patchedSourceBlocks) {
        setError("Neizdevās ievietot AutoDNA atskaiti - augšupielādē PDF ar roku");
        return;
      }
      applyPatchedBlocks(data.patchedSourceBlocks, data.changedKeys ?? []);
      if (data.status) setStatus(data.status);
    } catch {
      setError("Neizdevās ievietot AutoDNA atskaiti");
    } finally {
      setBusy(false);
    }
  }, [applyPatchedBlocks, getSourceBlocks, sessionId]);

  useEffect(() => {
    if (readOnly || disabled || !autodnaAutoCanApply(status)) return;
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
      const res = await fetch("/api/admin/autodna/fona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        status?: AutodnaAutoStatus;
        session?: AutodnaSessionState;
        ok?: boolean;
        error?: string;
        message?: string;
        precheck?: AutodnaPrecheckGuard;
      };
      if (data.status) setStatus(data.status);
      if (data.session) setSession(data.session);
      if (data.precheck) setPrecheck(data.precheck);
      if (!res.ok) setError(res.status === 409 && data.message ? data.message : failMsg);
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
    if (!isValidVin(vin) || inFlight.current || precheck?.allowed !== true) return;
    if (!window.confirm(AUTODNA_PURCHASE_CONFIRM_LV)) return;
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    await post({ action: "purchase", sessionId, vin, confirm: true, requestId }, "AutoDNA pirkumu neizdevās sākt");
  };

  const fetchExisting = () => post({ action: "report", sessionId, vin }, "Neizdevās pieprasīt nopirkto atskaiti");

  const connect = async () => {
    const data = await post({ action: "login" }, "Pieslēgšana neizdevās");
    if (data?.ok) void load(true);
    else if (data) setError("AutoDNA pieslēgšana neizdevās");
  };

  if (!status && !relayConfigured) return null;

  const credits = balance?.credits;
  const low = isLowCredits(credits);
  const ready = status?.state === "ready";
  const when = fmtWhen(status?.readyAt ?? status?.updatedAt);
  const canBuy = relayConfigured && purchaseLive && isValidVin(vin) && (!active || stale) && !(ready && status?.vin === vin);
  const turnstile =
    status?.state === "error" && (status.code === "turnstile" || status.code === "precheck_unavailable") && isValidVin(status.vin ?? vin);
  // Nila likums 25.11: pirkt drīkst tikai, ja priekšpārbaude rāda >0 arhīva foto vai vēstures ierakstu.
  const precheckOk = precheck?.allowed === true;
  const precheckBlock = precheck && !precheck.allowed ? AUTODNA_PRECHECK_BLOCK_LV[precheck.code ?? "precheck_unavailable"] : "Priekšpārbaude nav pieejama";
  const precheckUnavailable = !precheck || precheck.code === "precheck_unavailable";

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[11px] text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">AutoDNA fonā</span>
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
      {status?.pdf ? (
        <p className="mt-1 flex items-center gap-1.5">
          <a
            href={`/api/admin/autodna/fona/pdf?sessionId=${encodeURIComponent(sessionId)}`}
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
      {canBuy ? (
        <p className="mt-1">
          {precheck && (precheck.photos != null || precheck.history != null) ? (
            <span className={precheckOk ? "text-slate-600" : "text-red-600"}>{autodnaPrecheckCountsLabel(precheck)}</span>
          ) : null}
          {!precheckOk ? <span className="text-red-600">{precheck && (precheck.photos != null || precheck.history != null) ? " · " : ""}{precheckBlock}</span> : null}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {turnstile || (canBuy && precheckUnavailable) ? (
            <a className={btn} href={autodnaVinPageUrl(status?.vin ?? vin)} target="_blank" rel="noopener noreferrer">
              Atvērt AutoDNA
            </a>
          ) : null}
          {canBuy ? (
            <button type="button" className={btn} disabled={disabled || busy || !precheckOk} onClick={() => void buy()}>
              Pirkt AutoDNA (fonā)
            </button>
          ) : null}
          {canBuy && precheckUnavailable ? (
            <button type="button" className={btn} disabled={precheckBusy} onClick={() => void recheck()}>
              Pārbaudīt vēlreiz
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
          {ready && status?.pdf && status.appliedAt ? (
            <AdminVendorArchivePhotosButton
              sessionId={sessionId}
              source="autodna"
              disabled={disabled || busy}
              getSourceBlocks={getSourceBlocks}
              applyPatchedBlocks={applyPatchedBlocks}
            />
          ) : null}
          {relayConfigured && session !== "active" ? (
            <button type="button" className={btn} disabled={busy} onClick={() => void connect()}>
              Pieslēgt AutoDNA
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
