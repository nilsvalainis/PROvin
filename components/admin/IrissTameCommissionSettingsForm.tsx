"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultIrissTameCommissionSettings,
  parseIrissTameCommissionSettings,
  type IrissTameCommissionSettings,
} from "@/lib/iriss-tame-commission";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

function numField(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function IrissTameCommissionSettingsForm() {
  const [draft, setDraft] = useState<IrissTameCommissionSettings>(() => defaultIrissTameCommissionSettings());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/admin/iriss-settings", { credentials: "include", cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (cancel || !body) return;
        setDraft(parseIrissTameCommissionSettings(body));
      })
      .catch(() => {
        if (!cancel) setMsg("Neizdevās ielādēt saglabātās likmes. Rāda noklusējumu.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantANet: numField(String(draft.variantANet)),
          variantBBaseNet: numField(String(draft.variantBBaseNet)),
          variantBLoanPercent: numField(String(draft.variantBLoanPercent)),
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMsg(typeof body?.error === "string" ? body.error : "Saglabāšana neizdevās.");
        return;
      }
      setDraft(parseIrissTameCommissionSettings(body));
      setMsg("Saglabāts.");
    } catch {
      setMsg("Saglabāšana neizdevās.");
    } finally {
      setBusy(false);
    }
  }, [draft.variantANet, draft.variantBBaseNet, draft.variantBLoanPercent]);

  return (
    <section className="mt-4 max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Tāmes komisija</h2>
      <p className="mt-1 text-[13px] leading-snug text-[var(--color-provin-muted)]">
        A variants, B variants bāze un procenti no atlikuma. Noklusējums ir 1190 EUR, 990 EUR un 3,5 %. Tāme un
        pasūtījuma noteikumi lieto šos skaitļus.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">A variants, EUR neto</span>
          <input
            className={fieldClass}
            type="number"
            min={0}
            step="0.01"
            value={draft.variantANet}
            onChange={(e) => setDraft((d) => ({ ...d, variantANet: numField(e.target.value) }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">B variants bāze, EUR neto</span>
          <input
            className={fieldClass}
            type="number"
            min={0}
            step="0.01"
            value={draft.variantBBaseNet}
            onChange={(e) => setDraft((d) => ({ ...d, variantBBaseNet: numField(e.target.value) }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">
            B variants, % no atlikuma
          </span>
          <input
            className={fieldClass}
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={draft.variantBLoanPercent}
            onChange={(e) => setDraft((d) => ({ ...d, variantBLoanPercent: numField(e.target.value) }))}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-white shadow-sm disabled:opacity-40"
        >
          {busy ? "Saglabā..." : "Saglabāt"}
        </button>
        {msg ? (
          <p className="text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
