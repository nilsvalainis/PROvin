import "server-only";

import { adminOrderFullyReversed, type AdminPaymentAdjustment } from "@/lib/admin-orders";
import { adminIngestFromDealerJob, adminIngestFromVinScan, type AdminOrderIngest } from "@/lib/admin-mobile-ingest";
import type { OrderDraftDashboardSummary } from "@/lib/admin-order-draft-summaries";
import { readDealerDataJobs } from "@/lib/dealer-data-job-store";
import {
  dealerDataJobHistoryReady,
  dealerDataJobReadyAt,
  dealerDataListAlertLabel,
  isDealerDataAutoFetchOrder,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import { dealerNotSentAlert, type OrderClientMarks } from "@/lib/order-client-marks";
import { readOrderClientMarks } from "@/lib/order-client-marks-store";

/** Pasūtījuma lauki, kas vajadzīgi ielases indikācijai (pasūtījumu saraksts un telefona «Šodien»). */
export type AdminIngestOrderRow = {
  id: string;
  created: number;
  checkoutLine?: string | null;
  amountTotal?: number | null;
  isB2bPack?: boolean;
  auditComplete?: boolean;
  paymentAdjustment?: AdminPaymentAdjustment | null;
};

export type AdminOrderIngestInfo = {
  /** Saraksta brīdinājums (Nav VIN, kļūda, «Nav nosūtīts»...). */
  dealerJobAlert: string | null;
  /** Telefona ielases indikācija. */
  ingest: AdminOrderIngest | null;
};

/**
 * Dīlera datu darbi + klienta saziņas atzīmes + VIN SCAN -> ielases indikācija katram pasūtījumam.
 * Tā pati loģika, ko lieto pasūtījumu saraksts (Nils 20.11 / 22.11 makets v3); telefona «Šodien» skaita no tās pašas.
 * Dīlera darbi tikai neizpildītiem dīlera pasūtījumiem pēdējās 60 dienās (Blob lasījumi uz rindu).
 */
export async function loadAdminOrderIngests<T extends AdminIngestOrderRow>(
  orders: readonly T[],
  draftSummaries: ReadonlyMap<string, Pick<OrderDraftDashboardSummary, "vinScan">>,
  nowMs = Date.now(),
): Promise<Map<string, AdminOrderIngestInfo>> {
  const dealerAlertSince = Math.floor(nowMs / 1000) - 60 * 24 * 3600;
  const dealerIdsForAlerts = orders
    .filter(
      (o) =>
        !o.isB2bPack &&
        !o.auditComplete &&
        o.created >= dealerAlertSince &&
        isDealerDataAutoFetchOrder({ checkoutLine: o.checkoutLine, amountTotalCents: o.amountTotal }),
    )
    .map((o) => o.id);
  const dealerJobs: Map<string, DealerDataJob> =
    dealerIdsForAlerts.length > 0
      ? await readDealerDataJobs(dealerIdsForAlerts).catch(() => new Map<string, never>())
      : new Map<string, never>();
  // Klienta saziņas atzīmes: visiem darbiem, kur dati gatavi vai «datu nav» (telefonā «Nosūtīts / Nav nosūtīts»).
  const dealerMarks = new Map<string, OrderClientMarks>();
  await Promise.all(
    [...dealerJobs.entries()]
      .filter(([, job]) => dealerDataJobHistoryReady(job) || job.status === "no_data")
      .map(async ([id]) => {
        const marks = await readOrderClientMarks(id).catch(() => null);
        if (marks) dealerMarks.set(id, marks);
      }),
  );
  // «Nav nosūtīts»: dati gatavi > 2 h, klientam nekas nav sūtīts.
  const dealerNotSent = new Set<string>();
  for (const [id, job] of dealerJobs) {
    if (dealerDataListAlertLabel(job)) continue;
    const marks = dealerMarks.get(id);
    if (marks && dealerNotSentAlert({ readyAt: dealerDataJobReadyAt(job), marks, nowMs })) {
      dealerNotSent.add(id);
    }
  }
  const dealerIdSet = new Set(dealerIdsForAlerts);
  const out = new Map<string, AdminOrderIngestInfo>();
  for (const o of orders) {
    const dealerJobAlert = dealerDataListAlertLabel(dealerJobs.get(o.id) ?? null) ?? (dealerNotSent.has(o.id) ? "Nav nosūtīts" : null);
    // Telefona saraksts: ielases indikācija (22.11 makets v3, variants 3).
    const marks = dealerMarks.get(o.id);
    const ingest = dealerIdSet.has(o.id)
      ? adminIngestFromDealerJob(dealerJobs.get(o.id) ?? null, marks ? (marks.dealerSends ?? []).length > 0 : null)
      : o.isB2bPack ||
          o.checkoutLine === "provin_select" ||
          o.checkoutLine === "consultation" ||
          isDealerDataAutoFetchOrder({ checkoutLine: o.checkoutLine, amountTotalCents: o.amountTotal })
        ? null
        : adminIngestFromVinScan(draftSummaries.get(o.id)?.vinScan ?? null, {
            complete: Boolean(o.auditComplete) || adminOrderFullyReversed(o),
          });
    out.set(o.id, { dealerJobAlert, ingest });
  }
  return out;
}
