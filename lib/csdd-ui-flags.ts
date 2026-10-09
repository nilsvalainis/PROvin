/**
 * CSDD admin lauku vizuālie brīdinājumi (rāmis + ikona), balstīti uz vērtībām.
 */

export type CsddFieldUiFlag = "none" | "yellow" | "red";

/** Izvelk veselu skaitli no teksta (atgāzu daļiņas — parasti lieli skaitļi ar atstarpēm). */
export function parseParticulateMatterNumber(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function getParticulateMatterUiFlag(raw: string): CsddFieldUiFlag {
  const n = parseParticulateMatterNumber(raw);
  if (n === null) return "none";
  if (n > 1_000_000) return "red";
  if (n > 100_000) return "yellow";
  return "none";
}

function parseLocalDateIso(iso: string): Date | null {
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dienu skaits līdz `target` salīdzinot ar `ref` (pozitīvs = nākotnē). */
function daysFromRefToTarget(target: Date, ref: Date): number {
  const a = startOfLocalDay(target).getTime();
  const b = startOfLocalDay(ref).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

export function getNextInspectionDateUiFlag(isoDate: string, referenceDate: Date = new Date()): CsddFieldUiFlag {
  const target = parseLocalDateIso(isoDate);
  if (!target) return "none";
  const ref = startOfLocalDay(referenceDate);
  const diff = daysFromRefToTarget(target, ref);
  if (diff < 0) return "red";
  if (diff < 30) return "red";
  if (diff < 90) return "yellow";
  return "none";
}

/** OCTA polise: beigusies → sarkans; beigsies 30 dienu laikā → dzeltens. */
export function getInsuranceValidUntilUiFlag(isoDate: string, referenceDate: Date = new Date()): CsddFieldUiFlag {
  const target = parseLocalDateIso(isoDate);
  if (!target) return "none";
  const diff = daysFromRefToTarget(target, startOfLocalDay(referenceDate));
  if (diff < 0) return "red";
  if (diff < 30) return "yellow";
  return "none";
}

export function insuranceValidUntilFlagTitle(flag: CsddFieldUiFlag): string {
  if (flag === "red") return "Brīdinājums: OCTA polise ir beigusies.";
  if (flag === "yellow") return "Brīdinājums: OCTA polise beigsies mazāk nekā 30 dienās.";
  return "";
}

/** CSDD VIN ≠ pasūtījuma VIN → sarkans (abi pilni 17 zīmju VIN). */
export function getVinMismatchUiFlag(csddVin: string, orderVin: string): CsddFieldUiFlag {
  const a = csddVin.trim().toUpperCase().replace(/[\s-]/g, "");
  const b = orderVin.trim().toUpperCase().replace(/[\s-]/g, "");
  if (a.length !== 17 || b.length !== 17) return "none";
  return a === b ? "none" : "red";
}

export const VIN_MISMATCH_FLAG_TITLE =
  "Brīdinājums: CSDD reģistra VIN nesakrīt ar pasūtījumā norādīto VIN.";

/**
 * Latvijas vinjete (Autoceļu lietošanas nodevas likums 3. panta pirmā daļa,
 * redakcija no 01.03.2026): nodevu maksā par **kravas** transportlīdzekļiem,
 * kuru pilna masa ir **lielāka par 3000 kg**, uz 1. pielikuma autoceļu posmiem.
 *
 * Satiksmes ministrija: vinjete NAV jāmaksā M1 (piem. 7 sēdvietu ģimenes auto)
 * pat ja masa > 3000 kg, un NAV jāmaksā kravas auto ar pilnu masu līdz 3000 kg.
 * Sēdvietu skaits likumā **nav** kritērijs. PROVIN to ņem vērā kā pircēja slazdu:
 * N1 furgons ar 6-9 sēdvietām izskatās pēc pasažieru auto, bet vinjete paliek.
 */
export const LV_VIGNETTE_GROSS_MASS_KG = 3000;
export const LV_VIGNETTE_EXTRA_SEATS_OVER = 3;

export type LvVignetteFieldKey = "vehicleType" | "grossMassKg" | "seatCount";

export type LvVignetteAssessment = {
  applies: boolean;
  isCargoLike: boolean;
  grossMassKg: number | null;
  seatCount: number | null;
  extraSeats: boolean;
  warningTitle: string;
  seatWarningTitle: string;
  bannerText: string;
};

export const LV_VIGNETTE_CARD_LABEL = "Vinjete";
export const LV_VIGNETTE_CARD_VALUE = "Pilna masa virs 3000 kg";
export const LV_VIGNETTE_PUBLIC_NOTE =
  "Pārvietojoties pa Latvijas galvenajiem autoceļiem, var būt nepieciešama vinjete.";

const LV_VIGNETTE_TITLE =
  "Brīdinājums: kravas transportam ar pilnu masu virs 3000 kg uz nodevas autoceļiem Latvijā vajadzīga vinjete.";
const LV_VIGNETTE_SEAT_TITLE =
  "Brīdinājums: sēdvietu skaits virs 3 neatceļ vinjetes pienākumu, ja auto ir reģistrēts kā kravas transportlīdzeklis (N1).";

export function parseCsddMassKg(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseCsddSeatCount(raw: string): number | null {
  const m = raw.trim().match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Kravas / N1 (un N2/N3) no CSDD veida lauka. M1 un vieglais bez „kravas” nav vinjetes subjekts. */
export function isCsddCargoLikeVehicleType(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/\bN[123]\b/i.test(t)) return true;
  if (/kravas\s+transporta\s+(furgon|kast)/i.test(t)) return true;
  if (/kravas\s+(furgon|kast|vispārēj)/i.test(t)) return true;
  if (/\bkravas\b/i.test(t)) return true;
  return false;
}

export function assessLvVignette(args: {
  vehicleType: string;
  grossMassKg: string;
  seatCount: string;
}): LvVignetteAssessment {
  const isCargoLike = isCsddCargoLikeVehicleType(args.vehicleType);
  const grossMassKg = parseCsddMassKg(args.grossMassKg);
  const seatCount = parseCsddSeatCount(args.seatCount);
  const extraSeats = seatCount != null && seatCount > LV_VIGNETTE_EXTRA_SEATS_OVER;
  const applies = isCargoLike && grossMassKg != null && grossMassKg > LV_VIGNETTE_GROSS_MASS_KG;
  return {
    applies,
    isCargoLike,
    grossMassKg,
    seatCount,
    extraSeats,
    warningTitle: applies ? LV_VIGNETTE_TITLE : "",
    seatWarningTitle: applies ? (extraSeats ? LV_VIGNETTE_SEAT_TITLE : LV_VIGNETTE_TITLE) : "",
    bannerText: applies ? LV_VIGNETTE_PUBLIC_NOTE : "",
  };
}

export function getLvVignetteFieldUiFlag(
  assessment: LvVignetteAssessment,
  field: LvVignetteFieldKey,
  fieldValue: string,
): CsddFieldUiFlag {
  if (!assessment.applies) return "none";
  if (!fieldValue.trim()) return "none";
  if (field === "vehicleType" || field === "grossMassKg" || field === "seatCount") return "yellow";
  return "none";
}
