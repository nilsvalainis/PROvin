import type { CsddTechData } from "@/lib/csdd-tech-data";

/**
 * Publiskā numurzīmes pārbaude: ko no CSDD tehniskajiem datiem drīkst rādīt bez maksas.
 * VIN maskējam (pēdējās 6 zīmes), lai lapu nevarētu lietot kā "numurzīme -> pilns VIN" meklētāju.
 * OCTA termiņu, masas un COC laukus nerādām.
 */

export type PublicPlateView = {
  plate: string;
  make: string;
  model: string;
  year: string;
  fuel: string;
  powerKw: string;
  displacementCm3: string;
  color: string;
  firstRegistration: string;
  inspectionValidUntil: string;
  vinMasked: string;
  /** Tehniskās apskates stāvoklis attiecībā pret šodienu. */
  inspection: "valid" | "expiring" | "expired" | "unknown";
};

/** Dekodera CSDD zvani dienā (visiem kopā). */
export const DECODER_CSDD_DAILY_CAP = 200;
/** CSDD līgums: 10 000 mēnesī. Dekoders apstājas, kad kopējais mēneša lietojums (dekoders + MINI + admin) sasniedz šo; 1000 paliek rezervē MINI pirkumiem un adminam. */
export const CSDD_MONTH_CONTRACT = 10_000;
export const CSDD_MONTH_DECODER_STOP = 9_000;

export type CsddUsage = { decoderToday: number; monthTotal: number };

/** Vai publiskajam dekoderim vairs nedrīkst zvanīt CSDD (dienas vai mēneša griesti). */
export function decoderCsddBlocked(u: CsddUsage): "day" | "month" | null {
  if (u.monthTotal >= CSDD_MONTH_DECODER_STOP) return "month";
  if (u.decoderToday >= DECODER_CSDD_DAILY_CAP) return "day";
  return null;
}

export function maskVin(vin: string): string {
  const v = vin.replace(/\s+/g, "").toUpperCase();
  return v.length === 17 ? `${v.slice(0, 11)}******` : "";
}

function cap(s: string): string {
  const t = s.trim();
  if (!t) return "";
  // Reģistrs raksta lielajiem burtiem; marku atstājam, krāsu un degvielu pārveidojam salasāmi.
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
}

/** "2027-05-14" pret šodienu: < 0 nokavēts, <= 60 dienas drīz beigsies. */
export function inspectionState(iso: string, now: Date = new Date()): PublicPlateView["inspection"] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "unknown";
  const days = Math.floor((Date.parse(`${iso}T23:59:59Z`) - now.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 60) return "expiring";
  return "valid";
}

export function toPublicPlateView(plate: string, d: CsddTechData, now: Date = new Date()): PublicPlateView {
  return {
    plate,
    make: d.make.trim(),
    model: d.model.trim(),
    year: d.year.trim(),
    fuel: cap(d.fuel),
    powerKw: d.powerKw.trim(),
    displacementCm3: d.displacementCm3.trim(),
    color: cap(d.color),
    firstRegistration: d.firstRegistrationIso,
    inspectionValidUntil: d.inspectionValidUntilIso,
    vinMasked: maskVin(d.vin),
    inspection: inspectionState(d.inspectionValidUntilIso, now),
  };
}
