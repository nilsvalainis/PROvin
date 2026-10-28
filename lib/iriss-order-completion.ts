/**
 * Pasūtījuma aizpildījums pa soļiem (Nils 28.10, makets Pārskats v3): kas aizpildīts un kas trūkst.
 * Tīra loģika - tikai lasa laukus.
 */
import { irissOrderRangeView } from "@/lib/iriss-order-range-fields";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissOrderStepStatus = { done: boolean; missing: string[] };

const filled = (v: unknown) => typeof v === "string" && v.trim() !== "" && v.trim() !== "-";

export function irissOrderStepStatuses(rec: IrissPasutijumsRecord): IrissOrderStepStatus[] {
  const r = irissOrderRangeView(rec) as Record<string, string>;
  const need = (pairs: Array<[string, boolean]>): IrissOrderStepStatus => {
    const missing = pairs.filter(([, ok]) => !ok).map(([label]) => label);
    return { done: missing.length === 0, missing };
  };
  return [
    need([
      ["Marka / modelis", filled(rec.brandModel)],
      ["Virsbūve", filled(rec.bodyType)],
    ]),
    need([["Budžets", filled(r.budgetTo) || filled(r.budgetFrom) || filled(rec.totalBudget)]]),
    need([
      ["Gadi", filled(r.yearFrom) || filled(r.yearTo)],
      ["Nobraukums", filled(r.mileageTo) || filled(r.mileageFrom)],
      ["Degviela", filled(rec.engineType)],
      ["Ātrumkārba", filled(rec.transmission)],
    ]),
    need([["Bojājumi", filled(rec.damageTolerance)]]),
    need([["Prasības", filled(rec.equipmentRequired) || filled(rec.equipmentDesired)]]),
    need([["Krāsas", filled(rec.preferredColors) || filled(rec.nonPreferredColors) || filled(rec.interiorFinish)]]),
    need([["Piezīmes", filled(rec.notes) || filled(rec.agentNotes) || filled(rec.internalNotes)]]),
    need([
      ["Vārds", filled(rec.clientFirstName) || filled(rec.clientLastName)],
      ["Tālrunis", filled(rec.phone)],
    ]),
  ];
}

/** Augšējā josla: soļi 1-7 (kontakti - atsevišķi) un trūkstošo lauku saraksts. */
export function irissOrderProgress(rec: IrissPasutijumsRecord): { done: number; total: number; missing: string[] } {
  const steps = irissOrderStepStatuses(rec).slice(0, 7);
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    missing: steps.flatMap((s) => s.missing),
  };
}

/** Piezīmes aģentam un iekšējās - viens lauks (Nils 28.10); abu vecie teksti saglabājas kopā. */
export function irissMergedInternalNotes(rec: Pick<IrissPasutijumsRecord, "agentNotes" | "internalNotes">): string {
  return [rec.agentNotes, rec.internalNotes]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** WhatsApp lietotne datorā (whatsapp://), ne pārlūka wa.me. */
export function irissWhatsAppAppHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  const full = digits.length === 8 && /^[26]/.test(digits) ? `371${digits}` : digits;
  return `whatsapp://send?phone=${full}`;
}
