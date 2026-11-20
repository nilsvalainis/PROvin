"use client";

import { formatRigaIsoShort } from "@/lib/riga-datetime";
import { ADMIN_PRO_TONE } from "@/lib/admin-pro-tones";
import { useCallback, useEffect, useState } from "react";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import {
  DEALER_REFUND_EMAIL_CHOICE_PROMPT,
  dealerRefundResultNotice,
  planDealerRefund,
  shouldOpenDealerRefundEmailSheet,
  shouldShowDealerRefundButton,
} from "@/lib/admin-dealer-data-refund";
import {
  DEALER_DATA_RETRY_NO_RECHARGE_HINT,
  dealerDataRetryButtonLabel,
  describeDealerDataJob,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import type { DealerSendSituation } from "@/lib/dealer-send-message";
import { dealerSendStatusLine, lastDealerSend, type OrderClientMarks } from "@/lib/order-client-marks";
import { ADMIN_B2B_BTN, AdminB2bActionLabel } from "@/components/admin/AdminB2bAction";
import { AdminPdfLangSplitButton, type PdfLockLang } from "@/components/admin/AdminPdfLangSplitButton";
import { AdminDealerSendDialog, type DealerSendBridge } from "@/components/admin/AdminDealerSendDialog";

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

function refundCentsOf(job: DealerDataJob | null): number | null {
  if (!job?.refund) return null;
  if (job.refund.kind === "credit" || job.refund.stripeRefundId.startsWith("credit_")) return null;
  return job.refund.amountCents;
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
}: Props) {
  const [job, setJob] = useState<DealerDataJob | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "run" | "refund">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DealerSendSituation | null>(null);
  const [marks, setMarks] = useState<OrderClientMarks | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/admin/dealer-data?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { job?: DealerDataJob | null };
      setJob(body.job ?? null);
    } catch {
      /* statusa josla nav kritiska operatora darbam */
    } finally {
      setLoaded(true);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    void fetch(`/api/admin/order-client-marks?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { marks?: OrderClientMarks } | null) => setMarks(d?.marks ?? null))
      .catch(() => undefined);
  }, [sessionId]);

  useEffect(() => {
    if (job?.status !== "pending" && job?.status !== "running") return;
    // Tikai redzamā cilnē (telefonā fonā netērē tīklu).
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => clearInterval(t);
  }, [job?.status, load]);

  const vin = job?.vin || orderVin;

  const resolvedInitialLang: ClientReportLang = (CLIENT_REPORT_LANGS as readonly string[]).includes(
    (reportLang ?? "").trim().toLowerCase(),
  )
    ? ((reportLang ?? "").trim().toLowerCase() as ClientReportLang)
    : "lv";

  const rerun = async (force: boolean) => {
    if (!editable || busy) return;
    if (force && !window.confirm(DEALER_DATA_RETRY_NO_RECHARGE_HINT)) {
      return;
    }
    setBusy("run");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dealer-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, vin: orderVin, force }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        job?: DealerDataJob | null;
        reason?: string;
      };
      setJob(body.job ?? null);
      setNotice(body.reason ?? null);
    } catch {
      setNotice("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  const refund = async () => {
    if (!editable || busy || !canRefund) return;
    const plan = planDealerRefund({ sessionId, walletRefund, job });
    if (!window.confirm(plan.confirmMessage)) {
      return;
    }
    // C2: viens e-pasts - operators izvēlas, vai atmaksa iet ar e-pastu.
    const requestBody =
      plan.kind === "stripe"
        ? { ...plan.requestBody, notifyEmail: window.confirm(DEALER_REFUND_EMAIL_CHOICE_PROMPT) }
        : plan.requestBody;
    setBusy("refund");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dealer-data/refund", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        emailSent?: boolean;
        emailError?: string;
        job?: DealerDataJob | null;
      };
      if (body.job) setJob(body.job);
      const ok = Boolean(body.ok);
      setNotice(
        dealerRefundResultNotice({
          kind: plan.kind,
          ok,
          emailSent: body.emailSent,
          emailError: body.emailError,
          error: body.error,
          emailSkipped: requestBody.notifyEmail === false && plan.kind === "stripe",
        }),
      );
      if (
        requestBody.notifyEmail !== false &&
        shouldOpenDealerRefundEmailSheet({ kind: plan.kind, ok, emailSent: body.emailSent })
      ) {
        setDialog("no_data");
      }
    } catch {
      setNotice("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) return null;

  const refunded = Boolean(job?.refund);
  const showRefund = shouldShowDealerRefundButton({ canRefund, job });
  const defaultSituation: DealerSendSituation =
    job?.status === "no_data" ? "no_data" : refunded ? "cancelled" : "ready";
  const b2bRefund = walletRefund || sessionId.startsWith("manual_order_");

  return (
    <section className="mb-2 rounded-lg border border-slate-200/90 bg-white px-2 py-2">
      {job ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Automātiskā ielase
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[job.status]}`}
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

      <div className="mt-2">
        <button
          type="button"
          className="min-h-9 w-full rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12.5px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={busy !== null}
          onClick={() => setDialog(defaultSituation)}
        >
          Sūtīt klientam
        </button>
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

      <p className="mt-1.5 text-[10.5px] text-[var(--color-provin-muted)]">
        {dealerSendStatusLine(lastDealerSend(marks))}
      </p>

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
        onSent={(next, msg) => {
          if (next) setMarks(next);
          setNotice(msg);
        }}
      />

      {notice ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-provin-muted)]">{notice}</p>
      ) : null}
    </section>
  );
}
