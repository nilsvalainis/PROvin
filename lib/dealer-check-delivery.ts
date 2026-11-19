/**
 * Dīlera datu platforma (Nils 19.11): AUTO RECORDS bloks (tas pats, ko pasūtījuma dīlera PDF lieto)
 * un piegādes (servera PDF, Autoparks + STOCK, e-pasts) UI palīgi.
 * Tīra loģika bez I/O: droši gan serverī (PDF), gan klientā («Lielie darbi» redaktors).
 */
import { emptyAutoRecordsBlock, type AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock, type OneautoBlockState } from "@/lib/oneauto-block";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import { extractDealerFactsFromServiceWorks, type DealerFacts } from "@/lib/admin-ai-dealer-facts";
import type { DealerCheckDelivery, DealerCheckRecord } from "@/lib/dealer-check";
import { formatRigaIsoShort } from "@/lib/riga-datetime";

export function dealerCheckAutoRecords(record: DealerCheckRecord): AutoRecordsBlockState {
  const ingest = {
    ...emptyOneautoIngest(),
    lastFetchedVin: record.vin,
    fetchedAt: record.fetchedAt,
    selectedProducts: record.selectedProducts,
    lastCostEur: (record.chargedCents / 100).toFixed(2),
    results: record.results,
    serviceTimelineOriginal: record.displayOriginal.serviceTimeline,
  };
  return applyOneautoToAutoRecords(emptyAutoRecordsBlock(), {
    display: record.display,
    ingest,
    notes: {
      serviceHistoryNotes: record.comments.serviceHistory,
      oilChangeIntervalNotes: record.comments.oilIntervals,
      comments: record.comments.serviceHistory,
    },
    vehicleOverride: true,
  });
}

export function dealerCheckOneautoBlock(record: DealerCheckRecord): OneautoBlockState {
  return {
    ...emptyOneautoBlock(),
    lastFetchedVin: record.vin,
    fetchedAt: record.fetchedAt,
    selectedProducts: record.selectedProducts,
    results: record.results,
    display: record.display,
    serviceHistoryNotes: record.comments.serviceHistory,
    oilChangeIntervalNotes: record.comments.oilIntervals,
  };
}

/** «Lielie darbi» redaktoram - tie paši fakti, ko PDF lieto. */
export function dealerCheckDealerFacts(record: DealerCheckRecord): DealerFacts {
  const block = dealerCheckAutoRecords(record);
  return extractDealerFactsFromServiceWorks(block.serviceWorks ?? [], record.displayOriginal.serviceTimeline);
}

export const DEALER_CHECK_DELIVER_PATH = "/api/admin/dealer-check/deliver" as const;
export const DEALER_CHECK_SERVER_PDF_PATH = "/api/admin/dealer-check/server-pdf" as const;

export function dealerCheckServerPdfHref(id: string): string {
  return `${DEALER_CHECK_SERVER_PDF_PATH}?id=${encodeURIComponent(id)}`;
}

export function dealerCheckDeliveryErrorLv(code: string): string {
  switch (code) {
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    case "not_found":
      return "Pārbaude nav saglabāta sarakstā.";
    case "not_in_autoparks":
      return "Auto ar šo VIN nav Autoparkā.";
    case "save_failed":
      return "Neizdevās saglabāt Autoparka dokumentos.";
    case "not_linked":
      return "Dropbox STOCK mape nav atrasta - fails tur netika ielikts.";
    case "upload_failed":
      return "Dropbox STOCK augšupielāde neizdevās.";
    case "verify_failed":
      return "Dropbox STOCK failu pēc augšupielādes neizdevās pārbaudīt.";
    case "invalid_email":
      return "Nederīga e-pasta adrese.";
    case "recipient_blocked":
      return "Šai adresei sūtīšana ir bloķēta.";
    case "missing_text":
      return "Vajag tematu un tekstu.";
    case "smtp_not_configured":
      return "Serverī nav SMTP.";
    case "not_confirmed":
      return "Sūtīšana nav apstiprināta.";
    default:
      return "Neizdevās. Mēģini vēlreiz.";
  }
}

export function dealerCheckDeliveryLine(d: DealerCheckDelivery): string {
  const when = formatRigaIsoShort(d.at);
  if (d.kind === "email") return `${when} · e-pasts · ${d.target}`;
  return `${when} · Autoparks${d.path ? " + STOCK" : ""} · ${d.target}`;
}
