"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillDealerPaymentCancelled,
} from "@/lib/admin-whatsapp-messages";
import {
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
  buildDealerReadyEmailDraft,
  type DealerClientEmailKind,
} from "@/lib/dealer-data-client-email";
import { describeDealerDataJob, type DealerDataJob } from "@/lib/dealer-data-job-types";
import { isValidOrderEmail } from "@/lib/order-field-validation";

/**
 * Automātiskās dīlera datu ielases statuss pēc apmaksas + klienta saziņa.
 * WA un e-pasts vienmēr redzami; atmaksa tikai Stripe cs_* + no_data.
 */

type Props = {
  sessionId: string;
  orderVin: string;
  editable: boolean;
  /** No klienta datiem - e-pasta dialoga sākuma vērtība. */
  customerEmail?: string | null;
  /** true tikai Stripe Checkout sesijām (cs_…). Manuāliem refund pogu nerāda. */
  canRefund?: boolean;
  onGenerateDealerPdf?: () => void;
};

const STATUS_TONE: Record<DealerDataJob["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  running: "bg-sky-50 text-sky-700 border-sky-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_data: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const btn =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatRefund(job: DealerDataJob): string {
  if (!job.refund) return "";
  if (job.refund.kind === "credit" || job.refund.stripeRefundId.startsWith("credit_")) {
    return `Kredīts atgriezts · ${job.refund.at.slice(0, 16).replace("T", " ")}`;
  }
  const eur = (job.refund.amountCents / 100).toFixed(2).replace(".", ",");
  return `Atmaksāts ${eur} € · ${job.refund.at.slice(0, 16).replace("T", " ")}`;
}

function refundAmountEur(job: DealerDataJob | null): string | null {
  if (!job?.refund) return null;
  if (job.refund.kind === "credit" || job.refund.stripeRefundId.startsWith("credit_")) {
    return "1 kredīts";
  }
  return `${(job.refund.amountCents / 100).toFixed(2)} €`;
}

type MailSheet = {
  mode: "message" | "pdf";
  kind: DealerClientEmailKind;
};

export function AdminDealerDataJobStrip({
  sessionId,
  orderVin,
  editable,
  customerEmail = "",
  canRefund = false,
  onGenerateDealerPdf,
}: Props) {
  const [job, setJob] = useState<DealerDataJob | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "run" | "refund" | "email" | "pdf">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<MailSheet | null>(null);
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailText, setMailText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

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
    if (job?.status !== "pending" && job?.status !== "running") return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [job?.status, load]);

  const vin = job?.vin || orderVin;

  const openMail = (mode: MailSheet["mode"], kind: DealerClientEmailKind) => {
    const draft =
      kind === "cancelled"
        ? buildDealerCancelledEmailDraft({ vin, amountEur: refundAmountEur(job) })
        : kind === "ready"
          ? buildDealerReadyEmailDraft({ vin })
          : buildDealerNoDataEmailDraft({
              vin,
              amountEur: refundAmountEur(job),
              refunded: Boolean(job?.refund),
            });
    setMailTo((customerEmail ?? "").trim());
    setMailSubject(draft.subject);
    setMailText(draft.text);
    setPdfFile(null);
    setSheet({ mode, kind });
    setNotice(null);
  };

  const rerun = async (force: boolean) => {
    if (!editable || busy) return;
    if (force && !window.confirm("Ielasīt OE servisa vēsturi vēlreiz? Tas atkārtoti iekasēs 3,00 €.")) {
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
    if (!editable || busy || !job || !canRefund) return;
    const isCredit = sessionId.startsWith("manual_order_");
    if (
      !window.confirm(
        isCredit
          ? "Atgriezt 1 dīlera kredītu partnera kontā? E-pastu sūti atsevišķi ar „Nosūtīt e-pastu”."
          : "Atgriezt maksājumu pilnā apmērā? Darbība ir neatgriezeniska. E-pastu sūti atsevišķi ar „Nosūtīt e-pastu”.",
      )
    ) {
      return;
    }
    setBusy("refund");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dealer-data/refund", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, notifyEmail: false }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        job?: DealerDataJob | null;
      };
      if (body.job) setJob(body.job);
      setNotice(
        body.ok
          ? isCredit
            ? "Kredīts atgriezts partnera kontā. Nosūti e-pastu ar „Nosūtīt e-pastu”, ja vajag."
            : "Atmaksa veikta. Nosūti e-pastu ar „Nosūtīt e-pastu”, ja vajag."
          : `Atmaksa neizdevās: ${body.error ?? "nezināma kļūda"}`,
      );
      if (body.ok) {
        const amount =
          body.job?.refund != null
            ? `${(body.job.refund.amountCents / 100).toFixed(2)} €`
            : refundAmountEur(job);
        const draft = buildDealerNoDataEmailDraft({
          vin: body.job?.vin || vin,
          amountEur: amount,
          refunded: true,
        });
        setMailTo((customerEmail ?? "").trim());
        setMailSubject(draft.subject);
        setMailText(draft.text);
        setPdfFile(null);
        setSheet({ mode: "message", kind: "no_data" });
      }
    } catch {
      setNotice("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  const copyTemplate = async (cancelled: boolean) => {
    const text = cancelled
      ? whatsappPrefillDealerPaymentCancelled(vin)
      : whatsappPrefillDealerNoDataRefunded(vin);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("WhatsApp šablons nokopēts.");
    } catch {
      setNotice("Kopēšana neizdevās.");
    }
  };

  const sendMail = async () => {
    if (!sheet || busy) return;
    const to = mailTo.trim();
    if (!isValidOrderEmail(to)) {
      setNotice("Nepieciešams derīgs klienta e-pasts.");
      return;
    }
    if (!mailSubject.trim() || !mailText.trim()) {
      setNotice("Aizpildi tematu un tekstu.");
      return;
    }

    if (sheet.mode === "pdf") {
      if (!pdfFile || pdfFile.size <= 0) {
        setNotice("Pievieno dīlera PDF (vispirms „Ģenerēt dīlera PDF”, tad saglabā un izvēlies failu).");
        return;
      }
      setBusy("pdf");
      setNotice(null);
      try {
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("customerEmail", to);
        fd.append("subject", mailSubject.trim());
        fd.append("text", mailText.trim());
        fd.append("reportPdf", pdfFile, pdfFile.name || "dealer.pdf");
        const res = await fetch("/api/admin/dealer-data/send-pdf", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
          to?: string;
        };
        if (!res.ok || !body.ok) {
          setNotice(body.message || body.error || `Nosūtīšana neizdevās (${res.status}).`);
          return;
        }
        setNotice(`Dīlera PDF nosūtīts uz ${body.to ?? to}.`);
        setSheet(null);
      } catch {
        setNotice("Neizdevās sazināties ar serveri.");
      } finally {
        setBusy(null);
      }
      return;
    }

    setBusy("email");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dealer-data/notify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerEmail: to,
          subject: mailSubject.trim(),
          text: mailText.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        to?: string;
      };
      if (!res.ok || !body.ok) {
        setNotice(body.message || body.error || `Nosūtīšana neizdevās (${res.status}).`);
        return;
      }
      setNotice(`E-pasts nosūtīts uz ${body.to ?? to}.`);
      setSheet(null);
    } catch {
      setNotice("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  const sheetTitle = useMemo(() => {
    if (!sheet) return "";
    if (sheet.mode === "pdf") return "Nosūtīt dīlera PDF";
    if (sheet.kind === "cancelled") return "Nosūtīt e-pastu (atcelts)";
    return "Nosūtīt e-pastu (nav datu)";
  }, [sheet]);

  if (!loaded) return null;

  const refunded = Boolean(job?.refund);
  const showRefund = Boolean(job && job.status === "no_data" && !refunded && canRefund);

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
            <span className="text-[10px] text-[var(--color-provin-muted)]">AI melnraksti sagatavoti</span>
          ) : null}
          {refunded ? (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
              {formatRefund(job)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Automātiskā ielase nav palaista (vai nav dīlera Stripe pasūtījums). WA un e-pasts pieejami manuāli.
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {job ? (
          <button
            type="button"
            className={btn}
            disabled={!editable || busy !== null}
            onClick={() => void rerun(job.status === "done" || job.status === "no_data")}
          >
            {busy === "run" ? "Ielasa…" : "Ielasīt vēlreiz"}
          </button>
        ) : null}
        {showRefund ? (
          <button
            type="button"
            className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}
            disabled={!editable || busy !== null}
            onClick={() => void refund()}
          >
            {busy === "refund"
              ? sessionId.startsWith("manual_order_")
                ? "Atgriež…"
                : "Atmaksā…"
              : sessionId.startsWith("manual_order_")
                ? "Atgriezt kredītu"
                : "Atgriezt maksājumu"}
          </button>
        ) : null}

        <button type="button" className={btn} onClick={() => void copyTemplate(false)}>
          WhatsApp: nav datu
        </button>
        <button type="button" className={btn} onClick={() => void copyTemplate(true)}>
          WhatsApp: atcelts
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={() => openMail("message", "no_data")}
        >
          Nosūtīt e-pastu
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={() => openMail("message", "cancelled")}
        >
          E-pasts: atcelts
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Piegāde</span>
        {onGenerateDealerPdf ? (
          <button type="button" className={btn} disabled={busy !== null} onClick={() => onGenerateDealerPdf()}>
            Ģenerēt dīlera PDF
          </button>
        ) : null}
        <button
          type="button"
          className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}
          disabled={busy !== null}
          onClick={() => openMail("pdf", "ready")}
        >
          Nosūtīt dīlera PDF
        </button>
      </div>

      {sheet ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={sheetTitle}
          onClick={() => {
            if (busy === null) setSheet(null);
          }}
        >
          <div
            className="max-h-[min(92vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{sheetTitle}</h3>
              <button
                type="button"
                className={btn}
                disabled={busy !== null}
                onClick={() => setSheet(null)}
              >
                Aizvērt
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-provin-muted)]">
              Tekstu vari papildināt vai labot pirms sūtīšanas. Atmaksa šajā dialogā nenotiek.
            </p>

            <label className="mt-3 block text-[10px] font-medium text-slate-500">Klienta e-pasts</label>
            <input
              type="email"
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px]"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              disabled={busy !== null}
            />

            <label className="mt-2 block text-[10px] font-medium text-slate-500">Temats</label>
            <input
              type="text"
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px]"
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              disabled={busy !== null}
            />

            <label className="mt-2 block text-[10px] font-medium text-slate-500">Teksts</label>
            <textarea
              className="mt-0.5 min-h-[160px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px] leading-relaxed"
              value={mailText}
              onChange={(e) => setMailText(e.target.value)}
              disabled={busy !== null}
            />

            {sheet.mode === "pdf" ? (
              <div className="mt-2">
                <label className="block text-[10px] font-medium text-slate-500">Dīlera PDF fails</label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="mt-0.5 block w-full text-[11px]"
                  disabled={busy !== null}
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-[10px] text-[var(--color-provin-muted)]">
                  1) „Ģenerēt dīlera PDF” → Drukāt → Saglabāt kā PDF. 2) Izvēlies failu šeit. 3) Nosūti.
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap justify-end gap-1.5">
              <button type="button" className={btn} disabled={busy !== null} onClick={() => setSheet(null)}>
                Atcelt
              </button>
              <button
                type="button"
                className={`${btn} border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
                disabled={busy !== null}
                onClick={() => void sendMail()}
              >
                {busy === "email" || busy === "pdf" ? "Sūta…" : "Nosūtīt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-provin-muted)]">{notice}</p>
      ) : null}
    </section>
  );
}
