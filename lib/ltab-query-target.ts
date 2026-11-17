import type { CsddFormFields } from "@/lib/admin-source-blocks";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * LTAB vaicājuma mērķis: TIKAI Latvijas numurzīme un TIKAI tad, ja CSDD dati rāda, ka auto ir reģistrēts Latvijā.
 * Pēc VIN LTAB neprasām (Nila lēmums 23.10.2026: ārzemju auto solis tiek izlaists).
 */

export type LtabSkipReason =
  /** CSDD solis vēl nav devis datus (nav API momentuzņēmuma un nav ielīmēta numura). */
  | "no_csdd_data"
  /** CSDD numurzīme nav derīga LV numurzīme. */
  | "no_plate"
  /** Statuss: noņemts no uzskaites / izvests / norakstīts. */
  | "not_registered_lv"
  /** CSDD VIN neatbilst pasūtījuma VIN (numurs var piederēt citam auto). */
  | "vin_mismatch";

export type LtabQueryTarget =
  | { kind: "plate"; plate: string; source: "registry" | "csdd_form" }
  | { kind: "skip"; reason: LtabSkipReason };

export const LTAB_SKIP_REASON_LV: Record<LtabSkipReason, string> = {
  no_csdd_data: "Nav CSDD datu - LTAB gaida CSDD soli",
  no_plate: "CSDD nav Latvijas numurzīmes - LTAB izlaists",
  not_registered_lv: "Auto nav reģistrēts Latvijā - LTAB izlaists",
  vin_mismatch: "CSDD VIN neatbilst pasūtījumam - LTAB izlaists",
};

const DEREGISTERED_RE = /no[nņ]emts|izvest|noraks|likvid|izsl[eē]gt|nav\s+uzskait|dati\s+nav\s+pieejami|deregist/i;
const REGISTERED_RE = /uzskait[eē]|re[gģ]istr[eē]ts/i;

/** Personalizētas numurzīmes (tikai no CSDD API): 2-8 burti/cipari, vismaz viens burts. */
function isRegistryPlate(n: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(n) && /[A-Z]/.test(n);
}

export function normalizeLtabPlate(raw: string): string {
  return normalizePlateNumber(raw ?? "");
}

export function isValidLtabPlate(raw: string): boolean {
  const n = normalizeLtabPlate(raw);
  return isValidPlateNumber(n) || isRegistryPlate(n);
}

export function resolveLtabQueryTarget(
  csdd: Pick<CsddFormFields, "registry" | "registrationNumber" | "registrationStatus" | "vin"> | null | undefined,
  orderVin?: string | null,
): LtabQueryTarget {
  if (!csdd) return { kind: "skip", reason: "no_csdd_data" };
  const status = (csdd.registrationStatus ?? "").trim();
  if (status && DEREGISTERED_RE.test(status)) return { kind: "skip", reason: "not_registered_lv" };

  const order = normalizeVin(orderVin ?? "");
  const orderHasVin = isValidVin(order);

  const reg = csdd.registry?.data;
  if (reg) {
    const regVin = normalizeVin(reg.vin ?? "");
    if (orderHasVin && isValidVin(regVin) && regVin !== order) return { kind: "skip", reason: "vin_mismatch" };
    const plate = normalizeLtabPlate(reg.registrationNumber ?? "");
    if (!plate) return { kind: "skip", reason: "not_registered_lv" };
    if (!isValidPlateNumber(plate) && !isRegistryPlate(plate)) return { kind: "skip", reason: "no_plate" };
    return { kind: "plate", plate, source: "registry" };
  }

  const plate = normalizeLtabPlate(csdd.registrationNumber ?? "");
  if (!plate) return { kind: "skip", reason: status ? "no_plate" : "no_csdd_data" };
  if (!isValidPlateNumber(plate)) return { kind: "skip", reason: "no_plate" };
  // Bez API: vajag skaidru CSDD statusu "Uzskaitē" / "Reģistrēts", citādi nezinām, vai auto ir LV.
  if (!REGISTERED_RE.test(status)) return { kind: "skip", reason: "not_registered_lv" };
  const formVin = normalizeVin(csdd.vin ?? "");
  if (orderHasVin && isValidVin(formVin) && formVin !== order) return { kind: "skip", reason: "vin_mismatch" };
  return { kind: "plate", plate, source: "csdd_form" };
}
