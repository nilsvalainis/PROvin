"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { formatOfferDeadlineLv } from "@/lib/iriss-offer-valid-until";
import { IRISS_PD_CLIENT_LV as L, IRISS_PD_DECLINE_REASON_MAX, IRISS_PD_QUESTION_MAX } from "@/lib/iriss-piedavajumi-types";

/**
 * Klienta atbilde piedāvājuma saitē `/p/d/<token>` (Nils 07.11):
 * «Apstiprināt» un «Noraidīt» ar apstiprinājuma soli lapā (ne window.confirm), «Uzdot jautājumu» ar teksta lauku.
 * Vizuāli `/p/` IrissOfferPublicActions stilā (plakanas pogas, oranžā galvenā).
 */

export type PdClientState = "open" | "approved" | "declined";
export type PdClientStep = "idle" | "approve" | "decline";
export type PdQuestion = { at: string; text: string };

const btn = "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";
const btnPrimary = `${btn} bg-[#F26522] text-white`;
const btnDark = `${btn} bg-[#1d1d1f] text-white`;
const btnOutline = `${btn} bg-white text-[#1d1d1f] shadow-[inset_0_0_0_1px_#d1d1d6]`;
const field = "mt-1 w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[16px] outline-none focus:border-[#F26522]";

export type PdClientActionsViewProps = {
  state: PdClientState;
  step: PdClientStep;
  needsContact: boolean;
  vehicle: string;
  price: string;
  name: string;
  phone: string;
  reason: string;
  askOpen: boolean;
  draft: string;
  questions: PdQuestion[];
  busy: boolean;
  err: string;
  notice: string;
  onName?: (v: string) => void;
  onPhone?: (v: string) => void;
  onReason?: (v: string) => void;
  onDraft?: (v: string) => void;
  onStep?: (s: PdClientStep) => void;
  onToggleAsk?: () => void;
  onConfirm?: () => void;
  onAsk?: () => void;
  confirmRef?: Ref<HTMLHeadingElement>;
};

/** Tīrs skats (bez efektiem) - testējams ar react-dom/server. */
export function PdClientActionsView(p: PdClientActionsViewProps) {
  const questions = p.questions.length ? (
    <div className="space-y-2" data-testid="pd-questions">
      <p className="text-[12px] font-medium text-[#6e6e73]">{L.yourQuestions}</p>
      {p.questions.map((q, i) => (
        <p key={`${q.at}-${i}`} className="whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[14px] leading-snug text-[#3a3a3c] shadow-[inset_0_0_0_1px_#e4e4e7]">
          {q.text}
          <span className="mt-1 block text-[11px] text-[#8e8e93]">{formatOfferDeadlineLv(q.at)}</span>
        </p>
      ))}
    </div>
  ) : null;

  const ask = (
    <div className="space-y-2">
      {p.askOpen ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            p.onAsk?.();
          }}
        >
          <label className="block text-[13px] font-medium" htmlFor="pd-question">
            {L.askLabel}
          </label>
          <textarea
            id="pd-question"
            rows={3}
            maxLength={IRISS_PD_QUESTION_MAX}
            value={p.draft}
            placeholder={L.askPlaceholder}
            onChange={(e) => p.onDraft?.(e.target.value)}
            className={field}
          />
          <button type="submit" disabled={p.busy || !p.draft.trim()} className={`${btnDark} w-full`}>
            {p.busy ? L.sending : L.askSend}
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={p.busy}
          onClick={p.onToggleAsk}
          className="flex h-11 w-full items-center justify-center text-[14px] font-semibold text-[#9a3412]"
        >
          {L.ask}
        </button>
      )}
    </div>
  );

  const messages = (
    <>
      {p.err ? (
        <p className="text-center text-[14px] font-medium text-[#b91c1c]" role="alert">
          {p.err}
        </p>
      ) : null}
      {p.notice ? (
        <p className="text-center text-[14px] font-medium text-[#047857]" role="status">
          {p.notice}
        </p>
      ) : null}
    </>
  );

  if (p.state === "approved" || p.state === "declined") {
    const approved = p.state === "approved";
    return (
      <div className="space-y-3">
        <div className={`rounded-2xl px-4 py-5 text-center ${approved ? "bg-[#ecfdf3]" : "bg-white shadow-[inset_0_0_0_1px_#e4e4e7]"}`} role="status">
          {approved ? (
            <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#047857] text-white" aria-hidden="true">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path d="M5 10.5l3.2 3.2L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : null}
          <p className={`text-[17px] font-bold ${approved ? "text-[#047857]" : "text-[#3a3a3c]"}`}>{approved ? L.approvedTitle : L.declinedTitle}</p>
          <p className="mt-1 text-[13px] text-[#52525b]">{approved ? L.approvedNote : L.declinedNote}</p>
        </div>
        {questions}
        {messages}
        {ask}
      </div>
    );
  }

  if (p.step !== "idle") {
    const approve = p.step === "approve";
    return (
      <div className="space-y-3 rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_#e4e4e7]" data-testid="pd-confirm">
        <h2 ref={p.confirmRef} tabIndex={-1} className="text-center text-[18px] font-bold text-[#111827] outline-none">
          {approve ? L.confirmApproveTitle : L.confirmDeclineTitle}
        </h2>
        {p.vehicle || p.price ? (
          <div className="flex items-baseline justify-between gap-3 rounded-xl border border-[#e4e4e7] px-3 py-2.5 text-[14px]">
            <span className="min-w-0 truncate text-[#111827]">{p.vehicle}</span>
            {p.price ? <span className="shrink-0 font-bold text-[#111827]">{p.price}</span> : null}
          </div>
        ) : null}
        {approve && p.needsContact ? (
          <p className="text-center text-[13px] text-[#52525b]">
            {p.name.trim()} · {p.phone.trim()}
          </p>
        ) : null}
        <p className="text-center text-[13px] text-[#52525b]">{approve ? L.confirmApproveNote : L.confirmDeclineNote}</p>
        {!approve ? (
          <label className="block text-[13px] font-medium" htmlFor="pd-reason">
            {L.reasonLabel}
            <textarea
              id="pd-reason"
              rows={2}
              maxLength={IRISS_PD_DECLINE_REASON_MAX}
              value={p.reason}
              placeholder={L.reasonPlaceholder}
              onChange={(e) => p.onReason?.(e.target.value)}
              className={field}
            />
          </label>
        ) : null}
        {messages}
        <div className="flex gap-2">
          <button type="button" disabled={p.busy} onClick={() => p.onStep?.("idle")} className={btnOutline}>
            {L.cancel}
          </button>
          <button type="button" disabled={p.busy} onClick={p.onConfirm} className={approve ? btnPrimary : btnDark}>
            {p.busy ? L.sending : approve ? L.confirmApprove : L.confirmDecline}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {p.needsContact ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[13px] font-medium" htmlFor="pd-name">
            Vārds, uzvārds
            <input id="pd-name" value={p.name} onChange={(e) => p.onName?.(e.target.value)} autoComplete="name" maxLength={120} className={field} />
          </label>
          <label className="block text-[13px] font-medium" htmlFor="pd-phone">
            Tālrunis
            <input
              id="pd-phone"
              value={p.phone}
              onChange={(e) => p.onPhone?.(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              className={field}
            />
          </label>
        </div>
      ) : null}
      {questions}
      {messages}
      <div className="flex gap-2">
        <button type="button" disabled={p.busy} onClick={() => p.onStep?.("approve")} className={btnPrimary}>
          {L.approve}
        </button>
        <button type="button" disabled={p.busy} onClick={() => p.onStep?.("decline")} className={btnOutline}>
          {L.decline}
        </button>
      </div>
      {ask}
    </div>
  );
}

export function pdContactValid(name: string, phone: string): boolean {
  return name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 6;
}

/** Servera kļūdas kods -> klienta teksts. */
export function pdClientErrorText(error: string | undefined, status: number): string {
  if (status === 429 || error === "rate") return L.tooMany;
  if (error === "contact") return L.contactRequired;
  if (error === "empty") return L.askEmpty;
  if (error === "duplicate") return L.askDuplicate;
  if (error === "closed" || status === 404 || status === 410) return L.closed;
  return L.sendFailed;
}

export function PdClientActions({
  token,
  needsContact,
  initialState,
  initialQuestions = [],
  vehicle = "",
  price = "",
}: {
  token: string;
  needsContact: boolean;
  initialState: PdClientState;
  initialQuestions?: PdQuestion[];
  vehicle?: string;
  price?: string;
}) {
  const [state, setState] = useState<PdClientState>(initialState);
  const [step, setStepRaw] = useState<PdClientStep>("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [questions, setQuestions] = useState<PdQuestion[]>(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (step !== "idle") confirmRef.current?.focus();
  }, [step]);

  function setStep(s: PdClientStep) {
    setErr("");
    setNotice("");
    if (s === "approve" && needsContact && !pdContactValid(name, phone)) {
      setErr(L.contactRequired);
      return;
    }
    setStepRaw(s);
  }

  async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    const res = await fetch("/api/iriss-piedavajums/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && data.ok === true, status: res.status, data };
  }

  async function run(fn: () => Promise<void>) {
    // Dubultklikšķis / atkārtots Enter: viens pieprasījums.
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      await fn();
    } catch {
      setErr(L.sendFailed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const confirm = () =>
    run(async () => {
      const action = step === "decline" ? "decline" : "approve";
      const r = await post(action === "approve" ? { action, name, phone } : { action, text: reason });
      const st = r.data.state;
      if (st === "approved" || st === "declined") {
        // Arī «jau izlemts» (otrā cilnē): rāda faktisko stāvokli.
        setState(st);
        setStepRaw("idle");
        return;
      }
      setErr(pdClientErrorText(typeof r.data.error === "string" ? r.data.error : undefined, r.status));
    });

  const askSend = () =>
    run(async () => {
      if (!draft.trim()) {
        setErr(L.askEmpty);
        return;
      }
      const r = await post({ action: "question", text: draft });
      if (r.ok) {
        if (Array.isArray(r.data.questions)) setQuestions(r.data.questions as PdQuestion[]);
        setDraft("");
        setAskOpen(false);
        setNotice(L.askSent);
        return;
      }
      setErr(pdClientErrorText(typeof r.data.error === "string" ? r.data.error : undefined, r.status));
    });

  return (
    <PdClientActionsView
      state={state}
      step={step}
      needsContact={needsContact}
      vehicle={vehicle}
      price={price}
      name={name}
      phone={phone}
      reason={reason}
      askOpen={askOpen}
      draft={draft}
      questions={questions}
      busy={busy}
      err={err}
      notice={notice}
      onName={setName}
      onPhone={setPhone}
      onReason={setReason}
      onDraft={setDraft}
      onStep={setStep}
      onToggleAsk={() => {
        setErr("");
        setNotice("");
        setAskOpen(true);
      }}
      onConfirm={() => void confirm()}
      onAsk={() => void askSend()}
      confirmRef={confirmRef}
    />
  );
}
