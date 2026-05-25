import {
  OUTVIN_CATALOG_SLOTS,
  inferSlotAvailability,
  type OutvinCatalogSlot,
} from "@/lib/outvin-source-catalog";
import {
  emptyOutvinDataBundle,
  hasOutvinPurchaseForType,
  type OutvinCapabilitySlotUi,
  type OutvinDataBundle,
} from "@/lib/outvin-data-bundle";
import { normalizeVin } from "@/lib/order-field-validation";

function slotToUi(slot: OutvinCatalogSlot, vin: string, bundle: OutvinDataBundle): OutvinCapabilitySlotUi {
  const purchased = hasOutvinPurchaseForType(bundle, slot.historyType);
  const { status, reason } = inferSlotAvailability(slot, vin, purchased);
  return {
    id: slot.id,
    historyType: slot.historyType,
    titleLv: slot.titleLv,
    creditCost: slot.creditCost,
    status,
    statusReason: reason,
    category: slot.category,
  };
}

export function buildOutvinCapabilitySlots(vin: string, bundle: OutvinDataBundle): OutvinCapabilitySlotUi[] {
  return OUTVIN_CATALOG_SLOTS.map((slot) => slotToUi(slot, vin, bundle));
}

/** Bezmaksas pārbaude — VIN heuristika (bez history / vehicle API). */
export function applyOutvinPrecheckMetadata(
  vin: string,
  existing?: OutvinDataBundle | null,
): OutvinDataBundle {
  const normalized = normalizeVin(vin);
  const base = existing ? { ...existing, vin: normalized } : emptyOutvinDataBundle(normalized);
  base.precheckAt = new Date().toISOString();
  base.capabilitySlots = buildOutvinCapabilitySlots(normalized, base);
  return base;
}
