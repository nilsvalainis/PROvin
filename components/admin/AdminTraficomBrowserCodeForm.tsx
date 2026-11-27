"use client";

import { useEffect, useState } from "react";

import { normalizeTraficomBrowserCode, traficomBrowserCodeSecondsLeft } from "@/lib/traficom-fi-auto-logic";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function fmtCountdown(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type Source = { codeExpiresAt?: string; codeExpired?: boolean; browserCodeRejected?: boolean };

/**
 * eParaksts "confirm this browser": kods no Nila eParaksts lietotnes -> Traficom relejs (ievada un spiež "Confirm").
 * Termiņam beidzoties - «Pieprasīt jaunu kodu» (relejs pārlādē lapu; SMS nekad).
 */
export function AdminTraficomBrowserCodeForm({
  source,
  disabled,
  readOnly,
  onSent,
}: {
  source: Source;
  disabled?: boolean;
  readOnly?: boolean;
  /** Pēc nosūtīšanas: pārlādēt stāvokli. */
  onSent?: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = traficomBrowserCodeSecondsLeft(source, nowMs);
  const expired = secondsLeft === 0;
  const valid = normalizeTraficomBrowserCode(code);

  const send = async (renew: boolean) => {
    if (!renew && !valid) {
      setError("Kods: 4-8 burti vai cipari");
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/admin/traficom/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renew ? { action: "browser_code_renew" } : { action: "browser_code", code: valid }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setCode("");
        setNote(renew ? "Lapa pārlādēta - lietotnē būs jauns kods" : "Kods nosūtīts");
      } else if (data.error === "invalid_code") setError("Kods: 4-8 burti vai cipari");
      else if (data.error === "not_waiting") setError("Relejs kodu vairs negaida");
      else setError("Traficom relejs nav sasniedzams");
      onSent?.();
    } catch {
      setError("Traficom relejs nav sasniedzams");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 text-[11px] text-slate-700">
      <p className="text-[13px] font-semibold text-slate-900">
        {expired ? "Koda termiņš beidzies" : source.browserCodeRejected ? "Kods netika pieņemts - ievadi jauno" : "Ievadi kodu no eParaksts lietotnes"}
        {!expired && secondsLeft !== null ? <span className="ml-2 text-[11px] font-normal text-slate-600">derīgs {fmtCountdown(secondsLeft)}</span> : null}
      </p>
      {!readOnly ? (
        <form
          className="mt-1 flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(false);
          }}
        >
          <input
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Kods no eParaksts lietotnes"
            placeholder="Kods no eParaksts lietotnes"
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={disabled || busy}
            className="h-7 w-48 rounded-md border border-slate-300 bg-white px-2 text-[13px] tracking-widest text-slate-900"
          />
          <button type="submit" className={btn} disabled={disabled || busy || !valid}>
            Apstiprināt
          </button>
          {expired ? (
            <button type="button" className={btn} disabled={disabled || busy} onClick={() => void send(true)}>
              Pieprasīt jaunu kodu
            </button>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="mt-0.5 text-red-700">{error}</p> : null}
      {note ? <p className="mt-0.5 text-slate-600">{note}</p> : null}
    </div>
  );
}
