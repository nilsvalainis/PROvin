import { formatIrissWaybillChip, irissWaybillUrgent } from "@/lib/admin-mobile-ds";

const HOUR_MS = 60 * 60 * 1000;

export type IrissWaybillMobileBarItem = {
  id: string;
  label: string;
  urgent: boolean;
};

/** Kompakta mobilā josla: „B192-7 Audi 6 h”. Pildīts čips, ja mazāk par 24 h (bez sarkanas/zaļas). */
export function irissWaybillMobileBarItems(
  rows: readonly { id: string; plate?: string; number?: string; brandModel?: string; validUntil: string }[],
  now = new Date(),
): IrissWaybillMobileBarItem[] {
  return rows.map((row) => {
    const until = Date.parse(row.validUntil);
    const remaining = Number.isFinite(until) ? until - now.getTime() : -1;
    const hoursLeft = remaining <= 0 ? 0 : Math.max(0, Math.round(remaining / HOUR_MS));
    const label = formatIrissWaybillChip({
      code: (row.number ?? "").trim() || (row.plate ?? "").trim(),
      makeModel: row.brandModel,
      hoursLeft,
    });
    return {
      id: row.id,
      label: label || "Pavadzīme",
      urgent: irissWaybillUrgent(hoursLeft),
    };
  });
}
