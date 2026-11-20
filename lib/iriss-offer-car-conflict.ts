/**
 * Audits 20.11: klients apstiprina piedāvājumu (jauno PD vai veco /p/[token]) ar Autoparka auto, bet auto jau
 * «Rezervēts» citam vai «Pārdots» - agrāk klusēja. Tagad: vēstures ieraksts, push adminam, brīdinājums redaktorā.
 * Tīra loģika (bez servera importiem) - lieto gan serveris, gan PD redaktors.
 */

import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { pushVinTail } from "@/lib/admin-push-shared";

/** Kā beidzās mēģinājums rezervēt Autoparka auto pēc klienta apstiprinājuma. */
export type IrissOfferCarReserveOutcome = "reserved" | "already_reserved" | "sold" | "not_found" | "race" | "error";

export const IRISS_OFFER_CAR_RESERVED_TEXT = "Auto jau rezervēts - rezervācija neveikta";
export const IRISS_OFFER_CAR_SOLD_TEXT = "Auto jau pārdots - rezervācija neveikta";

/** Autoparka rezervācijas rezultāts no `reserveAutoparksCarAfterOffer` iemesla. */
export function irissOfferCarOutcomeOf(res: { ok: true } | { ok: false; reason: string }): IrissOfferCarReserveOutcome {
  if (res.ok) return "reserved";
  if (res.reason === "not_found") return "not_found";
  if (res.reason === "conflict") return "race";
  if (res.reason === "same") return "already_reserved";
  if (res.reason === "later_stage") return "sold";
  return "error";
}

/** Auto jau aizņemts (rezervēts citam vai pārdots) - jāziņo adminam. */
export function irissOfferCarIsConflict(outcome: IrissOfferCarReserveOutcome): boolean {
  return outcome === "already_reserved" || outcome === "sold";
}

/** Vēstures/piezīmes teksts. */
export function irissOfferCarReserveText(outcome: IrissOfferCarReserveOutcome): string {
  switch (outcome) {
    case "reserved":
      return "Autoparka auto pārslēgts uz «Rezervēts»";
    case "already_reserved":
      return IRISS_OFFER_CAR_RESERVED_TEXT;
    case "sold":
      return IRISS_OFFER_CAR_SOLD_TEXT;
    case "not_found":
      return "Autoparka auto nav atrasts - rezervācija neveikta";
    case "race":
      return "Autoparka auto statuss tikko mainīts - «Rezervēts» iestati ar roku";
    default:
      return "Autoparka auto neizdevās pārslēgt uz «Rezervēts» - iestati ar roku";
  }
}

/** Apstiprināta PD vēsturē ir konflikta ieraksts -> redaktorā un sarakstā brīdinājums. */
export function irissPdCarConflictText(history: ReadonlyArray<{ text: string }>): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const t = history[i]!.text;
    if (t === IRISS_OFFER_CAR_RESERVED_TEXT || t === IRISS_OFFER_CAR_SOLD_TEXT) return t;
  }
  return "";
}

/**
 * Pirms sūtīšanas / kamēr klients vēl nav apstiprinājis: Autoparka auto jau «Rezervēts» vai «Pārdots».
 * Tikai brīdinājums (nebloķē). Apstiprinātam PD brīdinājumu dod vēstures ieraksts.
 */
export function irissPdSourceCarWarning(pdStatus: string, carStatus: string): string {
  if (pdStatus === "approved" || pdStatus === "declined" || pdStatus === "expired") return "";
  if (carStatus === "reserved") return "Autoparka auto jau «Rezervēts» - klienta apstiprinājums to nerezervēs. Pārbaudi pirms sūtīšanas.";
  if (carStatus === "sold") return "Autoparka auto jau «Pārdots» - klienta apstiprinājums to nerezervēs. Pārbaudi pirms sūtīšanas.";
  return "";
}

/** Push adminam (bez klienta kontaktiem - redzams bloķētajā ekrānā). */
export function irissOfferCarConflictPushMessage(
  f: { offerId: string; vehicle: string; vin: string; adminPath: string },
  outcome: IrissOfferCarReserveOutcome,
): AdminPushMessage {
  const vin = pushVinTail(f.vin);
  return {
    title: outcome === "sold" ? "Apstiprināts, bet auto jau pārdots" : "Apstiprināts, bet auto jau rezervēts",
    body: `${f.vehicle.trim() || "Auto"}${vin ? ` · ${vin}` : ""} - rezervācija neveikta, sazinies ar klientu`,
    url: f.adminPath.startsWith("/admin/") ? f.adminPath : "/admin/iriss",
    tag: `offer-car-${f.offerId}`,
    audience: "iriss",
  };
}
