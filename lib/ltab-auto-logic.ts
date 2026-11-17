import type { LtabBlockState } from "@/lib/admin-source-blocks";
import { ltabBlockHasContent } from "@/lib/admin-source-blocks";
import { ltabCertificateHasContent, type LtabCertificate } from "@/lib/ltab-report-extract";
import type { LtabAutoStatus } from "@/lib/ltab-auto-types";
import { normalizeLtabPlate } from "@/lib/ltab-query-target";

/**
 * LTAB automātikas tīrā loģika (bez tīkla): releja notikumi -> stāvoklis, izziņas atbilstība auto,
 * vai rezultātu drīkst ievietot blokā automātiski.
 */

export type LtabRelayEvent = {
  jobId: string;
  ref: string;
  plate: string;
  state: "queued" | "awaiting_smartid" | "searching" | "result" | "error";
  verificationCode?: string;
  /** `result`: vai LTAB rādīja ierakstus (relejs nosaka pēc lapas). */
  found?: boolean;
  /** `result`: oriģinālais PDF base64 (ja LTAB to deva). */
  pdfBase64?: string;
  /** `error`: mašīnlasāms kods. */
  code?: string;
  message?: string;
  at?: string;
};

const RELAY_ERROR_LV: Record<string, string> = {
  smartid_timeout: "Smart-ID netika apstiprināts 120 s laikā - spied \"Pieprasīt no LTAB\" vēlreiz",
  smartid_refused: "Smart-ID pieprasījums atteikts telefonā",
  code_not_read: "Neizdevās nolasīt Smart-ID kontrolkodu - LTAB jāpārbauda manuāli",
  captcha: "LTAB vai latvija.lv prasa captcha - jāpārbauda manuāli",
  page_changed: "LTAB lapa mainījusies - jāpārbauda manuāli",
  unavailable: "LTAB vai latvija.lv nav pieejams",
  paid: "LTAB prasa maksu - relejs neko neapmaksā, jāizlemj Nilam",
  not_configured: "Relejam nav Smart-ID personas koda (serverī)",
  pdf_missing: "LTAB rādīja negadījumus, bet PDF neizdevās lejupielādēt - augšupielādē manuāli",
  invalid_plate: "Numurzīme nav derīga LTAB meklēšanai",
  queue_full: "LTAB rinda pilna - mēģini vēlāk",
};

export function ltabRelayErrorLv(code: string | undefined, fallback?: string): string {
  return (code && RELAY_ERROR_LV[code]) || fallback?.slice(0, 200) || "LTAB pieprasījums neizdevās";
}

/** Atbildes, kas nav galīgs rezultāts: atjauno tikai stāvokli. */
export function reduceLtabProgress(prev: LtabAutoStatus | null, ev: LtabRelayEvent, now: string): LtabAutoStatus {
  const base: LtabAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    plate: ev.plate || prev?.plate,
    jobId: ev.jobId || prev?.jobId,
    updatedAt: now,
  };
  delete base.verificationCode;
  if (ev.state === "awaiting_smartid") {
    const code = /^\d{4}$/.test(ev.verificationCode ?? "") ? ev.verificationCode : undefined;
    return { ...base, state: "awaiting_smartid", ...(code ? { verificationCode: code } : {}), message: "Apstiprini Smart-ID telefonā" };
  }
  if (ev.state === "searching") return { ...base, state: "searching", message: "Meklē LTAB" };
  if (ev.state === "error") return { ...base, state: "error", message: ltabRelayErrorLv(ev.code, ev.message) };
  return { ...base, state: "queued", message: "Gaida rindā" };
}

/** Vai izziņā ir negadījumi (CSNg rindas vai "Negadījumu skaits" > 0). */
export function ltabCertificateHasClaims(cert: LtabCertificate | null | undefined): boolean {
  if (!cert) return false;
  if (cert.claims.some((c) => c.date.trim() || c.amount.trim())) return true;
  const n = Number.parseInt(cert.accidentCount, 10);
  return Number.isFinite(n) && n > 0;
}

function makeToken(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)[0] ?? "";
}

/**
 * Numurzīmes Latvijā piešķir atkārtoti: izziņai jāatbilst pieprasītajam numuram un CSDD markai/gadam.
 * Atgriež latvisku iemeslu vai `null`, ja viss sakrīt (vai nav ar ko salīdzināt).
 */
export function ltabCertificateMismatch(
  cert: LtabCertificate,
  expect: { plate: string; make?: string; year?: string },
): string | null {
  const certPlate = normalizeLtabPlate(cert.plate);
  const plate = normalizeLtabPlate(expect.plate);
  if (certPlate && plate && certPlate !== plate) {
    return `Izziņa ir par numuru ${certPlate}, pieprasīts ${plate}`;
  }
  const make = makeToken(expect.make ?? "");
  const certMake = makeToken(cert.makeModel);
  if (make && certMake && make !== certMake && !cert.makeModel.toUpperCase().includes(make)) {
    return `Izziņā marka ${cert.makeModel}, CSDD: ${expect.make}`;
  }
  const year = (expect.year ?? "").trim().slice(0, 4);
  if (/^\d{4}$/.test(year) && /^\d{4}$/.test(cert.year) && Math.abs(Number(year) - Number(cert.year)) > 1) {
    return `Izziņā izlaiduma gads ${cert.year}, CSDD: ${year}`;
  }
  return null;
}

/** Automātiski ievieto tikai tukšā LTAB blokā, ja izziņa atbilst auto un vēl nav ievietota. */
export function ltabAutoCanApply(status: LtabAutoStatus | null | undefined, block: LtabBlockState): boolean {
  if (!status || status.appliedAt || status.mismatch) return false;
  if (status.state === "claims") return ltabCertificateHasContent(status.certificate) && !ltabBlockHasContent(block);
  if (status.state === "no_claims") return !ltabBlockHasContent(block);
  return false;
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

