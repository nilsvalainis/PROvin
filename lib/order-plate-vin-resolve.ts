import "server-only";

import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
  upsertOrderDraftVinPlateResolution,
} from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";
import { patchStripePaidIndexVin } from "@/lib/admin-stripe-paid-index";
import { isCsddTransientFailure, type CsddTechDataResult } from "@/lib/csdd-tech-data";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { enqueueDealerDataJob } from "@/lib/dealer-data-job";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import { ensureOrderDropboxFolderSafe } from "@/lib/order-dropbox";
import { hasIso3779CheckDigit } from "@/lib/vin-iso3779";
import {
  isPlaceholderVin,
  isValidVin,
  normalizePlateNumber,
  normalizeVin,
} from "@/lib/order-field-validation";
import {
  classifyOrderVinOrPlateInput,
  type OrderVinPlateResolution,
} from "@/lib/order-vin-plate-resolution";
import { startOrderAutoIntake } from "@/lib/order-auto-intake";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";

export type ResolveOrderVinFromPlateResult = {
  ok: boolean;
  effectiveVin: string | null;
  resolution: OrderVinPlateResolution | null;
  skipped?: boolean;
  reason?: string;
};

/**
 * CSDD atgrieztais VIN der pasūtījumam tikai, ja: 17 zīmes bez I/O/Q, nav aizstājējs (000…),
 * un Ziemeļamerikas VIN (1.-5. zīme) - ar pareizu ISO 3779 kontrolciparu. Eiropas VIN kontrolciparu
 * bieži nelieto, tāpēc tam to neprasa.
 */
export function usableResolvedVin(raw: string): string {
  const v = normalizeVin(raw);
  if (!v || !isValidVin(v) || isPlaceholderVin(v)) return "";
  if (/^[1-5]/.test(v) && !hasIso3779CheckDigit(v)) return "";
  return v;
}

function intakeFromDraftAndStripe(
  draftVin: string | undefined,
  stripeVin: string | null | undefined,
): ReturnType<typeof classifyOrderVinOrPlateInput> {
  const fromDraft = draftVin?.trim() ? classifyOrderVinOrPlateInput(draftVin) : { kind: "invalid" as const };
  if (fromDraft.kind !== "invalid") return fromDraft;
  return classifyOrderVinOrPlateInput(stripeVin ?? "");
}

async function persistPlateSeed(
  sessionId: string,
  plate: string,
  orderEdits: OrderDraftOrderEdits,
): Promise<void> {
  await patchOrderDraft(
    sessionId,
    {
      orderEdits: {
        ...orderEdits,
        licensePlate: plate,
        vin: "",
      },
    },
    { force: true },
  );
}

/**
 * Pārejošai kļūdai (VPN pārslēgšanās ~15-20 s, relejs 502, taimauts) - atkārtojumi tajā pašā izsaukumā.
 * 26.11.2026 pasūtījums krita tieši CSDD VPN «Idle Timeout» pārslēgšanās sekundē.
 */
export const PLATE_VIN_RETRY_DELAYS_MS: readonly number[] = [0, 8_000, 20_000];
/** «pending» svaigāks par šo = cita palaišana jau vaicā CSDD; otru vaicājumu nesūtām. */
export const PLATE_VIN_PENDING_LOCK_MS = 3 * 60 * 1000;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Ja pasūtījumā ir tikai LV numurzīme, CSDD serviss atgriež VIN un to ieraksta melnrakstā.
 * Neveiksme: statuss `failed` ar `failKind`, numurzīme redzama adminā, pasūtījums paliek saglabāts.
 * Idempotents: «resolved» vairs nevaicā; svaigs «pending» (cita palaišana) - arī ne, pat ar `force`.
 */
export async function resolveOrderVinFromPlate(
  sessionId: string,
  opts: {
    stripeVin?: string | null;
    listingUrl?: string | null;
    force?: boolean;
    fetchCsdd?: (nr1: string) => Promise<CsddTechDataResult>;
    runDownstream?: boolean;
    retryDelaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    nowMs?: () => number;
  } = {},
): Promise<ResolveOrderVinFromPlateResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return { ok: false, effectiveVin: null, resolution: null, reason: "invalid_session" };
  }

  const fetchCsdd = opts.fetchCsdd ?? ((nr1: string) => fetchCsddTechDataCounted(nr1, "admin"));
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.nowMs ?? Date.now;
  const delays = opts.retryDelaysMs ?? PLATE_VIN_RETRY_DELAYS_MS;
  const prev = await readOrderDraft(sessionId);
  const prevResolution = prev?.vinPlateResolution ?? null;

  if (prevResolution?.status === "resolved") {
    const vin = usableResolvedVin(prev?.orderEdits?.vin ?? "") || usableResolvedVin(opts.stripeVin ?? "");
    if (vin || !opts.force) {
      if (vin && opts.runDownstream) await runOrderDownstreamAfterPlateVin(sessionId, { vin, listingUrl: opts.listingUrl });
      return {
        ok: true,
        effectiveVin: vin || null,
        resolution: prevResolution,
        skipped: true,
        reason: "already_resolved",
      };
    }
  }

  if (prevResolution?.status === "pending") {
    const t = Date.parse(prevResolution.updatedAt);
    if (Number.isFinite(t) && now() - t < PLATE_VIN_PENDING_LOCK_MS) {
      return { ok: true, effectiveVin: null, resolution: prevResolution, skipped: true, reason: "in_progress" };
    }
  }

  const intake = intakeFromDraftAndStripe(prev?.orderEdits?.vin, opts.stripeVin);
  if (intake.kind === "vin") {
    const vin = intake.vin;
    if (prev?.orderEdits?.licensePlate) {
      await patchOrderDraft(sessionId, { orderEdits: { vin } }, { force: true }).catch(() => null);
    }
    return { ok: true, effectiveVin: vin, resolution: prevResolution, skipped: true, reason: "already_vin" };
  }
  if (intake.kind === "invalid") {
    return { ok: false, effectiveVin: null, resolution: prevResolution, reason: "invalid_intake" };
  }

  const plate = intake.plate;
  const prevAttempts = prevResolution?.plate === plate ? (prevResolution.attempts ?? 0) : 0;
  const pending: OrderVinPlateResolution = {
    plate,
    status: "pending",
    attempts: prevAttempts,
    updatedAt: new Date(now()).toISOString(),
  };
  await upsertOrderDraftVinPlateResolution(sessionId, pending);

  const orderEditsSeed: OrderDraftOrderEdits = {
    ...(prev?.orderEdits ?? {}),
    licensePlate: plate,
    vin: "",
  };
  await persistPlateSeed(sessionId, plate, orderEditsSeed);

  let csdd: CsddTechDataResult = { found: false, message: "CSDD netika vaicāts" };
  let attempts = prevAttempts;
  for (let i = 0; i < Math.max(1, delays.length); i++) {
    if (i > 0 && (delays[i] ?? 0) > 0) await sleep(delays[i]!);
    try {
      csdd = await fetchCsdd(plate);
    } catch {
      csdd = { found: false, message: "Neizdevās sasniegt CSDD releju" };
    }
    attempts += 1;
    if (csdd.found || !isCsddTransientFailure(csdd)) break;
    console.warn("[plate→vin] CSDD pārejoša kļūda", { sessionId, attempt: i + 1, message: csdd.message });
  }
  const at = new Date(now()).toISOString();

  const vin = csdd.found ? usableResolvedVin(csdd.data.vin) : "";
  if (vin && csdd.found) {
    const resolved: OrderVinPlateResolution = { plate, status: "resolved", attempts, updatedAt: at };
    await upsertOrderDraftVinPlateResolution(sessionId, resolved);
    await patchOrderDraft(
      sessionId,
      { orderEdits: { ...orderEditsSeed, vin, licensePlate: normalizePlateNumber(csdd.data.registrationNumber) || plate } },
      { force: true },
    );
    await patchStripePaidIndexVin(sessionId, vin).catch(() => null);

    if (opts.runDownstream) await runOrderDownstreamAfterPlateVin(sessionId, { vin, listingUrl: opts.listingUrl });

    return { ok: true, effectiveVin: vin, resolution: resolved };
  }

  const failKind = !csdd.found && isCsddTransientFailure(csdd) ? "unreachable" : "not_found";
  const detail = csdd.found ? (csdd.data.vin ? "CSDD atgrieztais VIN nav derīgs" : "CSDD atbildē nav VIN") : csdd.message;
  const failed: OrderVinPlateResolution = {
    plate,
    status: "failed",
    failKind,
    attempts,
    message: detail.slice(0, 400),
    updatedAt: at,
  };
  await upsertOrderDraftVinPlateResolution(sessionId, failed);
  await patchOrderDraft(
    sessionId,
    { orderEdits: { ...orderEditsSeed, licensePlate: plate, vin: "" } },
    { force: true },
  );
  await syncDealerNoVinJob(sessionId, failed).catch((err) => console.error("[plate→vin] dealer job sync:", err));

  return { ok: true, effectiveVin: null, resolution: failed };
}

/** Dīlera darbs ar «Nav VIN»: atjauno kļūdu (redzama adminā), numurzīmi un mēģinājumu skaitu. */
async function syncDealerNoVinJob(sessionId: string, failed: OrderVinPlateResolution): Promise<void> {
  const job = await readDealerDataJob(sessionId);
  if (!job || job.status !== "no_vin" || job.vin.trim()) return;
  await upsertDealerDataJob(sessionId, {
    vin: "",
    status: "no_vin",
    plate: failed.plate,
    error: dealerNoVinErrorCode(failed),
    plateAttempts: (job.plateAttempts ?? 0) + 1,
    nextRetryAt: new Date(Date.now() + DEALER_NO_VIN_RETRY_MS).toISOString(),
  });
}

/** Dīlera darba kļūdas kods: `csdd_unreachable` (cron atkārtos) vai `vin_not_found`. */
export function dealerNoVinErrorCode(failed: Pick<OrderVinPlateResolution, "failKind">): string {
  return failed.failKind === "unreachable" ? "csdd_unreachable" : "vin_not_found";
}

/** Cron atkārto «CSDD nebija sasniedzams» ne biežāk kā ik 10 min. */
export const DEALER_NO_VIN_RETRY_MS = 10 * 60 * 1000;

/**
 * Pēc atrastā VIN - tā pati plūsma kā pasūtījumam ar VIN: bezmaksas avotu sēkla (CSDD, sludinājums,
 * EE/DK/SE), tad automātika pēc apmaksas (bezmaksas VIN SCAN + imports blokos + push), dīlera datu ielase (tikai, ja pasūtījumam jau ir dīlera darbs),
 * Dropbox mapes nosaukums ar VIN. Citus maksas avotus šeit nepalaiž.
 */
export async function runOrderDownstreamAfterPlateVin(
  sessionId: string,
  args: { vin: string; listingUrl?: string | null },
): Promise<{ dealerQueued: boolean }> {
  const vin = args.vin;
  const listingUrl =
    args.listingUrl?.trim() ||
    (await readOrderDraft(sessionId).catch(() => null))?.orderEdits?.listingUrl?.trim() ||
    "";
  const dealerJob = await readDealerDataJob(sessionId).catch(() => null);
  const dealerQueue =
    dealerJob && (dealerJob.status === "no_vin" || !dealerJob.vin.trim())
      ? enqueueDealerDataJob({ sessionId, vin, cronAfterMs: 0 }).catch((err) => {
          console.error("[plate→vin] dealer enqueue:", err);
          return false;
        })
      : Promise.resolve(false);
  // Tā pati secība kā Stripe webhook (#1225): vispirms CSDD/bezmaksas sēkla, tad automātika pēc apmaksas
  // (VIN SCAN ar LV numurzīmi + imports blokos + push). Automātika ir idempotenta (viena reize pasūtījumam + VIN).
  const intakeRun = (async () => {
    await seedPaidOrderAutoSources(sessionId, { vin, listingUrl }).catch((err) =>
      console.error("[plate→vin] seed:", err),
    );
    await startOrderAutoIntake(sessionId, { vin, listingUrl, skipPush: Boolean(dealerJob) }).catch((err) =>
      console.error("[plate→vin] auto intake:", err),
    );
  })();
  const [dealerQueued] = await Promise.all([dealerQueue, intakeRun]);
  await ensureOrderDropboxFolderSafe(sessionId, { vin });
  return { dealerQueued };
}

/** Stripe webhook / operatora pasūtījums: sākotnējie orderEdits no sesijas laukiem. */
export async function ensureOrderDraftEditsFromCheckoutFields(
  sessionId: string,
  fields: {
    vinOrPlate: string | null;
    listingUrl?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    customerName?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  if (!isSafeOrderDraftSessionId(sessionId)) return;
  const prev = await readOrderDraft(sessionId);
  const prevEdits = prev?.orderEdits ?? {};
  const intake = classifyOrderVinOrPlateInput(fields.vinOrPlate ?? "");
  const orderEdits: OrderDraftOrderEdits = { ...prevEdits };

  if (intake.kind === "vin" && !prevEdits.vin?.trim()) {
    orderEdits.vin = intake.vin;
  } else if (intake.kind === "plate") {
    if (!prevEdits.licensePlate?.trim()) orderEdits.licensePlate = intake.plate;
    if (!prevEdits.vin?.trim() || !isValidVin(prevEdits.vin)) orderEdits.vin = "";
  }

  const setIfEmpty = (key: Exclude<keyof OrderDraftOrderEdits, "adminNote">, value: string | null | undefined) => {
    const cur = typeof prevEdits[key] === "string" ? (prevEdits[key] as string).trim() : "";
    const next = value?.trim() ?? "";
    if (!cur && next) orderEdits[key] = next;
  };

  setIfEmpty("listingUrl", fields.listingUrl);
  setIfEmpty("customerEmail", fields.customerEmail);
  setIfEmpty("customerPhone", fields.customerPhone);
  setIfEmpty("customerName", fields.customerName);
  setIfEmpty("notes", fields.notes);

  if (JSON.stringify(orderEdits) === JSON.stringify(prevEdits)) return;
  await patchOrderDraft(sessionId, { orderEdits }, { force: true });
}

/**
 * Cron: «Nav VIN» dīlera darbs, kur CSDD nebija sasniedzams - vēlreiz numurzīme → VIN.
 * Atrasts - dīlera darbs rindā (nākamais cron to ielasa) + bezmaksas avoti; neatrasts - kļūda un
 * nākamais mēģinājums pēc 10 min līdz griestiem (`dealerNoVinAutoRetryable`).
 */
export async function retryDealerNoVinFromPlate(job: { sessionId: string; plate?: string }): Promise<{
  status: string;
  reason: string;
}> {
  const plate = job.plate?.trim() ?? "";
  if (!plate) return { status: "no_vin", reason: "no_plate" };
  const r = await resolveOrderVinFromPlate(job.sessionId, { stripeVin: plate, runDownstream: true });
  if (r.effectiveVin) return { status: "pending", reason: "plate_vin_resolved" };
  return { status: "no_vin", reason: r.reason ?? r.resolution?.failKind ?? "vin_not_found" };
}
