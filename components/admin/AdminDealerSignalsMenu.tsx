"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEALER_SIGNAL_ADMIN_KIND_LV,
  DEALER_SIGNAL_DEFAULT_TEXTS,
  DEALER_SIGNALS_AUDIT_LINK_LABEL,
  DEALER_SIGNALS_SECTION_TITLE,
  dealerSignalsPdfRows,
  dealerSignalsSectionOn,
  isDealerSignalTextAllowed,
  regenerateDealerSignals,
  type DealerSignalKind,
  type DealerSignalsState,
} from "@/lib/dealer-signals";

/**
 * Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11): slēdzis «Nav PDF / Ir PDF» (noklusējums izslēgts),
 * katram atrastajam signālam ķeksis + labojams teksts, «Pārģenerēt no datiem» un priekšskatījums.
 * Saglabā workspace laukā `dealerSignals`.
 */

/** Ko rādīt redaktorā: saglabātais stāvoklis vai (ja vēl nav) atrastie signāli - bez saglabāšanas. */
export function dealerSignalsEditorView(
  stored: DealerSignalsState | null | undefined,
  detect: () => DealerSignalKind[],
): DealerSignalsState {
  return stored ?? regenerateDealerSignals(undefined, detect());
}

export function DealerSignalsEditor({
  state,
  onChange,
  onRegenerate,
  size = "desktop",
}: {
  state: DealerSignalsState;
  onChange: (next: DealerSignalsState) => void;
  onRegenerate: () => void;
  size?: "desktop" | "touch";
}) {
  const touch = size === "touch";
  const on = state.enabled === true;
  const rows = dealerSignalsPdfRows({ ...state, enabled: true }, "lv");
  const setItem = (kind: DealerSignalKind, patch: { checked?: boolean; text?: string }) => {
    onChange({
      ...state,
      items: state.items.map((it) => {
        if (it.kind !== kind) return it;
        const next = { ...it, ...patch };
        if (patch.text !== undefined) {
          const t = patch.text;
          if (!t.trim() || t.trim() === DEALER_SIGNAL_DEFAULT_TEXTS[kind].lv) delete next.text;
        }
        return next;
      }),
    });
  };
  const btn = touch
    ? "min-h-11 rounded-lg border border-[var(--admin-border-subtle)] px-3 text-[15px] font-semibold text-[var(--color-apple-text)]"
    : "h-7 rounded-lg border border-[var(--admin-border-subtle)] px-2.5 text-[11px] font-semibold text-[var(--color-apple-text)] hover:bg-black/[0.04]";
  return (
    <div className="flex flex-col gap-2 px-3" data-dealer-signals-editor>
      <div className="flex items-center justify-between gap-2">
        <span className={`${touch ? "text-[15px]" : "text-[12px]"} font-semibold text-[var(--color-apple-text)]`}>
          {DEALER_SIGNALS_SECTION_TITLE.lv}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          data-dealer-signals-switch
          onClick={() => onChange({ ...state, enabled: !on })}
          className={`inline-flex shrink-0 items-center gap-2 ${touch ? "min-h-11 text-[15px]" : "h-7 text-[11px]"} font-semibold text-[var(--color-apple-text)]`}
        >
          <span
            aria-hidden="true"
            className={`relative inline-block h-[18px] w-[32px] rounded-full transition-colors ${on ? "bg-[#047857]" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform ${on ? "translate-x-[16px]" : "translate-x-[2px]"}`}
            />
          </span>
          {on ? "Ir PDF" : "Nav PDF"}
        </button>
      </div>
      {state.items.length === 0 ? (
        <p className={`${touch ? "text-[15px]" : "text-[12px]"} font-medium text-[#b42318]`}>Nav signālu</p>
      ) : (
        <div className="flex flex-col gap-1.5" role="group" aria-label="Signāli">
          {state.items.map((it) => {
            const text = it.text ?? DEALER_SIGNAL_DEFAULT_TEXTS[it.kind].lv;
            const bad = !isDealerSignalTextAllowed(text);
            return (
              <div
                key={it.kind}
                data-dealer-signal-row={it.kind}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-[var(--admin-border-subtle)] p-2 ${it.checked ? "" : "opacity-55"}`}
              >
                <input
                  type="checkbox"
                  aria-label={DEALER_SIGNAL_ADMIN_KIND_LV[it.kind]}
                  className={`${touch ? "mt-3 h-5 w-5" : "mt-1.5 h-4 w-4"} rounded border-slate-300 text-[var(--color-provin-accent)]`}
                  checked={it.checked}
                  onChange={(e) => setItem(it.kind, { checked: e.target.checked })}
                />
                <textarea
                  rows={1}
                  value={text}
                  aria-invalid={bad}
                  onChange={(e) => setItem(it.kind, { text: e.target.value })}
                  className={`w-full resize-y rounded-md border bg-transparent px-2 py-1 ${touch ? "text-[16px]" : "text-[12px]"} leading-snug text-[var(--color-apple-text)] ${bad ? "border-[#b42318]" : "border-[var(--admin-border-subtle)]"}`}
                />
                <span className="mt-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-muted)]">
                  {DEALER_SIGNAL_ADMIN_KIND_LV[it.kind]}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} data-dealer-signals-regenerate onClick={onRegenerate}>
          Pārģenerēt no datiem
        </button>
      </div>
      <div
        data-dealer-signals-preview
        className="rounded-lg border border-[var(--admin-border-subtle)] bg-white p-3 text-[11px] leading-snug text-[#0f172a]"
      >
        {!on || rows.length === 0 ? (
          <p className="text-[12px] font-medium text-[var(--color-provin-muted)]">Sadaļa nav PDF</p>
        ) : (
          <>
            <p className="mb-2 border-b border-[#E9EDF3] pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]">
              {DEALER_SIGNALS_SECTION_TITLE.lv}
            </p>
            <table className="w-full border-collapse">
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.kind}
                    className={r.alert ? "bg-[#FFF1F2] text-[#B91C1C]" : ""}
                    data-dealer-signal-preview-row={r.kind}
                  >
                    <td className="w-[38%] border-b border-[#E0E0E0] px-2 py-1.5 align-top font-bold">{r.title}</td>
                    <td className={`border-b border-[#E0E0E0] px-2 py-1.5 align-top ${r.alert ? "font-bold" : "text-[#475569]"}`}>
                      {r.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right font-bold text-[#0061D2]">{DEALER_SIGNALS_AUDIT_LINK_LABEL.lv}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminDealerSignalsMenu({
  state,
  detect,
  onChange,
  toneClass,
  disabled = false,
}: {
  /** Saglabātais stāvoklis (`undefined` - vēl nav veidots). */
  state: DealerSignalsState | null | undefined;
  /** Aprēķina tikai atverot / pārģenerējot (ne katrā renderā). */
  detect: () => DealerSignalKind[];
  onChange: (next: DealerSignalsState) => void;
  toneClass: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const detectRef = useRef(detect);
  detectRef.current = detect;
  const view = useMemo(
    () => (open ? dealerSignalsEditorView(state, () => detectRef.current()) : null),
    [open, state],
  );
  const active = dealerSignalsSectionOn(state);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        data-dealer-signals-button
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold tracking-tight disabled:opacity-40 ${toneClass}`}
      >
        Signāli
        {active ? <span aria-label="Ir PDF" className="h-2 w-2 rounded-full bg-[#047857]" /> : null}
      </button>
      {open && view ? (
        <div
          role="dialog"
          aria-label={DEALER_SIGNALS_SECTION_TITLE.lv}
          className="absolute bottom-[calc(100%+8px)] right-0 z-50 max-h-[70vh] w-[380px] overflow-y-auto rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] py-3 shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
        >
          <DealerSignalsEditor
            state={view}
            onChange={onChange}
            onRegenerate={() => onChange(regenerateDealerSignals(view, detectRef.current(), { keepEdits: false }))}
          />
          <div className="mt-2 flex justify-end border-t border-[var(--admin-border-subtle)] px-3 pt-2">
            <button
              type="button"
              className="h-7 rounded-lg bg-[#1d1d1f] px-3 text-[11px] font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Gatavs
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
