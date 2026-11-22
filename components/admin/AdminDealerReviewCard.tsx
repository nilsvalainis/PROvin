"use client";

import { useEffect, useMemo, useState } from "react";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import {
  computeDealerReviewScore,
  DEALER_AUDITS_ADVICE_LABEL,
  DEALER_REVIEW_ACTION_HINT,
  DEALER_REVIEW_ACTION_LABEL,
  DEALER_REVIEW_ACTION_SHORT,
  DEALER_REVIEW_LEVEL_LABEL,
  dealerAuditsTone,
  dealerReviewLevelTone,
  type DealerReviewReason,
  type DealerReviewScore,
  type DealerReviewTone,
} from "@/lib/dealer-review-score";

/**
 * «Atsauksmes iespēja» (Nila apstiprinātais makets 22.11.2026): kartīte dīlera blokā (dators),
 * telefona B1 glass kartīte un mazs indikators sūtīšanas formā pie «Google atsauksmes lūgums».
 * Tikai IESAKA - ķeksis formā pats neieslēdzas.
 */

/** AUDITS piemaksa samaksāta? (tas pats GET, ko lieto piedāvājuma josla). */
function useAuditsPurchased(sessionId: string, enabled: boolean): boolean {
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    if (!sessionId || !enabled) return;
    let alive = true;
    void fetch(`/api/admin/order-upsell?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { applied?: { targetLine?: string } | null } | null) => {
        if (alive) setPaid(d?.applied?.targetLine === "audit");
      })
      .catch(() => {
        /* kartīte nav kritiska */
      });
    return () => {
      alive = false;
    };
  }, [sessionId, enabled]);
  return paid;
}

export function useDealerReviewScore(args: {
  sessionId: string;
  job: DealerDataJob | null;
  autoRecords: AutoRecordsBlockState | null | undefined;
  vin?: string | null;
  /** Citu avotu teksti (reģistru taxi pazīmes). */
  extraTexts?: readonly string[];
}): DealerReviewScore | null {
  const { job, autoRecords, vin, extraTexts } = args;
  // Tikai dīlera datu pasūtījumiem (ir ielases darbs) - citiem kartīti nerāda.
  const auditsPurchased = useAuditsPurchased(args.sessionId, Boolean(job));
  return useMemo(() => {
    if (!job) return null;
    try {
      return computeDealerReviewScore({ autoRecords, job, vin, context: { auditsPurchased, extraTexts } });
    } catch {
      return null;
    }
  }, [job, autoRecords, vin, extraTexts, auditsPurchased]);
}

// ---------------------------------------------------------------------------------------------

const DOT: Record<DealerReviewTone, string> = {
  ok: "bg-emerald-700",
  mid: "bg-slate-500",
  bad: "bg-rose-700",
  o: "bg-transparent shadow-[inset_0_0_0_1.5px_#64748b]",
};
const TX: Record<DealerReviewTone, string> = {
  ok: "text-emerald-700",
  mid: "text-slate-500",
  bad: "text-rose-700",
  o: "text-slate-500",
};

function Dot({ tone }: { tone: DealerReviewTone }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />;
}

function signClass(sign: DealerReviewReason["sign"]): string {
  if (sign === "+" || sign === "!") return "text-emerald-700";
  if (sign === "-") return "text-rose-700";
  return "text-slate-400";
}

function pointsLabel(r: DealerReviewReason): string {
  if (r.points == null) return "";
  if (r.max != null) return `${r.points}/${r.max}`;
  return r.points > 0 ? `+${r.points}` : String(r.points);
}

function signChar(sign: DealerReviewReason["sign"]): string {
  return sign === "·" ? "·" : sign;
}

function auditsSub(review: DealerReviewScore): string {
  if (review.audits.advice === "worth") return "Pievienot e-pastam";
  if (review.audits.advice === "unlikely") return "Nepievienot";
  return "-";
}

const lb = "text-[10px] font-medium uppercase tracking-wide text-slate-500";

/** Dators: kartīte dīlera blokā (zem «Piegāde» rindas). */
export function AdminDealerReviewCard({ review, orderDate }: { review: DealerReviewScore; orderDate?: string }) {
  const tone = dealerReviewLevelTone(review.level);
  const aTone = dealerAuditsTone(review.audits.advice);
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200" data-dealer-review={review.level}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className={lb}>Atsauksme un AUDITS</span>
        {orderDate ? <span className="text-[11px] tabular-nums text-slate-500">pasūtīts {orderDate}</span> : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="px-3 py-2">
          <span className={lb}>Google atsauksme</span>
          <div className={`mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold ${TX[tone]}`}>
            <Dot tone={tone} />
            {DEALER_REVIEW_LEVEL_LABEL[review.level]}
            {review.score != null ? (
              <span className="text-[11.5px] font-medium tabular-nums text-slate-500">{review.score}/100</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[12px] text-slate-800">{DEALER_REVIEW_ACTION_LABEL[review.action]}</div>
        </div>
        <div className="border-t border-slate-200 px-3 py-2 sm:border-l sm:border-t-0">
          <span className={lb}>AUDITS piedāvājums</span>
          <div className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">
            <Dot tone={aTone} />
            {DEALER_AUDITS_ADVICE_LABEL[review.audits.advice]}
          </div>
          <div className="mt-0.5 text-[12px] text-slate-500">{auditsSub(review)}</div>
        </div>
      </div>
      {review.disqualifier ? (
        <div className="flex items-start gap-2 border-t border-slate-200 px-3 py-2 text-[12px] text-slate-800">
          <span className="font-bold text-emerald-700">!</span>
          <span>
            <b className="font-semibold">Atrunājošs atradums:</b> {review.disqualifier.text}. Klients, visticamāk, auto
            nepirks - pateicība ir tagad.
          </span>
        </div>
      ) : null}
      {review.reasons.length > 0 ? (
        <div className="border-t border-slate-200">
          {review.reasons.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[14px_1fr_auto] items-baseline gap-1.5 border-t border-slate-100 px-3 py-1 text-[12px] first:border-t-0"
            >
              <span className={`text-center font-bold ${signClass(r.sign)}`}>{signChar(r.sign)}</span>
              <span className="min-w-0 text-slate-800 [overflow-wrap:anywhere]">{r.text}</span>
              <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500">{pointsLabel(r)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {review.audits.reasons.length > 0 ? (
        <div className="border-t border-slate-200 px-3 py-2 text-[12px]">
          <span className={lb}>AUDITS - kāpēc</span>
          <ul className="mt-0.5">
            {review.audits.reasons.map((x, i) => (
              <li key={i} className="text-slate-800">
                <span className="text-slate-400">- </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Telefons (B1, glass palete 2)
// ---------------------------------------------------------------------------------------------

const GLASS_TX: Record<DealerReviewTone, string> = {
  ok: "text-[var(--amx-green)]",
  mid: "amx-mut",
  bad: "text-[var(--amx-red)]",
  o: "amx-mut",
};
const GLASS_ST: Record<DealerReviewTone, string> = {
  ok: "amx-st amx-st--ok",
  mid: "amx-st amx-st--muted",
  bad: "amx-st amx-st--err",
  o: "amx-st amx-st--outline",
};

function glassSign(sign: DealerReviewReason["sign"]): string {
  if (sign === "+" || sign === "!") return "text-[var(--amx-green)]";
  if (sign === "-") return "text-[var(--amx-red)]";
  return "amx-mut";
}

const GLASS_SHOWN = 5;

export function AdminDealerReviewGlassCard({ review }: { review: DealerReviewScore }) {
  const [all, setAll] = useState(false);
  const tone = dealerReviewLevelTone(review.level);
  const aTone = dealerAuditsTone(review.audits.advice);
  const shown = all ? review.reasons : review.reasons.slice(0, GLASS_SHOWN);
  const rest = review.reasons.length - GLASS_SHOWN;
  const k = "amx-mut text-[11.5px] font-semibold uppercase tracking-[0.06em]";
  return (
    <>
      <div className="amx-lbl">Atsauksme un AUDITS</div>
      <div className="amx-card overflow-hidden" data-dealer-review={review.level}>
        <div className="grid grid-cols-2">
          <div className="px-3.5 py-3">
            <div className={k}>Atsauksme</div>
            <div className={`mt-1 text-[17px] font-bold ${GLASS_TX[tone]}`}>
              <span className={GLASS_ST[tone]} style={{ fontSize: "inherit", fontWeight: "inherit" }}>
                {DEALER_REVIEW_LEVEL_LABEL[review.level]}
              </span>
            </div>
            <div className="amx-mut mt-0.5 text-[13px]">
              {DEALER_REVIEW_ACTION_SHORT[review.action]}
              {review.score != null ? ` · ${review.score}` : ""}
            </div>
          </div>
          <div className="border-l border-[var(--amx-hair)] px-3.5 py-3">
            <div className={k}>AUDITS</div>
            <div className="mt-1 text-[17px] font-bold">
              <span className={GLASS_ST[aTone]} style={{ fontSize: "inherit", fontWeight: "inherit", color: "var(--amx-tx)" }}>
                {DEALER_AUDITS_ADVICE_LABEL[review.audits.advice]}
              </span>
            </div>
            <div className="amx-mut mt-0.5 text-[13px] [overflow-wrap:anywhere]">
              {review.audits.reasons[0] ? review.audits.reasons[0].toLowerCase() : "-"}
            </div>
          </div>
        </div>
        {review.disqualifier ? (
          <div className="flex items-start gap-2 border-t border-[var(--amx-hair)] px-3.5 py-2.5 text-[14px]">
            <span className="font-bold text-[var(--amx-green)]">!</span>
            <span>
              <b>{review.disqualifier.kind === "taxi" ? "TAXI" : "Atrunājošs atradums"}</b> - klients, visticamāk, auto
              nepirks. Lūgt tagad.
            </span>
          </div>
        ) : null}
        {shown.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[14px_1fr_auto] items-baseline gap-2 border-t border-[var(--amx-hair)] px-3.5 py-2 text-[14px]"
          >
            <span className={`text-center font-bold ${glassSign(r.sign)}`}>{signChar(r.sign)}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{r.text}</span>
            <span className="amx-mut text-[12.5px] tabular-nums">
              {r.points == null ? "" : r.points > 0 ? `+${r.points}` : String(r.points)}
            </span>
          </div>
        ))}
        {rest > 0 ? (
          <button
            type="button"
            className="amx-mut flex w-full justify-between border-t border-[var(--amx-hair)] px-3.5 py-2.5 text-left text-[14px]"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
          >
            <span>{all ? "Mazāk" : `Vēl ${rest} ${rest === 1 ? "iemesls" : "iemesli"}`}</span>
          </button>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Sūtīšanas forma: mazs indikators pie «Google atsauksmes lūgums»
// ---------------------------------------------------------------------------------------------

export function AdminDealerReviewIndicator({ review }: { review: DealerReviewScore }) {
  const tone = dealerReviewLevelTone(review.level);
  return (
    <span className="block" data-dealer-review-indicator={review.level}>
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold max-md:text-[13px] ${TX[tone]}`}
      >
        <Dot tone={tone} />
        {DEALER_REVIEW_LEVEL_LABEL[review.level].toLowerCase()}
        {review.score != null ? ` · ${review.score}` : ""}
      </span>
      <span className="amx-mut ml-1.5 text-[11px] text-slate-500 max-md:text-[12.5px]">
        {DEALER_REVIEW_ACTION_HINT[review.action]} · AUDITS: {DEALER_AUDITS_ADVICE_LABEL[review.audits.advice].toLowerCase()}
      </span>
    </span>
  );
}
