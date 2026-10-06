/**
 * Ražotāja eļļas intervāls šim motoram, un krāsu skala pret to.
 *
 * Zaļa ≤ OEM (+5 % nobraukuma rezerve).
 * Oranža līdz 1,30 × OEM.
 * Sarkana virs 1,30 × OEM, ja solis joprojām ir dīlera dati (nav iztrūkums).
 * Pelēka tikai datu iztrūkumam. Bez OEM nav zaļa/oranža/sarkana: neitrāla zila.
 *
 * Pilsētas 10 000 km griesti ir komentāra tēma, ne krāsu OEM.
 */

export type OemOilInterval = {
  km: number;
  months: number | null;
};

export type OilRatioTone = "ok" | "warn" | "stretch" | "neutral";

/** +5 % pret odometra noapaļojumu. */
export const OIL_OEM_GREEN_RATIO = 1.05;
/** Virs šī, bet vēl dīlera solis, ir sarkans. */
export const OIL_OEM_ORANGE_RATIO = 1.3;

const OEM_LINE_RE =
  /Ražotāja intervāls:\s*([\d\s\u00a0]+)\s*km(?:\s*(?:\/|,|un|vai)\s*(\d+)\s*mēn)?/i;
const OEM_UNKNOWN_RE = /Ražotāja intervāls:\s*nav\b/i;

export function parseOemOilIntervalFromText(raw: string): OemOilInterval | null {
  const t = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t || OEM_UNKNOWN_RE.test(t)) return null;
  const m = t.match(OEM_LINE_RE);
  if (!m) return null;
  const km = Number((m[1] ?? "").replace(/\s+/g, ""));
  if (!Number.isFinite(km) || km < 3_000 || km > 40_000) return null;
  const monthsRaw = m[2] ? Number(m[2]) : null;
  const months =
    monthsRaw != null && Number.isFinite(monthsRaw) && monthsRaw >= 6 && monthsRaw <= 36
      ? monthsRaw
      : null;
  return { km, months };
}

export function oilRatioTone(value: number | null, oem: number | null | undefined): OilRatioTone {
  if (value == null || value <= 0) return "neutral";
  if (oem == null || oem <= 0) return "neutral";
  const ratio = value / oem;
  if (ratio <= OIL_OEM_GREEN_RATIO) return "ok";
  if (ratio <= OIL_OEM_ORANGE_RATIO) return "warn";
  return "stretch";
}

export function formatOemOilCaption(oem: OemOilInterval): string {
  const km = String(Math.round(oem.km)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (oem.months != null) return `pret ${km} km / ${oem.months} mēn.`;
  return `pret ${km} km`;
}
