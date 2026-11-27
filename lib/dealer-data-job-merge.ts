/**
 * Dīlera darba ieraksta sapludināšana (tīra funkcija, bez server-only) - lieto CAS `upsert`.
 * - oneautoResults: `mergeOneautoProductResults` (ok nekad netiek pārrakstīts ar pending/kļūdu);
 * - VIN maiņa: vecā VIN rezultāti un iznākumi tiek nolikti `archived`, nevis sapludināti;
 * - atmaksa ir neatgriezeniska.
 */
import {
  DEALER_DATA_MAX_AUTO_ATTEMPTS,
  dealerNoVinAutoRetryable,
  mergeDealerPaidOutcomes,
  type DealerDataJob,
  type DealerDataJobStatus,
} from "@/lib/dealer-data-job-types";
import { parseResultMap } from "@/lib/oneauto-block";
import { mergeOneautoProductResults } from "@/lib/oneauto-to-auto-records";

export type DealerDataJobPatch = Partial<Omit<DealerDataJob, "sessionId">> & { vin: string };

function resultsRecord(map: ReturnType<typeof parseResultMap>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, row] of Object.entries(map)) if (row != null) out[id] = row;
  return out;
}

export function mergeDealerDataJobPatch(
  sessionId: string,
  currentIn: DealerDataJob | null,
  patch: DealerDataJobPatch,
  now: string = new Date().toISOString(),
): DealerDataJob {
  const vin = patch.vin.trim().toUpperCase();
  const vinChanged = Boolean(currentIn && currentIn.vin.trim() && vin && currentIn.vin.trim().toUpperCase() !== vin);
  // VIN maiņa: vecā VIN maksas dati nedrīkst nonākt jaunā VIN ielasē.
  const archived = vinChanged
    ? [
        ...(currentIn!.archived ?? []),
        {
          vin: currentIn!.vin,
          at: now,
          ...(currentIn!.paidOutcomes ? { paidOutcomes: currentIn!.paidOutcomes } : {}),
          ...(currentIn!.oneautoResults ? { oneautoResults: currentIn!.oneautoResults } : {}),
        },
      ].slice(-5)
    : currentIn?.archived;
  const current: DealerDataJob | null =
    currentIn && vinChanged
      ? {
          ...currentIn,
          paidOutcomes: undefined,
          oneautoResults: undefined,
          serviceEventCount: undefined,
          aiGenerated: undefined,
          draftWrittenAt: undefined,
          pendingRequestId: undefined,
          pendingRetries: undefined,
          shadowGate: undefined,
          shadowFeedback: undefined,
          attempts: 0,
        }
      : currentIn;

  const mergedResults =
    patch.oneautoResults || current?.oneautoResults
      ? resultsRecord(
          mergeOneautoProductResults(parseResultMap(current?.oneautoResults), parseResultMap(patch.oneautoResults)),
        )
      : undefined;
  const status: DealerDataJobStatus = patch.status ?? current?.status ?? "pending";
  const terminalOrRunning = patch.status === "done" || patch.status === "no_data" || patch.status === "running";

  return {
    sessionId,
    vin,
    status,
    attempts: patch.attempts ?? current?.attempts ?? 0,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    ...(patch.startedAt ?? current?.startedAt ? { startedAt: patch.startedAt ?? current?.startedAt } : {}),
    ...(patch.finishedAt ?? current?.finishedAt ? { finishedAt: patch.finishedAt ?? current?.finishedAt } : {}),
    ...(patch.serviceEventCount !== undefined
      ? { serviceEventCount: patch.serviceEventCount }
      : current?.serviceEventCount !== undefined
        ? { serviceEventCount: current.serviceEventCount }
        : {}),
    ...(patch.aiGenerated !== undefined
      ? { aiGenerated: patch.aiGenerated }
      : current?.aiGenerated !== undefined
        ? { aiGenerated: current.aiGenerated }
        : {}),
    ...(patch.error ? { error: patch.error } : terminalOrRunning ? {} : current?.error ? { error: current.error } : {}),
    ...(patch.trigger ?? current?.trigger ? { trigger: patch.trigger ?? current?.trigger } : {}),
    ...(patch.paidOutcomes || current?.paidOutcomes
      ? { paidOutcomes: mergeDealerPaidOutcomes(current?.paidOutcomes, patch.paidOutcomes) }
      : {}),
    ...(patch.skipTranslate !== undefined
      ? { skipTranslate: patch.skipTranslate }
      : current?.skipTranslate !== undefined
        ? { skipTranslate: current.skipTranslate }
        : {}),
    ...(patch.commentLang ?? current?.commentLang ? { commentLang: patch.commentLang ?? current?.commentLang } : {}),
    ...(mergedResults ? { oneautoResults: mergedResults } : {}),
    ...(patch.plate ?? current?.plate ? { plate: patch.plate ?? current?.plate } : {}),
    ...(patch.plateAttempts ?? current?.plateAttempts
      ? { plateAttempts: patch.plateAttempts ?? current?.plateAttempts }
      : {}),
    // Pabeigtam / skrienošam darbam nākamā mēģinājuma laiks vairs nav aktuāls.
    ...(terminalOrRunning
      ? {}
      : patch.nextRetryAt ?? current?.nextRetryAt
        ? { nextRetryAt: patch.nextRetryAt ?? current?.nextRetryAt }
        : {}),
    ...(patch.pendingRetries ?? current?.pendingRetries
      ? { pendingRetries: patch.pendingRetries ?? current?.pendingRetries }
      : {}),
    // OneAuto servera kļūmju cikls: pabeigtam darbam (done / no_data) vairs nav aktuāls; 0 notīra.
    ...(patch.status === "done" || patch.status === "no_data"
      ? {}
      : patch.upstreamRetries ?? current?.upstreamRetries
        ? { upstreamRetries: patch.upstreamRetries ?? current?.upstreamRetries }
        : {}),
    // runId: patch ar "" atbrīvo nomu; pabeigts darbs nomu neglabā.
    ...(patch.status === "done" || patch.status === "no_data" || patch.runId === ""
      ? {}
      : patch.runId ?? current?.runId
        ? { runId: patch.runId ?? current?.runId }
        : {}),
    ...(patch.draftWrittenAt ?? current?.draftWrittenAt
      ? { draftWrittenAt: patch.draftWrittenAt ?? current?.draftWrittenAt }
      : {}),
    ...(patch.pendingRequestId === ""
      ? {}
      : patch.pendingRequestId ?? current?.pendingRequestId
        ? { pendingRequestId: patch.pendingRequestId ?? current?.pendingRequestId }
        : {}),
    ...(archived?.length ? { archived } : {}),
    ...(patch.alert ?? current?.alert ? { alert: patch.alert ?? current?.alert } : {}),
    // Ēnu režīms: jaunākais spriedums / atsauksme; VIN maiņā abi nomesti (sk. augstāk).
    ...(patch.shadowGate ?? current?.shadowGate ? { shadowGate: patch.shadowGate ?? current?.shadowGate } : {}),
    ...(patch.shadowFeedback ?? current?.shadowFeedback
      ? { shadowFeedback: patch.shadowFeedback ?? current?.shadowFeedback }
      : {}),
    // Atmaksa ir neatgriezeniska: reizi ierakstītu ierakstu patch nedrīkst nomest.
    // emailSentAt drīkst pievienot vēlāk (viens e-pasts uz atmaksu).
    ...(current?.refund || patch.refund
      ? {
          refund: {
            ...(current?.refund ?? patch.refund!),
            ...(patch.refund?.emailSentAt && !current?.refund?.emailSentAt
              ? { emailSentAt: patch.refund.emailSentAt }
              : {}),
          },
        }
      : {}),
  };
}

/** Statusi, kas cron slaucītājam vēl jāpārņem. */
const UNFINISHED: readonly DealerDataJobStatus[] = ["pending", "running", "failed", "retry_wait"];

/**
 * Vai darbs paliek slaucīšanas indeksā. Gala kļūda (≥3 mēģinājumi) ar jau nosūtītu admina
 * paziņojumu vairs netiek slaucīta - to risina operators.
 */
export function dealerDataJobBelongsInSweepIndex(
  job: Pick<DealerDataJob, "status" | "attempts" | "alert"> &
    Partial<Pick<DealerDataJob, "error" | "plate" | "plateAttempts" | "refund" | "createdAt" | "vin">>,
): boolean {
  // «CSDD nebija sasniedzams»: cron vēlreiz mēģina numurzīme → VIN.
  if (job.status === "no_vin") {
    return dealerNoVinAutoRetryable({
      status: job.status,
      error: job.error,
      plate: job.plate,
      plateAttempts: job.plateAttempts,
      refund: job.refund,
      createdAt: job.createdAt ?? "",
      vin: job.vin ?? "",
    });
  }
  if (!UNFINISHED.includes(job.status)) return false;
  if (job.status === "failed" && job.attempts >= DEALER_DATA_MAX_AUTO_ATTEMPTS && job.alert) return false;
  return true;
}
