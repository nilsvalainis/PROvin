"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  addManualDealerSignal,
  DEALER_SIGNAL_ADMIN_KIND_LV,
  DEALER_SIGNAL_DEFAULT_TEXTS,
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNAL_TITLES,
  DEALER_SIGNAL_TONE_LABEL_LV,
  DEALER_SIGNAL_TONES,
  DEALER_SIGNALS_AUDIT_LINK_LABEL,
  DEALER_SIGNALS_SECTION_TITLE,
  dealerSignalsMissingTranslations,
  dealerSignalsPdfRows,
  dealerSignalsSectionOn,
  isDealerSignalAlert,
  isDealerSignalTextAllowed,
  regenerateDealerSignals,
  dealerSignalTone,
  removeDealerSignal,
  setDealerSignalTone,
  tidyDealerSignalText,
  withDealerSignalTranslations,
  type DealerSignalKind,
  type DealerSignalsState,
  type DealerSignalTone,
} from "@/lib/dealer-signals";

/** Admin etiķetes krāsa pēc signāla krāsas. */
const TONE_LABEL_CLASS: Record<DealerSignalTone, string> = {
  red: "text-[#b42318]",
  orange: "text-[#B45309]",
  neutral: "text-[var(--color-provin-muted)]",
};

/** Krāsu apļi. */
const TONE_DOT_CLASS: Record<DealerSignalTone, string> = {
  red: "bg-[#DC2626]",
  orange: "bg-[#F59E0B]",
  neutral: "bg-white border border-slate-400",
};

/** Priekšskata rinda (kā PDF). */
const TONE_PREVIEW_ROW: Record<DealerSignalTone, string> = {
  red: "bg-[#FFF1F2] text-[#B91C1C]",
  orange: "bg-[#FFF7ED] text-[#B45309]",
  neutral: "",
};

/** Krāsas izvēle: 3 apļi (Sarkans / Oranžs / Parasts), strādā ar tap. */
export function DealerSignalTonePicker({
  kind,
  tone,
  onPick,
  touch = false,
}: {
  kind: DealerSignalKind;
  tone: DealerSignalTone;
  onPick: (tone: DealerSignalTone) => void;
  touch?: boolean;
}) {
  return (
    <span role="radiogroup" aria-label="Krāsa" data-dealer-signal-tone-picker={kind} className="flex items-center gap-0.5">
      {DEALER_SIGNAL_TONES.map((t) => {
        const sel = t === tone;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={DEALER_SIGNAL_TONE_LABEL_LV[t]}
            title={DEALER_SIGNAL_TONE_LABEL_LV[t]}
            data-dealer-signal-tone={t}
            onClick={() => onPick(t)}
            className={`${touch ? "h-11 w-11" : "h-6 w-6"} inline-flex items-center justify-center rounded-full`}
          >
            <span
              aria-hidden="true"
              className={`${touch ? "h-6 w-6" : "h-3.5 w-3.5"} rounded-full ${TONE_DOT_CLASS[t]} ${sel ? "ring-2 ring-[#1d1d1f] ring-offset-1" : "opacity-60"}`}
            />
          </button>
        );
      })}
    </span>
  );
}

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

type TranslateFn = (
  lang: Exclude<ClientReportLang, "lv">,
  texts: Partial<Record<DealerSignalKind, string>>,
) => Promise<Partial<Record<DealerSignalKind, string>>>;

/** Tas pats tulkošanas ceļš kā PDF komentāriem (`/api/admin/report-translate`). */
export function dealerSignalsReportTranslate(sessionId: string): TranslateFn {
  return async (lang, texts) => {
    const body: Record<string, string> = {};
    for (const kind of DEALER_SIGNAL_KINDS) {
      const t = texts[kind];
      if (t) body[`dealerSignal.${kind}`] = t;
    }
    const res = await fetch("/api/admin/report-translate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, lang, texts: body }),
    });
    if (!res.ok) throw new Error(`translate_${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { texts?: Record<string, string> };
    const out: Partial<Record<DealerSignalKind, string>> = {};
    for (const kind of DEALER_SIGNAL_KINDS) {
      const t = data.texts?.[`dealerSignal.${kind}`];
      if (typeof t === "string" && t.trim()) out[kind] = t;
    }
    return out;
  };
}

/**
 * Klienta valodas priekšskats (Nils 27.11): labotā LV teksta tulkojumu pieprasa pēc pauzes un saglabā
 * stāvoklī (`tr`) - PDF lieto tieši to, ko admins redzēja.
 */
function useDealerSignalsTranslation(
  state: DealerSignalsState,
  lang: ClientReportLang,
  onChange: (next: DealerSignalsState) => void,
  translate: TranslateFn | null,
): "idle" | "busy" | "error" {
  const [phase, setPhase] = useState<"idle" | "busy" | "error">("idle");
  const stateRef = useRef(state);
  stateRef.current = state;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const missing = lang === "lv" || !translate ? {} : dealerSignalsMissingTranslations(state, lang);
  const key = JSON.stringify(missing);
  useEffect(() => {
    if (lang === "lv" || !translate || key === "{}") {
      setPhase("idle");
      return;
    }
    let cancelled = false;
    const texts = JSON.parse(key) as Partial<Record<DealerSignalKind, string>>;
    const t = window.setTimeout(() => {
      setPhase("busy");
      translate(lang, texts)
        .then((out) => {
          if (cancelled) return;
          const pairs: Partial<Record<DealerSignalKind, { src: string; text: string }>> = {};
          for (const kind of DEALER_SIGNAL_KINDS) {
            const src = texts[kind];
            const text = out[kind];
            if (src && text) pairs[kind] = { src, text: tidyDealerSignalText(text) };
          }
          const next = withDealerSignalTranslations(stateRef.current, lang, pairs);
          if (next !== stateRef.current) onChangeRef.current(next);
          // Tulkojumā cipari / avots vai trūkst -> PDF būs standarta teksts (rāda sarkanā).
          const allOk = Object.keys(texts).every((k) => {
            const p = pairs[k as DealerSignalKind];
            return Boolean(p && isDealerSignalTextAllowed(p.text));
          });
          setPhase(allOk ? "idle" : "error");
        })
        .catch(() => {
          if (!cancelled) setPhase("error");
        });
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [key, lang, translate]);
  return phase;
}

/**
 * «+ Pievienot signālu» izvēlne (Nils 27.11): visi tipi; jau esošais (automātisks vai manuāls) - neaktīvs.
 * Sarkanā krāsā tipi, kas PDF ir sarkani.
 */
export function DealerSignalsAddMenu({
  state,
  onAdd,
  touch = false,
}: {
  state: DealerSignalsState;
  onAdd: (kind: DealerSignalKind) => void;
  touch?: boolean;
}) {
  const present = new Set(state.items.map((i) => i.kind));
  return (
    <div role="menu" aria-label="Pievienot signālu" data-dealer-signals-add-menu className="flex flex-col gap-1">
      {DEALER_SIGNAL_KINDS.map((kind) => {
        const has = present.has(kind);
        return (
          <button
            key={kind}
            type="button"
            role="menuitem"
            disabled={has}
            data-dealer-signals-add-kind={kind}
            onClick={() => onAdd(kind)}
            className={`${touch ? "min-h-11 text-[15px]" : "h-7 text-[12px]"} rounded-lg border border-[var(--admin-border-subtle)] px-2.5 text-left font-semibold disabled:cursor-default disabled:opacity-40 ${isDealerSignalAlert(kind) ? "text-[#b42318]" : "text-[var(--color-apple-text)]"}`}
          >
            {DEALER_SIGNAL_TITLES[kind].lv}
          </button>
        );
      })}
    </div>
  );
}

export function DealerSignalsEditor({
  state,
  onChange,
  onRegenerate,
  size = "desktop",
  previewLang = "lv",
  translate = null,
}: {
  state: DealerSignalsState;
  onChange: (next: DealerSignalsState) => void;
  onRegenerate: () => void;
  size?: "desktop" | "touch";
  /** Klienta (PDF) valoda - priekšskats un tulkojums šajā valodā. */
  previewLang?: ClientReportLang;
  translate?: TranslateFn | null;
}) {
  const touch = size === "touch";
  const on = state.enabled === true;
  const [addOpen, setAddOpen] = useState(false);
  const rows = dealerSignalsPdfRows({ ...state, enabled: true }, previewLang);
  const trPhase = useDealerSignalsTranslation(state, previewLang, onChange, translate);
  const setItem = (kind: DealerSignalKind, patch: { checked?: boolean; text?: string }) => {
    onChange({
      ...state,
      items: state.items.map((it) => {
        if (it.kind !== kind) return it;
        const next = { ...it, ...patch };
        if (patch.text !== undefined) {
          const t = patch.text;
          if (!t.trim() || t.trim() === DEALER_SIGNAL_DEFAULT_TEXTS[kind].lv) delete next.text;
          // Vecais tulkojums vairs neatbilst - jauno pieprasa priekšskats.
          delete next.tr;
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
            const tone = dealerSignalTone(it);
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
                <span className="mt-1.5 flex flex-col items-end gap-1">
                  <span
                    data-dealer-signal-kind-label={tone}
                    className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${TONE_LABEL_CLASS[tone]}`}
                  >
                    {DEALER_SIGNAL_ADMIN_KIND_LV[it.kind]}
                  </span>
                  <DealerSignalTonePicker
                    kind={it.kind}
                    tone={tone}
                    touch={touch}
                    onPick={(t) => onChange(setDealerSignalTone(state, it.kind, t))}
                  />
                  {it.manual ? (
                    <span className="flex items-center gap-1">
                      <span data-dealer-signal-manual className="text-[10px] font-medium text-[var(--color-provin-muted)]">
                        Manuāls
                      </span>
                      <button
                        type="button"
                        data-dealer-signal-remove={it.kind}
                        aria-label={`Noņemt: ${DEALER_SIGNAL_TITLES[it.kind].lv}`}
                        onClick={() => onChange(removeDealerSignal(state, it.kind))}
                        className={`${touch ? "min-h-11 min-w-11 text-[18px]" : "h-5 w-5 text-[13px]"} rounded leading-none text-[var(--color-provin-muted)] hover:text-[#b42318]`}
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
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
        <button
          type="button"
          className={btn}
          data-dealer-signals-add
          aria-haspopup="true"
          aria-expanded={addOpen}
          onClick={() => setAddOpen((v) => !v)}
        >
          + Pievienot signālu
        </button>
      </div>
      {addOpen ? (
        <DealerSignalsAddMenu
          state={state}
          touch={touch}
          onAdd={(kind) => {
            onChange(addManualDealerSignal(state, kind));
            setAddOpen(false);
          }}
        />
      ) : null}
      <div
        data-dealer-signals-preview
        className="rounded-lg border border-[var(--admin-border-subtle)] bg-white p-3 text-[11px] leading-snug text-[#0f172a]"
      >
        {!on || rows.length === 0 ? (
          <p className="text-[12px] font-medium text-[var(--color-provin-muted)]">Sadaļa nav PDF</p>
        ) : (
          <>
            <p className="mb-2 flex items-center justify-between gap-2 border-b border-[#E9EDF3] pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]">
              <span>{DEALER_SIGNALS_SECTION_TITLE[previewLang]}</span>
              {previewLang !== "lv" ? (
                <span data-dealer-signals-preview-lang className="text-[10px] text-[var(--color-provin-muted)]">
                  {previewLang.toUpperCase()}
                </span>
              ) : null}
            </p>
            <table className="w-full border-collapse">
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.kind}
                    className={TONE_PREVIEW_ROW[r.tone]}
                    data-dealer-signal-preview-row={r.kind}
                    data-dealer-signal-preview-tone={r.tone}
                  >
                    <td className="w-[38%] border-b border-[#E0E0E0] px-2 py-1.5 align-top font-bold">{r.title}</td>
                    <td className={`border-b border-[#E0E0E0] px-2 py-1.5 align-top ${r.tone === "neutral" ? "text-[#475569]" : "font-bold"}`}>
                      {r.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right font-bold text-[#0061D2]">{DEALER_SIGNALS_AUDIT_LINK_LABEL[previewLang]}</p>
            {trPhase === "busy" ? (
              <p data-dealer-signals-tr="busy" className="mt-1 text-[11px] text-[var(--color-provin-muted)]">
                Tulko…
              </p>
            ) : trPhase === "error" ? (
              <p data-dealer-signals-tr="error" className="mt-1 text-[11px] font-medium text-[#b42318]">
                Tulkojums neizdevās - PDF būs standarta teksts
              </p>
            ) : null}
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
  previewLang = "lv",
  sessionId = null,
}: {
  /** Klienta (PDF) valoda priekšskatam. */
  previewLang?: ClientReportLang;
  /** Tulkošanai (bez tā priekšskats rāda standarta tekstu). */
  sessionId?: string | null;
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
  const translate = useMemo(() => (sessionId ? dealerSignalsReportTranslate(sessionId) : null), [sessionId]);

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
            previewLang={previewLang}
            translate={translate}
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
