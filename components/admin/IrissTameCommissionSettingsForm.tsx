"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IrissUnsavedChangesGuard } from "@/components/admin/IrissUnsavedChangesGuard";
import {
  IRISS_SETTINGS_CANCEL,
  IRISS_SETTINGS_COMMISSION_FIELDS,
  IRISS_SETTINGS_DIRTY,
  IRISS_SETTINGS_LOAD_ERROR,
  IRISS_SETTINGS_SAVE,
  IRISS_SETTINGS_SAVE_BUSY,
  IRISS_SETTINGS_SAVE_FAIL,
  IRISS_SETTINGS_SAVE_OK,
  irissSettingsCommissionDirty,
  irissSettingsDirtyDockTitle,
  irissSettingsDirtyFieldLabels,
} from "@/lib/iriss-iestatijumi-view";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import {
  defaultIrissTameCommissionSettings,
  parseIrissTameCommissionSettings,
  type IrissTameCommissionSettings,
} from "@/lib/iriss-tame-commission";

function numField(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function IrissTameCommissionSettingsForm() {
  const [saved, setSaved] = useState<IrissTameCommissionSettings>(() => defaultIrissTameCommissionSettings());
  const [draft, setDraft] = useState<IrissTameCommissionSettings>(() => defaultIrissTameCommissionSettings());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/admin/iriss-settings", { credentials: "include", cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (cancel || !body) return;
        const next = parseIrissTameCommissionSettings(body);
        setSaved(next);
        setDraft(next);
      })
      .catch(() => {
        if (!cancel) setMsg(IRISS_SETTINGS_LOAD_ERROR);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const dirty = irissSettingsCommissionDirty(saved, draft);
  const dirtyTitle = useMemo(
    () => irissSettingsDirtyDockTitle(irissSettingsDirtyFieldLabels(saved, draft)),
    [saved, draft],
  );

  const save = useCallback(async (): Promise<IrissOrderSaveResult> => {
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
        const error = typeof body?.error === "string" ? body.error : IRISS_SETTINGS_SAVE_FAIL;
        setMsg(error);
        return { ok: false, error };
      }
      const next = parseIrissTameCommissionSettings(body);
      setSaved(next);
      setDraft(next);
      setMsg(IRISS_SETTINGS_SAVE_OK);
      return { ok: true };
    } catch {
      setMsg(IRISS_SETTINGS_SAVE_FAIL);
      return { ok: false, error: IRISS_SETTINGS_SAVE_FAIL };
    } finally {
      setBusy(false);
    }
  }, [draft.variantANet, draft.variantBBaseNet, draft.variantBLoanPercent]);

  const showDock = dirty || msg === IRISS_SETTINGS_SAVE_FAIL;
  const dockStatus = busy ? IRISS_SETTINGS_SAVE_BUSY : msg === IRISS_SETTINGS_SAVE_FAIL ? IRISS_SETTINGS_SAVE_FAIL : dirtyTitle;

  return (
    <section className="mt-5 max-w-xl">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">
        Tāmes komisija
      </p>
      <div className="divide-y divide-[var(--hair)] overflow-hidden rounded-[22px] bg-[var(--s1)] shadow-[var(--sh)]">
        {IRISS_SETTINGS_COMMISSION_FIELDS.map((field) => (
          <label key={field.key} className="flex min-h-[52px] items-center justify-between gap-3 px-4">
            <span className="text-[15px] text-[var(--ink)]">{field.label}</span>
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--fill)] px-3">
              <input
                className="w-[4.75rem] bg-transparent text-right text-[15px] tabular-nums text-[var(--ink)] outline-none"
                type="number"
                min={0}
                max={field.key === "variantBLoanPercent" ? 100 : undefined}
                step={field.key === "variantBLoanPercent" ? "0.1" : "0.01"}
                value={draft[field.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: numField(e.target.value) }))}
              />
              <span className="whitespace-nowrap text-[13px] text-[var(--ink2)]">{field.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--ink2)]">
        Noklusējums 1190 EUR, 990 EUR un 3,5 %. Tāme un pasūtījuma noteikumi lieto šos skaitļus.
      </p>
      {msg === IRISS_SETTINGS_LOAD_ERROR ? (
        <p className="mt-2 px-1 text-[12px] font-medium text-[var(--warn)]" role="status">
          Neizdevās ielādēt saglabātās likmes. Rāda noklusējumu.
        </p>
      ) : msg && !showDock ? (
        <p className="mt-2 px-1 text-[12px] font-medium text-[var(--ink2)]" role="status">
          {msg}
        </p>
      ) : null}

      {showDock ? (
        <div className="iriss-iestatijumi-dock pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+18px)] z-[35] flex justify-center px-3 md:bottom-6">
          <div className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-full bg-[var(--gb)] px-2 py-1.5 shadow-[var(--gsh)] backdrop-blur-xl">
            <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-[var(--warn)]" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]" role="status">
              <span className="sm:hidden">{busy ? IRISS_SETTINGS_SAVE_BUSY : IRISS_SETTINGS_DIRTY}</span>
              <span className="hidden sm:inline">{dockStatus}</span>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(saved);
                setMsg(null);
              }}
              className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-40"
            >
              {IRISS_SETTINGS_CANCEL}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex h-9 items-center rounded-full bg-[var(--chip-active-bg)] px-3.5 text-[13px] font-semibold text-[var(--chip-active-fg)] disabled:opacity-40"
            >
              {busy ? IRISS_SETTINGS_SAVE_BUSY : IRISS_SETTINGS_SAVE}
            </button>
          </div>
        </div>
      ) : null}
      <IrissUnsavedChangesGuard dirty={dirty} onSave={() => save()} />
    </section>
  );
}
