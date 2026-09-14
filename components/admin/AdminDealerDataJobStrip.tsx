"use client";

import { useCallback, useEffect, useState } from "react";

import {
  whatsappPrefillDealerNoDataRefunded,
  whatsappPrefillDealerPaymentCancelled,
} from "@/lib/admin-whatsapp-messages";
import { describeDealerDataJob, type DealerDataJob } from "@/lib/dealer-data-job-types";

/**
 * Automātiskās dīlera datu ielases statuss pēc apmaksas.
 * Refund poga parādās tikai tad, kad OneAuto apstiprināja, ka datu par VIN nav.
 */

type Props = {
  sessionId: string;
  orderVin: string;
  editable: boolean;
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
  const eur = (job.refund.amountCents / 100).toFixed(2).replace(".", ",");
  return `Atmaksāts ${eur} € · ${job.refund.at.slice(0, 16).replace("T", " ")}`;
}

export function AdminDealerDataJobStrip({ sessionId, orderVin, editable }: Props) {
  const [job, setJob] = useState<DealerDataJob | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "run" | "refund">(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Kamēr ielase notiek fonā, atsvaidzinām, lai operatoram nav jāpārlādē lapa.
  useEffect(() => {
    if (job?.status !== "pending" && job?.status !== "running") return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [job?.status, load]);

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
    if (!editable || busy || !job) return;
    const eur = "pilnā apmērā";
    if (!window.confirm(`Atgriezt maksājumu ${eur}? Darbība ir neatgriezeniska.`)) return;
    const notifyEmail = window.confirm("Nosūtīt klientam paziņojuma e-pastu par atmaksu?");
    setBusy("refund");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/dealer-data/refund", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, notifyEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        emailSent?: boolean;
        job?: DealerDataJob | null;
      };
      if (body.job) setJob(body.job);
      setNotice(
        body.ok
          ? `Atmaksa veikta.${notifyEmail ? (body.emailSent ? " E-pasts nosūtīts." : " E-pasts neizdevās.") : ""}`
          : `Atmaksa neizdevās: ${body.error ?? "nezināma kļūda"}`,
      );
    } catch {
      setNotice("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  const copyTemplate = async (cancelled: boolean) => {
    const text = cancelled
      ? whatsappPrefillDealerPaymentCancelled(job?.vin ?? orderVin)
      : whatsappPrefillDealerNoDataRefunded(job?.vin ?? orderVin);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Šablons nokopēts.");
    } catch {
      setNotice("Kopēšana neizdevās.");
    }
  };

  if (!loaded || !job) return null;

  const refunded = Boolean(job.refund);

  return (
    <section className="mb-2 rounded-lg border border-slate-200/90 bg-white px-2 py-2">
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

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={!editable || busy !== null}
          onClick={() => void rerun(job.status === "done" || job.status === "no_data")}
        >
          {busy === "run" ? "Ielasa…" : "Ielasīt vēlreiz"}
        </button>
        {job.status === "no_data" && !refunded ? (
          <button
            type="button"
            className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`}
            disabled={!editable || busy !== null}
            onClick={() => void refund()}
          >
            {busy === "refund" ? "Atmaksā…" : "Atgriezt maksājumu"}
          </button>
        ) : null}
        <button type="button" className={btn} onClick={() => void copyTemplate(false)}>
          WhatsApp: nav datu
        </button>
        <button type="button" className={btn} onClick={() => void copyTemplate(true)}>
          WhatsApp: atcelts
        </button>
      </div>

      {notice ? (
        <p className="mt-1.5 text-[10px] text-[var(--color-provin-muted)]">{notice}</p>
      ) : null}
    </section>
  );
}
