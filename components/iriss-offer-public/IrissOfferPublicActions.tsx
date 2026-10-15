"use client";

import { useState } from "react";
import {
  IRISS_OFFER_PUBLIC_LABELS,
  type IrissOfferClientDecision,
} from "@/lib/iriss-offer-client-link";

const btn =
  "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";

export function IrissOfferPublicActions({
  token,
  decision,
  question,
}: {
  token: string;
  decision: IrissOfferClientDecision;
  question: string;
}) {
  const [currentDecision, setCurrentDecision] = useState(decision);
  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [draft, setDraft] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [gone, setGone] = useState(false);

  async function send(action: "approve" | "decline" | "question", text = "") {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/iriss-offer-link/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, text }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          setNotice(IRISS_OFFER_PUBLIC_LABELS.questionRequired);
          return;
        }
        setGone(true);
        return;
      }
      const data = (await res.json()) as { decision?: IrissOfferClientDecision; question?: string };
      if (data.decision === "approve" || data.decision === "decline") setCurrentDecision(data.decision);
      if (typeof data.question === "string") setCurrentQuestion(data.question);
      if (action === "question") {
        setDraft("");
        setAskOpen(false);
        setNotice(IRISS_OFFER_PUBLIC_LABELS.asked);
      } else if (data.decision === "approve") {
        setNotice(IRISS_OFFER_PUBLIC_LABELS.approved);
      } else if (data.decision === "decline") {
        setNotice(IRISS_OFFER_PUBLIC_LABELS.declined);
      }
    } catch {
      setNotice(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  if (gone) {
    return (
      <p className="rounded-xl bg-white px-3 py-3 text-center text-[14px] text-[#6e6e73]">
        {IRISS_OFFER_PUBLIC_LABELS.unavailableBody}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {currentQuestion ? (
        <p className="rounded-xl bg-white px-3 py-2 text-[14px] leading-snug text-[#3a3a3c]">
          <span className="block text-[11px] font-medium text-[#6e6e73]">{IRISS_OFFER_PUBLIC_LABELS.yourQuestion}</span>
          {currentQuestion}
        </p>
      ) : null}
      {notice ? <p className="text-center text-[14px] font-medium text-[#1d1d1f]">{notice}</p> : null}
      {askOpen ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send("question", draft);
          }}
        >
          <label className="block text-[13px] font-medium" htmlFor="iriss-offer-question">
            {IRISS_OFFER_PUBLIC_LABELS.ask}
          </label>
          <textarea
            id="iriss-offer-question"
            maxLength={400}
            rows={3}
            value={draft}
            placeholder={IRISS_OFFER_PUBLIC_LABELS.questionPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[16px] outline-none focus:border-[#F26522]"
          />
          <button type="submit" disabled={busy || !draft.trim()} className={`${btn} w-full bg-[#1d1d1f] text-white`}>
            {IRISS_OFFER_PUBLIC_LABELS.askSend}
          </button>
        </form>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || currentDecision !== ""}
          onClick={() => void send("approve")}
          className={`${btn} bg-[#F26522] text-white`}
        >
          {IRISS_OFFER_PUBLIC_LABELS.approve}
        </button>
        <button
          type="button"
          disabled={busy || currentDecision !== ""}
          onClick={() => void send("decline")}
          className={`${btn} bg-white text-[#1d1d1f] shadow-[inset_0_0_0_1px_#d1d1d6]`}
        >
          {IRISS_OFFER_PUBLIC_LABELS.decline}
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => setAskOpen((open) => !open)}
        className="flex h-11 w-full items-center justify-center text-[14px] font-semibold text-[#9a3412]"
      >
        {IRISS_OFFER_PUBLIC_LABELS.ask}
      </button>
    </div>
  );
}
