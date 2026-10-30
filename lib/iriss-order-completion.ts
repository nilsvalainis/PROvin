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
    // Nils 30.10: 1. Meklēšanas filtri (obligātie «*» lauki).
    need([
      ["Marka / modelis", filled(rec.brandModel)],
      ["Gadi", filled(r.yearFrom) || filled(r.yearTo)],
      ["Nobraukums", filled(r.mileageTo) || filled(r.mileageFrom)],
      ["Budžets", filled(r.budgetTo) || filled(r.budgetFrom) || filled(rec.totalBudget)],
      ["Degviela", filled(rec.engineType)],
      ["Ātrumkārba", filled(rec.transmission)],
      ["Virsbūve", filled(rec.bodyType)],
    ]),
    need([["Budžetā iekļauts", filled(rec.budgetIncludes)]]),
    need([["Prasības", filled(rec.equipmentRequired) || filled(rec.equipmentDesired)]]),
    need([["Krāsas", filled(rec.preferredColors) || filled(rec.nonPreferredColors) || filled(rec.interiorFinish)]]),
    need([["Piezīmes", filled(rec.notes) || filled(rec.agentNotes) || filled(rec.internalNotes)]]),
    need([
      ["Vārds", filled(rec.clientFirstName) || filled(rec.clientLastName)],
      ["Tālrunis", filled(rec.phone)],
    ]),
  ];
}

/** Augšējā josla: soļi bez pēdējā (kontakti - atsevišķi) un trūkstošo lauku saraksts. */
export function irissOrderProgress(rec: IrissPasutijumsRecord): { done: number; total: number; missing: string[] } {
  const steps = irissOrderStepStatuses(rec).slice(0, -1);
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    missing: steps.flatMap((s) => s.missing),
  };
}

/** Piezīmes aģentam un iekšējās - viens lauks (Nils 28.10); abu vecie teksti saglabājas kopā. */
export function irissMergedInternalNotes(rec: Pick<IrissPasutijumsRecord, "agentNotes" | "internalNotes">): string {
  // Nils 29.10: nedrīkst apgriezt - rakstot atstarpe teksta beigās citādi pazūd pēc katra burta.
  return [rec.agentNotes, rec.internalNotes]
    .map((x) => x ?? "")
    .filter((x) => x.trim())
    .join("\n\n");
}

/** WhatsApp lietotne datorā (whatsapp://), ne pārlūka wa.me. */
export function irissWhatsAppAppHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  const full = digits.length === 8 && /^[26]/.test(digits) ? `371${digits}` : digits;
  return `whatsapp://send?phone=${full}`;
}
