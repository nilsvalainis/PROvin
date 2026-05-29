import type { AdminOrderDetailClientModel } from "@/components/admin/AdminOrderDetailView";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function numOrZero(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

function attachmentList(v: unknown): { label: string; fileName: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const label = str(o.label);
      const fileName = str(o.fileName);
      if (!label && !fileName) return null;
      return { label, fileName };
    })
    .filter((x): x is { label: string; fileName: string } => x != null);
}

/** Normalizē Stripe / demo pasūtījumu props klienta komponentam. */
export function toAdminOrderDetailClientModel(order: Record<string, unknown>): AdminOrderDetailClientModel {
  return {
    id: str(order.id) || "unknown",
    created: numOrZero(order.created),
    amountTotal: numOrNull(order.amountTotal),
    currency: str(order.currency) || null,
    paymentStatus: str(order.paymentStatus) || "unknown",
    customerEmail: str(order.customerEmail) || null,
    customerDetailsEmail: str(order.customerDetailsEmail) || null,
    phone: str(order.phone) || null,
    customerDetailsPhone: str(order.customerDetailsPhone) || null,
    customerName: str(order.customerName) || null,
    contactMethod: str(order.contactMethod) || null,
    vin: str(order.vin) || null,
    listingUrl: str(order.listingUrl) || null,
    notes: str(order.notes) || null,
    internalComment: str(order.internalComment) || null,
    attachments: attachmentList(order.attachments),
    isDemo: Boolean(order.isDemo),
    selectBrandModel: str(order.selectBrandModel) || null,
    selectProductionYearsDpf: str(order.selectProductionYearsDpf) || null,
    selectPlannedBudget: str(order.selectPlannedBudget) || null,
    selectEngineType: str(order.selectEngineType) || null,
    selectTransmission: str(order.selectTransmission) || null,
    selectMaxMileage: str(order.selectMaxMileage) || null,
    selectExteriorColor: str(order.selectExteriorColor) || null,
    selectInteriorMaterial: str(order.selectInteriorMaterial) || null,
    selectRequiredEquipment: str(order.selectRequiredEquipment) || null,
    selectDesiredEquipment: str(order.selectDesiredEquipment) || null,
  };
}
