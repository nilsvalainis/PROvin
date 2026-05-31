import type { CarVerticalDamageDetailRow } from "@/lib/carvertical-pdf-parse";

export type CarVerticalIncidentMatchInput = {
  csngDate: string;
  incidentNo: string;
  lossAmount?: string;
};

/** Sasaista CarVertical negadījuma rindu ar bojājumu detaļām (datums + valsts, pēc vajadzības summa). */
export function matchCarVerticalDamageDetail(
  incident: CarVerticalIncidentMatchInput,
  damageDetails: CarVerticalDamageDetailRow[] | null | undefined,
): CarVerticalDamageDetailRow | undefined {
  const rows = (damageDetails ?? []).filter(
    (r) => r.date.trim() || r.damagedSides.trim() || r.damageGroups.trim() || r.lossAmount.trim(),
  );
  if (rows.length === 0) return undefined;

  const date = incident.csngDate.trim();
  const country = incident.incidentNo.trim();
  const countryLower = country.toLowerCase();
  const loss = incident.lossAmount?.trim() ?? "";

  if (date && country) {
    const exact = rows.find(
      (r) =>
        r.date.trim() === date &&
        (r.country.trim().toLowerCase() === countryLower ||
          countryLower.includes(r.country.trim().toLowerCase()) ||
          r.country.trim().toLowerCase().includes(countryLower)),
    );
    if (exact) return exact;
  }

  if (date && loss) {
    const lossDigits = loss.replace(/\D/g, "").slice(0, 4);
    if (lossDigits.length >= 3) {
      const byLoss = rows.find((r) => {
        if (r.date.trim() !== date) return false;
        const rowLoss = r.lossAmount.replace(/\D/g, "").slice(0, 4);
        return rowLoss.length >= 3 && rowLoss === lossDigits;
      });
      if (byLoss) return byLoss;
    }
  }

  if (date) {
    const byDate = rows.filter((r) => r.date.trim() === date);
    if (byDate.length === 1) return byDate[0];
  }

  return undefined;
}
