"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEALER_REFUND_EMAIL_CHOICE_PROMPT,
  dealerRefundResultNotice,
  planDealerRefund,
  shouldOpenDealerRefundEmailSheet,
  shouldShowDealerRefundButton,
} from "@/lib/admin-dealer-data-refund";
import { DEALER_DATA_RETRY_NO_RECHARGE_HINT, type DealerDataJob } from "@/lib/dealer-data-job-types";
import type { DealerSendSituation } from "@/lib/dealer-send-message";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import type { OrderClientMarks } from "@/lib/order-client-marks";

/**
 * Dīlera datu darba stāvoklis + darbības (ielasīt vēlreiz, atmaksa, sūtīšanas logs).
 * Viena loģika gan dīlera blokam (dators + telefons), gan telefona B1 blokam lapas augšā.
 * Abas vietas sinhronizē notikums `provin-dealer-job` (darbs / atzīmes mainījās vienā - otra atjaunojas).
 */

/** Dīlera PDF valoda: partnera izvēlētā, citādi LV. */
export function resolveDealerPdfLang(reportLang: string | null | undefined): ClientReportLang {
  const l = (reportLang ?? "").trim().toLowerCase();
  return (CLIENT_REPORT_LANGS as readonly string[]).includes(l) ? (l as ClientReportLang) : "lv";
}

/** Sūtīšanas logam: atmaksātā summa centos (kredīta atgriešanai - null). */
export function dealerRefundCentsOf(job: DealerDataJob | null): number | null {
  if (!job?.refund) return null;
  if (job.refund.kind === "credit" || job.refund.stripeRefundId.startsWith("credit_")) return null;
  return job.refund.amountCents;
}

export const DEALER_JOB_SYNC_EVENT = "provin-dealer-job";

type SyncDetail = { sessionId: string; job?: DealerDataJob | null; marks?: OrderClientMarks | null };

function broadcast(detail: SyncDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<SyncDetail>(DEALER_JOB_SYNC_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

export function useDealerDataJobControls({
  sessionId,
  orderVin,
  editable,
  canRefund = false,
  walletRefund = false,
}: {
  sessionId: string;
  orderVin: string;
  editable: boolean;
  canRefund?: boolean;
  walletRefund?: boolean;
}) {
  const [job, setJobState] = useState<DealerDataJob | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "run" | "refund">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DealerSendSituation | null>(null);
  const [marks, setMarksState] = useState<OrderClientMarks | null>(null);

  const setJob = useCallback(
    (next: DealerDataJob | null) => {
      setJobState(next);
      broadcast({ sessionId, job: next });
    },
    [sessionId],
  );
  const setMarks = useCallback(
    (next: OrderClientMarks | null) => {
      setMarksState(next);
      broadcast({ sessionId, marks: next });
    },
    [sessionId],
  );

  useEffect(() => {
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<SyncDetail>).detail;
      if (!d || d.sessionId !== sessionId) return;
      if ("job" in d) setJobState(d.job ?? null);
      if ("marks" in d) setMarksState(d.marks ?? null);
    };
    window.addEventListener(DEALER_JOB_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DEALER_JOB_SYNC_EVENT, onSync);
  }, [sessionId]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/admin/dealer-data?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { job?: DealerDataJob | null };
      setJobState(body.job ?? null);
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
      .then((d: { marks?: OrderClientMarks } | null) => setMarksState(d?.marks ?? null))
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

  /**
   * Ēnu režīms: kvalitātes pārbaude vēlreiz (tikai spriedums, neko nesūta).
   * `pdf` - servera PDF ceļš no sūtīšanas formas (pārbaude (f) salīdzina VIN).
   */
  const [shadowBusy, setShadowBusy] = useState(false);
  const recheckShadow = useCallback(
    async (trigger: "manual" | "send_dialog" | "pdf" = "manual", pdf?: { pathname: string } | null) => {
      if (!sessionId) return;
      setShadowBusy(true);
      try {
        const res = await fetch("/api/admin/dealer-data/shadow-gate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, trigger, ...(pdf ? { pdf } : {}) }),
        });
        const body = (await res.json().catch(() => ({}))) as { job?: DealerDataJob | null };
        if (body.job) setJob(body.job);
      } catch {
        /* pārbaude nav kritiska sūtīšanai */
      } finally {
        setShadowBusy(false);
      }
    },
    [sessionId, setJob],
  );
  const submitShadowFeedback = useCallback(
    async (correct: boolean, note: string) => {
      if (!sessionId) return;
      setShadowBusy(true);
      try {
        const res = await fetch("/api/admin/dealer-data/shadow-feedback", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, correct, note }),
        });
        const body = (await res.json().catch(() => ({}))) as { job?: DealerDataJob | null };
        if (body.job) setJob(body.job);
      } catch {
        /* atsauksme nav kritiska */
      } finally {
        setShadowBusy(false);
      }
    },
    [sessionId, setJob],
  );

  const refunded = Boolean(job?.refund);
  const showRefund = shouldShowDealerRefundButton({ canRefund, job });
  const defaultSituation: DealerSendSituation =
    job?.status === "no_data" ? "no_data" : refunded ? "cancelled" : "ready";
  const b2bRefund = walletRefund || sessionId.startsWith("manual_order_");

  return {
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
    refunded,
    showRefund,
    defaultSituation,
    b2bRefund,
    vin: job?.vin || orderVin,
    shadowBusy,
    recheckShadow,
    submitShadowFeedback,
  };
}
