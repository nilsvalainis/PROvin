"use client";

import { useCallback, useMemo, useState } from "react";
import { IrissOfferPublicConfirm } from "@/components/iriss-offer-public/IrissOfferPublicConfirm";
import { IrissOfferPublicCountdown } from "@/components/iriss-offer-public/IrissOfferPublicCountdown";
import {
  IRISS_OFFER_PUBLIC_LABELS,
  type IrissOfferClientDecision,
} from "@/lib/iriss-offer-client-link";
import { offerClockSkewMs } from "@/lib/iriss-offer-countdown";
import { formatOfferDeadlineLv, isOfferDeadlinePassed } from "@/lib/iriss-offer-valid-until";

const btn =
  "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";

export function IrissOfferPublicActions({
  token,
  decision,
  decidedAt = "",
  question,
  deadlineAt = "",
  serverNow = "",
  vehicle = "",
  total = "",
}: {
  token: string;
  decision: IrissOfferClientDecision;
  decidedAt?: string;
  question: string;
  deadlineAt?: string;
  serverNow?: string;
  vehicle?: string;
  total?: string;
}) {
  const skewMs = useMemo(() => offerClockSkewMs(serverNow, Date.now()), [serverNow]);
  const deadlineMs = deadlineAt ? Date.parse(deadlineAt) : Number.NaN;
  const hasDeadline = Number.isFinite(deadlineMs);
  const [currentDecision, setCurrentDecision] = useState(decision);
  const [currentDecidedAt, setCurrentDecidedAt] = useState(decidedAt);
  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [draft, setDraft] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [gone, setGone] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "decline" | null>(null);
  const [expired, setExpired] = useState(() =>
    hasDeadline ? isOfferDeadlinePassed(deadlineMs, Date.parse(serverNow) || Date.now()) : false,
  );
  const onExpire = useCallback(() => {
    setExpired(true);
    setConfirm(null);
  }, []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

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
        if (res.status === 410) {
          onExpire();
          return;
        }
        setGone(true);
        return;
      }
      const data = (await res.json()) as { decision?: IrissOfferClientDecision; decidedAt?: string; question?: string };
      if (data.decision === "approve" || data.decision === "decline") {
        setCurrentDecision(data.decision);
        setCurrentDecidedAt(typeof data.decidedAt === "string" ? data.decidedAt : "");
      }
      if (typeof data.question === "string") setCurrentQuestion(data.question);
      if (action === "question") {
        setDraft("");
        setAskOpen(false);
        setNotice(IRISS_OFFER_PUBLIC_LABELS.asked);
      }
    } catch {
      setNotice(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (gone) {
    return (
      <p className="rounded-xl bg-white px-3 py-3 text-center text-[14px] text-[#6e6e73]">
        {IRISS_OFFER_PUBLIC_LABELS.unavailableBody}
      </p>
    );
  }

  const questionBlock = currentQuestion ? (
    <p className="rounded-xl bg-white px-3 py-2 text-[14px] leading-snug text-[#3a3a3c]">
      <span className="block text-[11px] font-medium text-[#6e6e73]">{IRISS_OFFER_PUBLIC_LABELS.yourQuestion}</span>
      {currentQuestion}
    </p>
  ) : null;

  if (currentDecision === "approve" || currentDecision === "decline") {
    const approved = currentDecision === "approve";
    const at = formatOfferDeadlineLv(currentDecidedAt);
    return (
      <div className="space-y-3">
        {questionBlock}
        <div
          className={`rounded-2xl px-4 py-5 text-center ${approved ? "bg-[#ecfdf3]" : "bg-white shadow-[inset_0_0_0_1px_#e4e4e7]"}`}
          role="status"
        >
          {approved ? (
            <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#047857] text-white" aria-hidden="true">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path d="M5 10.5l3.2 3.2L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : null}
          <p className={`text-[17px] font-bold ${approved ? "text-[#047857]" : "text-[#3a3a3c]"}`}>
            {approved ? IRISS_OFFER_PUBLIC_LABELS.approvedTitle : IRISS_OFFER_PUBLIC_LABELS.declinedTitle}
          </p>
          {at || approved ? (
            <p className="mt-1 text-[13px] text-[#52525b]">
              {[at, approved ? IRISS_OFFER_PUBLIC_LABELS.contactSoon : ""].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const decisionsDisabled = busy || expired;

  return (
    <div className="space-y-3">
      {questionBlock}
      {notice ? <p className="text-center text-[14px] font-medium text-[#1d1d1f]">{notice}</p> : null}
      {hasDeadline && expired ? (
        <div className="text-center">
          <p className="rounded-xl bg-[#e9e9ec] px-3 py-3 text-[15px] font-semibold text-[#3a3a3c]" role="status">
            {IRISS_OFFER_PUBLIC_LABELS.expired}
          </p>
          <p className="mt-2 text-[12px] text-[#6e6e73]">{formatOfferDeadlineLv(deadlineAt)}</p>
        </div>
      ) : null}
      {!hasDeadline && expired ? (
        <p className="rounded-xl bg-[#e9e9ec] px-3 py-3 text-center text-[15px] font-semibold text-[#3a3a3c]" role="status">
          {IRISS_OFFER_PUBLIC_LABELS.expired}
        </p>
      ) : null}
      {hasDeadline && !expired ? (
        <IrissOfferPublicCountdown deadlineAt={deadlineAt} skewMs={skewMs} onExpire={onExpire} />
      ) : null}
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
          disabled={decisionsDisabled}
          onClick={() => setConfirm("approve")}
          className={`${btn} bg-[#F26522] text-white`}
        >
          {IRISS_OFFER_PUBLIC_LABELS.approve}
        </button>
        <button
          type="button"
          disabled={decisionsDisabled}
          onClick={() => setConfirm("decline")}
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
      {confirm && !expired ? (
        <IrissOfferPublicConfirm
          action={confirm}
          vehicle={vehicle}
          total={total}
          busy={busy}
          onCancel={closeConfirm}
          onConfirm={() => void send(confirm)}
        />
      ) : null}
    </div>
  );
}
