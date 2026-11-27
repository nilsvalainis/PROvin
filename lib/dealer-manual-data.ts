/**
 * Dīlera dati pasūtījumā ir, bet darba statuss saka «datu nav» (BF 27.11, S7).
 *
 * Renault pasūtījums: OneAuto atbildēja «datu nav» (`no_data`), operators dīlera datus ievadīja
 * manuāli no dīlera PDF (servisa tabula + komentārs), bet darbs palika «Dīlera dati nav pieejami ·
 * Gaida atmaksas apstiprinājumu» - adminā rādījās atmaksas ieteikums, lai gan dati klientam ir.
 *
 * Statusu pārrēķina pēc reālajiem melnraksta datiem: ja servisa tabulā / dīlera ierakstos ir rindas,
 * `no_data` kļūst par «Ielasīts» (manuāli). Nauda netiek kustināta: atmaksa nekad nenotiek automātiski,
 * un jau atmaksātu vai atmaksas procesā esošu pasūtījumu neaiztiek.
 * Tīra funkcija (bez server-only) - testējama.
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import type { DealerDataJobPatch } from "@/lib/dealer-data-job-merge";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinDealerServiceRowHasData } from "@/lib/outvin-data-bundle";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";

type AutoRecordsDealerView = Pick<AutoRecordsBlockState, "serviceWorks" | "serviceHistory" | "comments" | "oilChangeIntervalNotes"> &
  Partial<AutoRecordsBlockState>;

/** Cik dīlera ierakstu (vizīšu) melnrakstā ir - servisa tabula, dīlera žurnāls vai nobraukuma rindas. */
export function countDealerRowsInAutoRecords(ar: AutoRecordsDealerView | null | undefined): number {
  if (!ar) return 0;
  const works = printableDealerServiceWorks(ar.serviceWorks ?? []).length;
  let log = 0;
  try {
    log = getAutoRecordsOutvinBundle(ar as AutoRecordsBlockState).dealerServiceLog.filter(outvinDealerServiceRowHasData).length;
  } catch {
    log = 0;
  }
  const history = (ar.serviceHistory ?? []).filter(
    (r) => (r?.date ?? "").trim() && (r?.odometer ?? "").replace(/\D/g, ""),
  ).length;
  return Math.max(works, log, history);
}

/**
 * Darba ieraksta labojums, ja `no_data` darbam melnrakstā tomēr ir dīlera dati; citādi null.
 * Atmaksāts / atmaksa ceļā - nekad (naudas lēmums jau pieņemts).
 */
export function dealerJobPatchForDraftData(
  job: Pick<DealerDataJob, "vin" | "status" | "refund" | "refundPendingAt"> | null | undefined,
  ar: AutoRecordsDealerView | null | undefined,
  nowIso: string = new Date().toISOString(),
): DealerDataJobPatch | null {
  if (!job || job.status !== "no_data" || job.refund || job.refundPendingAt) return null;
  if (!job.vin.trim()) return null;
  const rows = countDealerRowsInAutoRecords(ar);
  if (rows <= 0) return null;
  const hasText =
    Boolean(adminRichHtmlToPlainText(ar?.comments ?? "").trim()) ||
    Boolean(adminRichHtmlToPlainText(ar?.oilChangeIntervalNotes ?? "").trim());
  return {
    vin: job.vin,
    status: "done",
    serviceEventCount: rows,
    finishedAt: nowIso,
    // Dati ievadīti ar roku (ne OneAuto) - operatora darbs, ne automātikas «AI nav ģenerēts».
    trigger: "manual",
    ...(hasText ? { aiGenerated: true } : {}),
  };
}
