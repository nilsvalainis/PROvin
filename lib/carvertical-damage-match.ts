import type { CarVerticalDamageDetailRow } from "@/lib/carvertical-pdf-parse";
import { cleanDateStr } from "@/lib/clean-date-str";

export type CarVerticalIncidentMatchInput = {
  csngDate: string;
  incidentNo: string;
  lossAmount?: string;
};

function datesEqual(a: string, b: string): boolean {
  return cleanDateStr(a.trim()) === cleanDateStr(b.trim());
}

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
        datesEqual(r.date, date) &&
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
        if (!datesEqual(r.date, date)) return false;
        const rowLoss = r.lossAmount.replace(/\D/g, "").slice(0, 4);
        return rowLoss.length >= 3 && rowLoss === lossDigits;
      });
      if (byLoss) return byLoss;
    }
  }

  if (date) {
    const byDate = rows.filter((r) => datesEqual(r.date, date));
    if (byDate.length === 1) return byDate[0];
  }

  return undefined;
}
