"use client";

import { useState } from "react";
import { IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";
import { IRISS_PD_CLIENT_MESSAGE_MAX } from "@/lib/iriss-piedavajumi-types";

const btn =
  "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";
const outline = "bg-white text-[#1d1d1f] shadow-[inset_0_0_0_1px_#e4e4e7]";
const field =
  "w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[16px] outline-none focus:border-[#F26522]";

export type PdClientState = "open" | "approved" | "declined";

type Reply = { ok?: boolean; error?: string; state?: string; question?: string };

/** Klienta paša jautājumi (tikai viņa teksts). */
export function PdClientQuestions({ questions }: { questions: readonly { at: string; text: string }[] }) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <p key={`${q.at}-${i}`} className="whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-[14px] leading-snug text-[#1d1d1f] shadow-[inset_0_0_0_1px_#e4e4e7]">
          <span className="block text-[11px] font-medium text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.yourQuestion}</span>
          {q.text}
        </p>
      ))}
    </div>
  );
}

export function PdDeclinedNotice() {
  return (
    <div className="rounded-2xl bg-white px-4 py-5 text-center shadow-[inset_0_0_0_1px_#e4e4e7]" role="status">
      <p className="text-[17px] font-bold text-[#1d1d1f]">{IRISS_OFFER_PUBLIC_LABELS.declinedTitle}</p>
      <p className="mt-1 text-[13px] text-[#52525b]">Paldies par atbildi.</p>
    </div>
  );
}

/**
 * Klienta atbilde Piedāvājumu plūsmā: «Apstiprināt», «Noraidīt» (ar apstiprinājuma soli) un «Uzdot jautājumu».
 * Vizuāli `/p/` IrissOfferPublicActions stilā. Klientam nekas netiek sūtīts - tikai ziņa adminam.
 */
export function PdApproveForm({
  token,
  needsContact,
  state = "open",
  questions = [],
}: {
  token: string;
  needsContact: boolean;
  state?: PdClientState;
  questions?: readonly { at: string; text: string }[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<PdClientState | "closed">(state);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState(questions);

  async function post(payload: Record<string, unknown>): Promise<Reply> {
    const res = await fetch("/api/iriss-piedavajums/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    });
    return (await res.json().catch(() => ({}))) as Reply;
  }

  function applyState(data: Reply) {
    if (data.state === "approved" || data.state === "declined") setCurrent(data.state);
    else if (data.error === "closed") setCurrent("closed");
  }

  async function approve() {
    setErr("");
    setNotice("");
    if (needsContact && (name.trim().length < 2 || phone.replace(/\D/g, "").length < 6)) {
      setErr("Ievadiet vārdu un tālruni.");
      return;
    }
    setBusy(true);
    try {
      const data = await post({ action: "approve", name, phone });
      applyState(data);
      if (data.ok) return;
      if (data.error === "contact") setErr("Ievadiet vārdu un tālruni.");
      else if (!data.state && data.error !== "closed") setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } catch {
      setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const data = await post({ action: "decline", text: reason });
      applyState(data);
      if (data.ok) setDeclineOpen(false);
      else if (!data.state && data.error !== "closed") setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } catch {
      setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    setErr("");
    setNotice("");
    if (draft.trim().length < 3) {
      setErr(IRISS_OFFER_PUBLIC_LABELS.questionRequired);
      return;
    }
    setBusy(true);
    try {
      const data = await post({ action: "question", text: draft });
      if (data.ok) {
        setAsked((prev) => [...prev, { at: new Date().toISOString(), text: data.question || draft.trim() }]);
        setDraft("");
        setAskOpen(false);
        setNotice(IRISS_OFFER_PUBLIC_LABELS.asked);
        return;
      }
      applyState(data);
      if (data.error === "question") setErr(IRISS_OFFER_PUBLIC_LABELS.questionRequired);
      else if (data.error === "limit") setErr("Jautājumu ir pārāk daudz. Lūdzu, sazinieties ar mums.");
      else if (data.error !== "closed") setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } catch {
      setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  if (current === "closed") {
    return (
      <p className="rounded-xl bg-white shadow-[inset_0_0_0_1px_#e4e4e7] px-3 py-3 text-center text-[15px] font-semibold text-[#1d1d1f]" role="status">
        Piedāvājums vairs nav spēkā.
      </p>
    );
  }

  if (current === "declined") {
    return (
      <div className="space-y-3">
        <PdClientQuestions questions={asked} />
        <PdDeclinedNotice />
      </div>
    );
  }

  const questionForm = askOpen ? (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void ask();
      }}
    >
      <label className="block text-[13px] font-medium" htmlFor="pd-question">
        {IRISS_OFFER_PUBLIC_LABELS.ask}
      </label>
      <textarea
        id="pd-question"
        maxLength={IRISS_PD_CLIENT_MESSAGE_MAX}
        rows={3}
        value={draft}
        placeholder={IRISS_OFFER_PUBLIC_LABELS.questionPlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        className={field}
      />
      <button type="submit" disabled={busy || !draft.trim()} className={`${btn} w-full bg-[#1d1d1f] text-white`}>
        {busy ? "Sūta..." : IRISS_OFFER_PUBLIC_LABELS.askSend}
      </button>
    </form>
  ) : null;

  const askToggle = (
    <button
      type="button"
      disabled={busy}
      onClick={() => setAskOpen((open) => !open)}
      aria-expanded={askOpen}
      className="flex h-11 w-full items-center justify-center text-[14px] font-semibold text-[#1d1d1f] underline underline-offset-4"
    >
      Uzdot jautājumu
    </button>
  );

  const messages = (
    <>
      <PdClientQuestions questions={asked} />
      {notice ? (
        <p className="text-center text-[14px] font-medium text-[#1d1d1f]" role="status">
          {notice}
        </p>
      ) : null}
      {err ? (
        <p className="text-center text-[14px] font-medium text-[#1d1d1f]" role="alert">
          {err}
        </p>
      ) : null}
    </>
  );

  if (current === "approved") {
    return (
      <div className="space-y-3">
        {messages}
        <div className="rounded-2xl bg-[#ecfdf3] px-4 py-5 text-center" role="status">
          <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#047857] text-white" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M5 10.5l3.2 3.2L15 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-[17px] font-bold text-[#047857]">{IRISS_OFFER_PUBLIC_LABELS.approvedTitle}</p>
          <p className="mt-1 text-[13px] text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.contactSoon}</p>
        </div>
        {questionForm}
        {askToggle}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages}
      {needsContact ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[13px] font-medium" htmlFor="pd-name">
            Vārds, uzvārds
            <input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`mt-1 ${field}`} />
          </label>
          <label className="block text-[13px] font-medium" htmlFor="pd-phone">
            Tālrunis
            <input
              id="pd-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              className={`mt-1 ${field}`}
            />
          </label>
        </div>
      ) : null}
      {questionForm}
      {declineOpen ? (
        <div className="space-y-2 rounded-2xl bg-white p-3 shadow-[inset_0_0_0_1px_#e4e4e7]" role="group" aria-labelledby="pd-decline-title">
          <p id="pd-decline-title" className="text-center text-[16px] font-bold text-[#111827]">
            {IRISS_OFFER_PUBLIC_LABELS.confirmDeclineTitle}
          </p>
          <label className="block text-[13px] font-medium" htmlFor="pd-decline-reason">
            Iemesls (nav obligāts)
          </label>
          <textarea
            id="pd-decline-reason"
            maxLength={IRISS_PD_CLIENT_MESSAGE_MAX}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={field}
          />
          <p className="text-center text-[12px] text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.confirmNote}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setDeclineOpen(false)} className={`${btn} ${outline}`}>
              {IRISS_OFFER_PUBLIC_LABELS.cancel}
            </button>
            <button type="button" disabled={busy} onClick={() => void decline()} className={`${btn} bg-[#1d1d1f] text-white`}>
              {busy ? "Sūta..." : IRISS_OFFER_PUBLIC_LABELS.confirmDecline}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" className={`${btn} bg-[#F26522] text-white`} disabled={busy} onClick={() => void approve()}>
            {busy ? "Sūta..." : IRISS_OFFER_PUBLIC_LABELS.approve}
          </button>
          <button type="button" className={`${btn} ${outline}`} disabled={busy} onClick={() => setDeclineOpen(true)}>
            {IRISS_OFFER_PUBLIC_LABELS.decline}
          </button>
        </div>
      )}
      {askToggle}
    </div>
  );
}
