/**
 * Ražotāja eļļas intervāls šim motoram, un krāsu skala pret to.
 *
 * Zaļa: dīlera solis kilometros un laikā iekļaujas OEM (mainīgam: līdz augšējai robežai).
 * Sarkana: dīlera datos solis ir garāks par OEM km VAI mēnešiem. Tas nav apgalvojums,
 * ka eļļa nav mainīta: apkope varēja būt ārpus dīlera.
 * Pelēka tikai datu iztrūkumam. Bez OEM nav zaļa/sarkana.
 *
 * Pilsētas 10 000 km griesti ir komentāra tēma, ne krāsu OEM.
 */

export type OemOilInterval = {
  /** Augšējā km robeža (fiksētam intervālam tas ir vienīgais skaitlis). */
  km: number;
  /** Apakšējā km robeža, ja intervāls ir mainīgs. */
  kmMin: number | null;
  months: number | null;
};

export type OilRatioTone = "ok" | "warn" | "stretch" | "neutral";

const OEM_LINE_RE =
  /Ražotāja intervāls(?:\s+mainīgs)?:\s*([\d\s\u00a0]+)(?:\s*(?:-|līdz)\s*([\d\s\u00a0]+))?\s*km(?:\s*(?:\/|,|un|vai)\s*(\d+)\s*mēn)?/i;
const OEM_UNKNOWN_RE = /Ražotāja intervāls:\s*nav\b/i;

function parseKmToken(raw: string | undefined): number | null {
  const km = Number((raw ?? "").replace(/\s+/g, ""));
  if (!Number.isFinite(km) || km < 3_000 || km > 40_000) return null;
  return km;
}

function parseMonthsToken(raw: string | undefined): number | null {
  const monthsRaw = raw ? Number(raw) : null;
  if (monthsRaw == null || !Number.isFinite(monthsRaw) || monthsRaw < 6 || monthsRaw > 36) {
    return null;
  }
  return monthsRaw;
}

export function parseOemOilIntervalFromText(raw: string): OemOilInterval | null {
  const t = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t || OEM_UNKNOWN_RE.test(t)) return null;
  const m = t.match(OEM_LINE_RE);
  if (!m) return null;
  const first = parseKmToken(m[1]);
  if (first == null) return null;
  const second = parseKmToken(m[2]);
  const months = parseMonthsToken(m[3]);
  if (second == null || second === first) {
    return { km: first, kmMin: null, months };
  }
  const kmMin = Math.min(first, second);
  const km = Math.max(first, second);
  return { km, kmMin, months };
}

export function oilRatioTone(value: number | null, oem: number | null | undefined): OilRatioTone {
  if (value == null || value <= 0) return "neutral";
  if (oem == null || oem <= 0) return "neutral";
  return value <= oem ? "ok" : "stretch";
}

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatOemOilCaption(oem: OemOilInterval): string {
  const max = groupDigits(oem.km);
  if (oem.kmMin != null && oem.kmMin < oem.km) {
    const range = `Ražotāja intervāls mainīgs: ${groupDigits(oem.kmMin)} līdz ${max} km`;
    return oem.months != null ? `${range} / ${oem.months} mēn.` : `${range}.`;
  }
  return oem.months != null
    ? `Ražotāja intervāls: ${max} km / ${oem.months} mēn.`
    : `Ražotāja intervāls: ${max} km.`;
}
