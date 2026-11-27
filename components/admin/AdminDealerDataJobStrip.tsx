"use client";

import { useMemo, useState } from "react";
import { formatRigaIsoShort } from "@/lib/riga-datetime";
import { ADMIN_PRO_TONE } from "@/lib/admin-pro-tones";
import {
  dealerDataJobMissingAi,
  dealerDataRetryButtonLabel,
  describeDealerDataJob,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import { dealerSendStatusLine, lastDealerSend } from "@/lib/order-client-marks";
import { AdminClientReportLinkControl } from "@/components/admin/AdminClientReportLinkControl";
import { AdminClientLangChip } from "@/components/admin/AdminClientLangControl";
import { dealerRefundCentsOf as refundCentsOf, resolveDealerPdfLang, useDealerDataJobControls } from "@/components/admin/useDealerDataJobControls";
import { ADMIN_B2B_BTN, AdminB2bActionLabel } from "@/components/admin/AdminB2bAction";
import { AdminPdfLangSplitButton, type PdfLockLang } from "@/components/admin/AdminPdfLangSplitButton";
import { AdminDealerSendDialog, type DealerSendBridge } from "@/components/admin/AdminDealerSendDialog";
import { AdminDealerRefundDialog } from "@/components/admin/AdminDealerRefundDialog";
import { AdminAuctionArchivePanel } from "@/components/admin/AdminAuctionArchive";
import { AdminDealerShadowGateRow } from "@/components/admin/AdminDealerShadowGate";
import { AdminDealerReviewCard, useDealerReviewScore } from "@/components/admin/AdminDealerReviewCard";
import type { AutoRecordsBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { collectSourceBlockTexts } from "@/lib/dealer-review-score";
import { checkThisRegHighlighted, checkThisRegMakeFromBlocks } from "@/lib/checkthisreg";
import { AdminCheckThisRegButton } from "@/components/admin/AdminCheckThisRegButton";

/**
 * Automātiskās dīlera datu ielases statuss pēc apmaksas + klienta saziņa.
 * Viena galvenā poga «Sūtīt klientam» (logs: kanāls, situācija, piedāvājums / atsauksme, teksts,
 * servera PDF - Nila apstiprinātais makets 19.11.2026). Sekundāri: PDF, ielase, atmaksa
 * (canRefund: Stripe cs_* vai B2B partner_id=). Zem pogām - pēdējā sūtīšana.
 */

type Props = {
  sessionId: string;
  orderVin: string;
  editable: boolean;
  /** No klienta datiem - e-pasta dialoga sākuma vērtība. */
  customerEmail?: string | null;
  /** true Stripe cs_* vai B2B manuālajam VIN (kredīts / maks). */
  canRefund?: boolean;
  /** Maka pirkums: atgriež eiro, ne kredītu. */
  walletRefund?: boolean;
  onGenerateDealerPdf?: () => void;
  onGenerateDealerPdfEn?: () => void;
  onGenerateDealerPdfRu?: () => void;
  onGenerateDealerPdfDe?: () => void;
  pdfLangLock?: PdfLockLang | null;
  onUnlockPdfLang?: () => void;
  pdfProgressKey?: string | null;
  pdfProgressPct?: number | null;
  /** B2B partnera pasūtījums: dīlera PDF e-pasts kā #323 (PROVIN, bez .LV / IRISS). */
  b2bClient?: boolean;
  reportLang?: string | null;
  walletProduct?: string | null;
  /** Servera PDF + sūtīšana no pasūtījuma darba zonas (tas pats ceļš kā «Sūtīt atskaiti»). */
  dealerSend?: DealerSendBridge | null;
  /** «Atsauksmes iespēja»: dīlera bloks (servisa ieraksti, aprīkojums) un visu avotu teksti (taxi pazīmes). */
  autoRecords?: AutoRecordsBlockState | null;
  getSourceBlocks?: () => WorkspaceSourceBlocks;
};

const STATUS_TONE: Record<DealerDataJob["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  running: "bg-sky-50 text-sky-700 border-sky-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_data: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  no_vin: "bg-rose-50 text-rose-700 border-rose-200",
};

const btn =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatRefund(job: DealerDataJob): string {
  if (!job.refund) return "";
  if (job.refund.kind === "wallet") {
    const eur = (job.refund.amountCents / 100).toFixed(2).replace(".", ",");
    return `Atgriezts partnera kontā ${eur} € · ${formatRigaIsoShort(job.refund.at)}`;
  }
  if (job.refund.kind === "credit" || job.refund.stripeRefundId.startsWith("credit_")) {
    return `Kredīts atgriezts · ${formatRigaIsoShort(job.refund.at)}`;
  }
  const eur = (job.refund.amountCents / 100).toFixed(2).replace(".", ",");
  return `Atmaksāts ${eur} € · ${formatRigaIsoShort(job.refund.at)}`;
}


export function AdminDealerDataJobStrip({
  sessionId,
  orderVin,
  editable,
  customerEmail = "",
  canRefund = false,
  walletRefund = false,
  onGenerateDealerPdf,
  onGenerateDealerPdfEn,
  onGenerateDealerPdfRu,
  onGenerateDealerPdfDe,
  pdfLangLock = null,
  onUnlockPdfLang,
  pdfProgressKey = null,
  pdfProgressPct = null,
  b2bClient = false,
  reportLang = null,
  dealerSend = null,
  autoRecords = null,
  getSourceBlocks,
}: Props) {
  const {
    job,
    loaded,
    busy,
    notice,
    setNotice,
    dialog,
    setDialog,
    marks,
    setMarks,
    rerun,
    refund,
    refundDialog,
    setRefundDialog,
    onStripeRefunded,
    refunded,
    showRefund,
    defaultSituation,
    b2bRefund,
    vin,
    shadowBusy,
    recheckShadow,
    submitShadowFeedback,
  } = useDealerDataJobControls({ sessionId, orderVin, editable, canRefund, walletRefund });
  const [archKey, setArchKey] = useState(0);

  const resolvedInitialLang = resolveDealerPdfLang(reportLang);
  // Citu avotu teksti (NL «Taxi: Ja», DK «Taxikørsel»); pārrēķina, kad mainās dīlera bloks.
  const reviewTexts = useMemo(
    () => (getSourceBlocks ? collectSourceBlockTexts(getSourceBlocks()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoRecords],
  );
  const review = useDealerReviewScore({ sessionId, job, autoRecords, vin, extraTexts: reviewTexts });

  if (!loaded) return null;

  // CheckThisReg (27.11): markām no CHECKTHISREG_STRONG_MAKES (ar gada slieksni) poga redzama vienmēr.
  const ctrMake = checkThisRegMakeFromBlocks(getSourceBlocks ? getSourceBlocks() : null, vin || orderVin);

  return (
    <section className="mb-2 rounded-lg border border-slate-200/90 bg-white px-2 py-2">
      {job ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Automātiskā ielase
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              (job.status === "no_data" && !job.refund) || dealerDataJobMissingAi(job)
                ? STATUS_TONE.failed
                : STATUS_TONE[job.status]
            }`}
          >
            {describeDealerDataJob(job)}
          </span>
          {job.aiGenerated ? (
            <span className="text-[10px] text-[var(--color-provin-muted)]">
              AI melnraksti sagatavoti
              {job.commentLang && job.commentLang !== "lv"
                ? ` (${job.commentLang === "source" ? "oriģinālvaloda" : job.commentLang.toUpperCase()})`
                : ""}
            </span>
          ) : null}
          {refunded ? (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
              {formatRefund(job)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--color-provin-muted)]">Automātiskā ielase nav palaista.</p>
      )}
      {job ? (
        <AdminDealerShadowGateRow gate={job.shadowGate} busy={shadowBusy} onRecheck={() => void recheckShadow("manual")} />
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="min-h-9 w-full rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12.5px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={busy !== null}
          onClick={() => setDialog(defaultSituation)}
        >
          Sūtīt klientam
        </button>
        <AdminClientLangChip />
      </div>
      <div className="mt-2">
        <AdminClientReportLinkControl sessionId={sessionId} />
        <AdminAuctionArchivePanel sessionId={sessionId} refreshKey={archKey} onOpenSend={() => setDialog("archive")} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {onGenerateDealerPdf ? (
          <AdminPdfLangSplitButton
            label="Ģenerēt PDF"
            disabled={busy !== null || pdfProgressKey !== null}
            busyLabel={
              pdfProgressKey === "dealer" || pdfProgressKey?.startsWith("dealer-")
                ? `${pdfProgressPct ?? 0}%`
                : null
            }
            lockLang={pdfLangLock}
            onUnlockLang={onUnlockPdfLang}
            toneClass="border border-slate-300 bg-white text-slate-700 shadow-none hover:bg-slate-50"
            dividerClass="border-slate-200"
            menuSide="down"
            onPrimary={() => onGenerateDealerPdf()}
            onLang={(lang) => {
              if (lang === "en") onGenerateDealerPdfEn?.();
              if (lang === "ru") onGenerateDealerPdfRu?.();
              if (lang === "de") onGenerateDealerPdfDe?.();
            }}
          />
        ) : null}
        {job ? (
          <button
            type="button"
            className={job.status === "failed" || job.status === "no_vin" ? `${btn} ${ADMIN_PRO_TONE.danger}` : btn}
            disabled={!editable || busy !== null}
            onClick={() => void rerun(job.status === "done" || job.status === "no_data")}
          >
            {busy === "run" ? "Ielasa…" : dealerDataRetryButtonLabel(job)}
          </button>
        ) : null}
        {ctrMake ? (
          <AdminCheckThisRegButton make={ctrMake} vin={vin || orderVin} highlighted={checkThisRegHighlighted(job?.status)} />
        ) : null}
        {showRefund ? (
          <button
            type="button"
            className={b2bRefund ? ADMIN_B2B_BTN : `${btn} ${ADMIN_PRO_TONE.danger}`}
            disabled={!editable || busy !== null}
            onClick={() => void refund()}
          >
            {b2bRefund ? (
              <AdminB2bActionLabel>
                {busy === "refund"
                  ? "Atgriež…"
                  : walletRefund
                    ? "Datu nav, atmaksa uz atlikumu"
                    : "Atgriezt kredītu"}
              </AdminB2bActionLabel>
            ) : busy === "refund" ? (
              "Atmaksā…"
            ) : (
              "Atgriezt maksājumu"
            )}
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-[10.5px] text-[var(--color-provin-muted)] [overflow-wrap:anywhere]">
        {dealerSendStatusLine(lastDealerSend(marks))}
      </p>

      {review ? (
        <AdminDealerReviewCard review={review} orderDate={job?.createdAt ? formatRigaIsoShort(job.createdAt).split(" ")[0] : undefined} />
      ) : null}

      <AdminDealerSendDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        sessionId={sessionId}
        vin={vin}
        b2b={b2bClient}
        customerEmail={(customerEmail ?? "").trim()}
        defaultSituation={dialog ?? defaultSituation}
        refundCents={refundCentsOf(job)}
        pdfLang={resolvedInitialLang}
        bridge={dealerSend}
        review={review}
        onSent={(next, msg) => {
          if (next) setMarks(next);
          setNotice(msg);
          setArchKey((k) => k + 1);
        }}
        shadow={
          job
            ? {
                gate: job.shadowGate,
                feedback: job.shadowFeedback,
                busy: shadowBusy,
                recheck: (trigger, pdf) => void recheckShadow(trigger, pdf),
                submitFeedback: (correct, note) => void submitShadowFeedback(correct, note),
              }
            : null
        }
      />

      <AdminDealerRefundDialog
        open={refundDialog}
        onClose={() => setRefundDialog(false)}
        sessionId={sessionId}
        vin={vin}
        customerEmail={(customerEmail ?? "").trim()}
        customerPhoneDigits={dealerSend?.customerPhoneDigits ?? null}
        onRefunded={onStripeRefunded}
      />

      {notice ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-provin-muted)]">{notice}</p>
      ) : null}
    </section>
  );
}
