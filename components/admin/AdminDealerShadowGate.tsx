"use client";

import { useState } from "react";
import { requestOpenAdminBlock } from "@/lib/admin-mobile-ds";
import {
  dealerShadowGateLabel,
  failedDealerGateChecks,
  type DealerGateCheck,
  type DealerGatePlace,
  type DealerShadowFeedback,
  type DealerShadowGate,
} from "@/lib/dealer-shadow-types";

/**
 * Dīlera datu ēnu režīms (Nils 22.11.2026): «Sistēma sūtītu» / «Sistēma aizturētu · N iemesli».
 * Tikai spriedums un atsauksme - nekāda automātiska sūtīšana. Divi stili: dators (plakans) un telefons (#1117 glass).
 */

const DEALER_ARIA = "Oficiālā dīlera dati";

const PLACE_SELECTOR: Record<DealerGatePlace, string | null> = {
  service_table: `[aria-label="${DEALER_ARIA} servisa datums 1"]`,
  oil_notes: `[aria-label="${DEALER_ARIA} - papildu komentārs eļļas intervāliem"]`,
  comments: `[aria-label="${DEALER_ARIA} - komentāri"]`,
  pdf: null,
  job: null,
};

const PLACE_LABEL: Record<DealerGatePlace, string> = {
  service_table: "Servisa tabula",
  oil_notes: "Eļļas intervāli",
  comments: "Komentāri",
  pdf: "PDF",
  job: "Ielase",
};

/** Atver dīlera bloku un ritina līdz vietai, kur labot. */
export function focusDealerGatePlace(place: DealerGatePlace | undefined): void {
  if (typeof document === "undefined") return;
  requestOpenAdminBlock("auto-records");
  window.setTimeout(() => {
    const root = document.getElementById("admin-order-block-auto-records");
    const sel = place ? PLACE_SELECTOR[place] : null;
    const target = (sel ? root?.querySelector<HTMLElement>(sel) : null) ?? root;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 380);
}

export type DealerShadowTone = "send" | "hold" | "none";

export function dealerShadowTone(gate: DealerShadowGate | null | undefined): DealerShadowTone {
  if (!gate) return "none";
  return gate.verdict === "would_send" ? "send" : "hold";
}

/** Iemesli: vispirms bloķējošie, tad brīdinājumi. */
export function dealerShadowReasons(gate: DealerShadowGate | null | undefined): DealerGateCheck[] {
  const failed = failedDealerGateChecks(gate);
  return [...failed.filter((c) => c.severity === "block"), ...failed.filter((c) => c.severity === "warn")];
}

const DOT: Record<DealerShadowTone, string> = {
  send: "bg-emerald-500",
  hold: "bg-amber-500",
  none: "bg-slate-300",
};

type RowProps = {
  gate: DealerShadowGate | null | undefined;
  busy?: boolean;
  onRecheck?: () => void;
  /** Telefona #1117 stikla stils. */
  glass?: boolean;
  /** Sākumā atvērts saraksts (testiem). */
  defaultOpen?: boolean;
};

/** Rinda dīlera blokā / telefona B1 statusa kartītē. Klikšķis atver iemeslu sarakstu ar saitēm uz vietu. */
export function AdminDealerShadowGateRow({ gate, busy = false, onRecheck, glass = false, defaultOpen = false }: RowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = dealerShadowTone(gate);
  const reasons = dealerShadowReasons(gate);
  const label = dealerShadowGateLabel(gate);
  const warnCount = reasons.filter((c) => c.severity === "warn").length;
  const canOpen = reasons.length > 0;

  if (glass) {
    return (
      <div className="mt-2" data-dealer-shadow={tone}>
        <button
          type="button"
          className="amx-row w-full justify-between rounded-[var(--amx-r)] text-left"
          aria-expanded={canOpen ? open : undefined}
          onClick={() => (canOpen ? setOpen((v) => !v) : onRecheck?.())}
        >
          <span className={`amx-st ${tone === "send" ? "amx-st--ok" : tone === "hold" ? "amx-st--warn" : "amx-st--muted"}`}>
            {label}
          </span>
          {warnCount > 0 && tone === "send" ? <span className="amx-mut text-[12px]">{warnCount} piezīmes</span> : null}
        </button>
        {open && canOpen ? (
          <ul className="mt-1 space-y-1.5 px-1 text-[13px]">
            {reasons.map((c) => (
              <li key={c.id} className="[overflow-wrap:anywhere]">
                <b className={c.severity === "block" ? "amx-tx--warn" : "amx-mut"}>{c.title}</b>
                <span className="amx-mut"> · {c.reason}</span>
                {c.place && PLACE_SELECTOR[c.place] ? (
                  <button type="button" className="amx-pill ml-1.5" onClick={() => focusDealerGatePlace(c.place)}>
                    {PLACE_LABEL[c.place]}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {onRecheck && (open || !gate) ? (
          <button type="button" className="amx-pill mt-1.5" disabled={busy} onClick={onRecheck}>
            {busy ? "Pārbauda…" : "Pārbaudīt vēlreiz"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-1.5 text-[10.5px]" data-dealer-shadow={tone}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded px-0.5 text-left font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
          aria-expanded={canOpen ? open : undefined}
          disabled={!canOpen}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
          {label}
          {warnCount > 0 && tone === "send" ? <span className="text-slate-500">· {warnCount} piezīmes</span> : null}
        </button>
        {onRecheck ? (
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={busy}
            onClick={onRecheck}
          >
            {busy ? "Pārbauda…" : "Pārbaudīt vēlreiz"}
          </button>
        ) : null}
      </div>
      {open && canOpen ? (
        <ul className="mt-1 space-y-1 pl-3.5">
          {reasons.map((c) => (
            <li key={c.id} className="text-slate-600 [overflow-wrap:anywhere]">
              <b className={c.severity === "block" ? "text-amber-700" : "text-slate-500"}>{c.title}</b> · {c.reason}
              {c.place && PLACE_SELECTOR[c.place] ? (
                <button
                  type="button"
                  className="ml-1 text-sky-700 underline underline-offset-2 hover:text-sky-900"
                  onClick={() => focusDealerGatePlace(c.place)}
                >
                  {PLACE_LABEL[c.place]}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type FeedbackProps = {
  gate: DealerShadowGate | null | undefined;
  feedback: DealerShadowFeedback | null | undefined;
  busy?: boolean;
  onSubmit: (correct: boolean, note: string) => void;
};

/**
 * Sūtīšanas formā pirms «Sūtīt»: kompakts spriedums + «Pārbaude pareiza» / «Pārbaude kļūdījās».
 * Neobligāti (netraucē sūtīšanai), tikai atgādinājums. «Kļūdījās» - īss lauks «kas nepareizi».
 */
export function AdminDealerShadowFeedback({ gate, feedback, busy = false, onSubmit }: FeedbackProps) {
  const [choice, setChoice] = useState<null | boolean>(null);
  const [note, setNote] = useState("");
  if (!gate) return null;
  const tone = dealerShadowTone(gate);
  const answered = feedback ?? null;
  const pill =
    "rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 max-md:min-h-9 max-md:text-[13px]";
  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-[11px] max-md:text-[13px]"
      data-dealer-shadow-feedback={answered ? (answered.correct ? "correct" : "wrong") : "none"}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
          {dealerShadowGateLabel(gate)}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`${pill} ${answered?.correct === true ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"}`}
            disabled={busy}
            onClick={() => {
              setChoice(true);
              onSubmit(true, "");
            }}
          >
            Pārbaude pareiza
          </button>
          <button
            type="button"
            className={`${pill} ${answered?.correct === false || choice === false ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"}`}
            disabled={busy}
            onClick={() => setChoice(false)}
          >
            Pārbaude kļūdījās
          </button>
        </div>
      </div>
      {tone === "hold" ? (
        <ul className="mt-1 space-y-0.5 text-slate-600">
          {dealerShadowReasons(gate)
            .filter((c) => c.severity === "block")
            .slice(0, 3)
            .map((c) => (
              <li key={c.id} className="[overflow-wrap:anywhere]">
                · {c.title}: {c.reason}
              </li>
            ))}
        </ul>
      ) : null}
      {choice === false && answered?.correct !== false ? (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] max-md:min-h-9 max-md:text-[14px]"
            placeholder="Kas nepareizi (neobligāti)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Kas pārbaudē nepareizi"
          />
          <button
            type="button"
            className={`${pill} border-slate-300 bg-white text-slate-700`}
            disabled={busy}
            onClick={() => onSubmit(false, note)}
          >
            Saglabāt
          </button>
        </div>
      ) : null}
      {!answered && choice === null ? (
        <p className="mt-1 text-[10.5px] text-amber-700 max-md:text-[12px]">Atzīmē, vai pārbaude bija pareiza (neobligāti).</p>
      ) : null}
      {answered ? (
        <p className="mt-1 text-[10.5px] text-slate-500 max-md:text-[12px]">
          Atzīmēts: {answered.correct ? "pārbaude pareiza" : `pārbaude kļūdījās${answered.note ? ` - ${answered.note}` : ""}`}
        </p>
      ) : null}
    </div>
  );
}
