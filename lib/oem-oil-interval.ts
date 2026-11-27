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

/** Km pielaide pret ražotāja intervālu: 3 %, bet ne mazāk par 750 km (25 005 pret 25 000 nav „virs”). */
export const OIL_INTERVAL_KM_TOLERANCE_RATIO = 0.03;
export const OIL_INTERVAL_KM_TOLERANCE_MIN = 750;

export function oilIntervalKmTolerance(oemKm: number | null | undefined): number {
  if (oemKm == null || oemKm <= 0) return 0;
  return Math.max(OIL_INTERVAL_KM_TOLERANCE_MIN, Math.round(oemKm * OIL_INTERVAL_KM_TOLERANCE_RATIO));
}

/** `tolerance` - cik drīkst pārsniegt OEM, lai solis vēl skaitītos intervālā (mērvienība kā `value`). */
export function oilRatioTone(
  value: number | null,
  oem: number | null | undefined,
  tolerance = 0,
): OilRatioTone {
  if (value == null || value <= 0) return "neutral";
  if (oem == null || oem <= 0) return "neutral";
  return value <= oem + Math.max(0, tolerance) ? "ok" : "stretch";
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

/**
 * Ražotāja / dzinēja saimes noklusējums, ja AI tekstā ražotāja intervāls nav droši zināms
 * (BF 27.11, S4: BMW X5 M57 «nav droši zināms» -> 52 592 km / 39 mēn. intervālam nebija piebildes,
 * lai gan citos tās pašas dienas M57 pasūtījumos AI lietoja 30 000 km / 24 mēn.).
 * Tikai tas, kas zināms droši: BMW dīzeļi (M47, M57, N47, N57, B37, B47, B57) ar CBS / Longlife-04 -
 * maksimums 30 000 km / 24 mēn. Citiem dzinējiem noklusējuma nav (neizdomājam).
 */
export const BMW_DIESEL_CBS_OIL_INTERVAL: OemOilInterval = { km: 30_000, kmMin: null, months: 24 };

const BMW_DIESEL_ENGINE_RE = /(?:^|[^A-Z0-9])(?:M47|M57|N47|N57|B37|B47|B57)(?:[^A-Z0-9]|D|TU|$)/i;
const BMW_WMI_RE = /^(?:WBA|WBS|WBX)/i;
const BMW_MAKE_RE = /(?:^|[^\p{L}])BMW(?:[^\p{L}]|$)/iu;
const DIESEL_FUEL_RE = /diesel|d[iī]zel|дизел/i;
/** BMW modeļu apzīmējumi ar «d»: 330d, 330 d, 530d, xDrive30d, sDrive18d, X5 3.0sd, 35d. */
const BMW_DIESEL_MODEL_RE = /(?:^|[^\p{L}\p{N}])(?:\d{3}\s?d|[xs]Drive\s?\d{2}d|\d\.\d\s?s?d|\d{2}d)(?:[^\p{L}\p{N}]|$)/iu;

export type OemVehicleHints = {
  vin?: string | null;
  /** Marka / modelis / apraksts (jebkurš teksts, kur var būt «BMW», «330d»). */
  descriptions?: readonly (string | null | undefined)[];
  fuel?: readonly (string | null | undefined)[];
  engineCodes?: readonly (string | null | undefined)[];
};

export function defaultOemOilIntervalForVehicle(h: OemVehicleHints): OemOilInterval | null {
  const descs = (h.descriptions ?? []).map((d) => (d ?? "").trim()).filter(Boolean);
  const codes = (h.engineCodes ?? []).map((c) => (c ?? "").trim()).filter(Boolean);
  const fuels = (h.fuel ?? []).map((f) => (f ?? "").trim()).filter(Boolean);
  const bmw = BMW_WMI_RE.test((h.vin ?? "").trim()) || descs.some((d) => BMW_MAKE_RE.test(d));
  if (!bmw) return null;
  // Ja kāds avots saka benzīns / elektro - noklusējuma nav (pretrunu neatrisinām ar minējumu).
  if (fuels.some((f) => /petrol|benz|gasoline|electric|elektr|hybrid|hibr/i.test(f))) return null;
  const diesel =
    codes.some((c) => BMW_DIESEL_ENGINE_RE.test(c)) ||
    fuels.some((f) => DIESEL_FUEL_RE.test(f)) ||
    descs.some((d) => BMW_DIESEL_ENGINE_RE.test(d) || BMW_DIESEL_MODEL_RE.test(d));
  return diesel ? { ...BMW_DIESEL_CBS_OIL_INTERVAL } : null;
}

/** AI pirmā rinda «Ražotāja intervāls: nav droši zināms» (ar vai bez punkta). */
export const OEM_UNKNOWN_LINE_RE = /Ražotāja intervāls:\s*nav(?:\s+droši)?\s+zināms\.?/i;
