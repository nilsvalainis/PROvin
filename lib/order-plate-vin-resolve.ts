import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
  upsertOrderDraftVinPlateResolution,
} from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";
import { patchStripePaidIndexVin } from "@/lib/admin-stripe-paid-index";
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import {
  isPlaceholderVin,
  isValidVin,
  normalizePlateNumber,
  normalizeVin,
} from "@/lib/order-field-validation";
import {
  classifyOrderVinOrPlateInput,
  type OrderVinPlateResolution,
  VIN_PLATE_RESOLVE_FAILED_LABEL,
} from "@/lib/order-vin-plate-resolution";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";

export type ResolveOrderVinFromPlateResult = {
  ok: boolean;
  effectiveVin: string | null;
  resolution: OrderVinPlateResolution | null;
  skipped?: boolean;
  reason?: string;
};

function usableResolvedVin(raw: string): string {
  const v = normalizeVin(raw);
  return v && isValidVin(v) && !isPlaceholderVin(v) ? v : "";
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
 * Ja pasūtījumā ir tikai LV numurzīme, CSDD serviss atgriež VIN un to ieraksta melnrakstā.
 * Neveiksme: statuss `failed`, numurzīme redzama adminā, pasūtījums paliek saglabāts.
 */
export async function resolveOrderVinFromPlate(
  sessionId: string,
  opts: {
    stripeVin?: string | null;
    listingUrl?: string | null;
    force?: boolean;
    fetchCsdd?: (nr1: string) => Promise<CsddTechDataResult>;
    runDownstream?: boolean;
  } = {},
): Promise<ResolveOrderVinFromPlateResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return { ok: false, effectiveVin: null, resolution: null, reason: "invalid_session" };
  }

  const fetchCsdd = opts.fetchCsdd ?? ((nr1: string) => fetchCsddTechDataCounted(nr1, "admin"));
  const prev = await readOrderDraft(sessionId);
  const prevResolution = prev?.vinPlateResolution ?? null;

  if (!opts.force && prevResolution?.status === "resolved") {
    const vin = usableResolvedVin(prev?.orderEdits?.vin ?? "") || usableResolvedVin(opts.stripeVin ?? "");
    return {
      ok: true,
      effectiveVin: vin || null,
      resolution: prevResolution,
      skipped: true,
      reason: "already_resolved",
    };
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
  const pending: OrderVinPlateResolution = {
    plate,
    status: "pending",
    updatedAt: new Date().toISOString(),
  };
  await upsertOrderDraftVinPlateResolution(sessionId, pending);

  const orderEditsSeed: OrderDraftOrderEdits = {
    ...(prev?.orderEdits ?? {}),
    licensePlate: plate,
    vin: "",
  };
  await persistPlateSeed(sessionId, plate, orderEditsSeed);

  const csdd = await fetchCsdd(plate);
  const now = new Date().toISOString();

  if (csdd.found && usableResolvedVin(csdd.data.vin)) {
    const vin = usableResolvedVin(csdd.data.vin);
    const resolved: OrderVinPlateResolution = { plate, status: "resolved", updatedAt: now };
    await upsertOrderDraftVinPlateResolution(sessionId, resolved);
    await patchOrderDraft(
      sessionId,
      { orderEdits: { ...orderEditsSeed, vin, licensePlate: normalizePlateNumber(csdd.data.registrationNumber) || plate } },
      { force: true },
    );
    await patchStripePaidIndexVin(sessionId, vin).catch(() => null);

    if (opts.runDownstream) {
      const listingUrl = opts.listingUrl?.trim() ?? "";
      await Promise.allSettled([
        seedPaidOrderAutoSources(sessionId, { vin, listingUrl }),
        runOrderFreeVinScan(sessionId, { vin, listingUrl }),
      ]);
    }

    return { ok: true, effectiveVin: vin, resolution: resolved };
  }

  const failed: OrderVinPlateResolution = {
    plate,
    status: "failed",
    message: csdd.found ? "CSDD atbildē nav VIN" : csdd.message || VIN_PLATE_RESOLVE_FAILED_LABEL,
    updatedAt: now,
  };
  await upsertOrderDraftVinPlateResolution(sessionId, failed);
  await patchOrderDraft(
    sessionId,
    { orderEdits: { ...orderEditsSeed, licensePlate: plate, vin: "" } },
    { force: true },
  );

  return { ok: true, effectiveVin: null, resolution: failed };
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

  const setIfEmpty = (key: keyof OrderDraftOrderEdits, value: string | null | undefined) => {
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
