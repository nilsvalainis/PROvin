/**
 * MINI → AUDITS ieteikuma e-pasta melnraksts (Nils apstiprinātais teksts).
 * Tīri stringi: der arī klienta komponentei, bez server-only.
 */

export const MINI_TO_AUDITS_RECOMMENDATION_LABEL = "MINI → AUDITS ieteikums";

export const MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER = "{maksajuma_saite}";
export const MINI_TO_AUDITS_NAME_PLACEHOLDER = "{vards}";
export const MINI_TO_AUDITS_CAR_PLACEHOLDER = "{auto}";
export const MINI_TO_AUDITS_VIN_PLACEHOLDER = "{vin}";

/** Apstiprinātais klienta teksts. Vietturus aizpilda pirms sūtīšanas. */
export const MINI_TO_AUDITS_APPROVED_TEXT = `Labdien, {vards}!

Paldies par PROVIN MINI pasūtījumu {auto} (VIN {vin}).

Pārskatot auto, redzam, ka šim auto vairāk atbilstu PROVIN AUDITS. Lai varat izlemt, īsi par atšķirību:

PROVIN MINI ietver:
✓ Konsultāciju un ieteikumus klātienes apskatei
✓ Apdrošinātāju datus un tehnisko apskašu vēsturi
✓ Sludinājuma, pārdevēja un tehnisko risku analīzi

Tikai PROVIN AUDITS ietver:
✓ CarVertical + AutoDNA + izcelsmes valsts reģistrus
✓ Oficiālo dīleru un izsoļu portālu arhīva datus

Tas nozīmē, ka tieši AUDITS parāda negadījumu vēsturi, nobraukuma vēsturi ārvalstīs un oficiālā dīlera servisa datus, kas pie ievestiem auto ir paši svarīgākie.

Mēs iesakām pilno auditu. Starpību ({starpiba} €) varat apmaksāt šeit:
{maksajuma_saite}

Var arī vispirms papildināt pārbaudi tikai ar oficiālā dīlera datiem un tālāk lemt pēc situācijas. Jāņem vērā, ka tādā gadījumā netiks veikta pārbaude ārvalstu maksas datubāzēs.

Ja papildu dati nav vajadzīgi, turpināsim ar MINI.

Ar cieņu,
Nils
PROVIN.LV
T: 29502039`;

export type MiniToAuditsRecommendationInput = {
  customerName?: string | null;
  vin?: string | null;
  /** Marka/modelis, ja zināms (piem. no CSDD). */
  car?: string | null;
  paymentUrl?: string | null;
  miniPrice?: string;
  auditsPrice?: string;
  differencePrice: string;
  dealerAddonPrice?: string;
};

export type MiniToAuditsRecommendationDraft = {
  subject: string;
  emailText: string;
  whatsappText: string;
};

/** Vokatīvs no vārda (pirmais tokens). Jānis → Jāni, Anna paliek Anna. */
export function latvianVocativeFirstName(fullName?: string | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  if (/us$/i.test(first)) {
    return `${first.slice(0, -2)}${first.endsWith("US") ? "U" : "u"}`;
  }
  if (/is$/i.test(first) || /[sš]$/i.test(first)) {
    return first.slice(0, -1);
  }
  return first;
}

export function miniToAuditsGreeting(customerName?: string | null): string {
  const vocative = latvianVocativeFirstName(customerName);
  return `Labdien, ${vocative || MINI_TO_AUDITS_NAME_PLACEHOLDER}!`;
}

export function miniToAuditsVehiclePhrase(opts: {
  vin?: string | null;
  car?: string | null;
}): string {
  const vin = (opts.vin ?? "").trim().toUpperCase();
  const car = (opts.car ?? "").trim().replace(/\s+/g, " ");
  if (car && vin) return `${car} (VIN ${vin})`;
  if (car) return car;
  if (vin) return `VIN ${vin}`;
  return "";
}

function amountWithoutEuro(price: string): string {
  return price.replace(/\s*€\s*$/u, "").trim();
}

/**
 * Prefillēts klienta e-pasts: Nilsa apstiprinātais MINI → AUDITS ieteikums.
 */
export function buildMiniToAuditsRecommendationDraft(
  opts: MiniToAuditsRecommendationInput,
): MiniToAuditsRecommendationDraft {
  const vards = latvianVocativeFirstName(opts.customerName) || MINI_TO_AUDITS_NAME_PLACEHOLDER;
  const auto = (opts.car ?? "").trim().replace(/\s+/g, " ") || MINI_TO_AUDITS_CAR_PLACEHOLDER;
  const vin = (opts.vin ?? "").trim().toUpperCase() || MINI_TO_AUDITS_VIN_PLACEHOLDER;
  const pay = (opts.paymentUrl ?? "").trim() || MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER;
  const starpiba = amountWithoutEuro(opts.differencePrice);
  const text = MINI_TO_AUDITS_APPROVED_TEXT.replaceAll("{vards}", vards)
    .replaceAll("{auto}", auto)
    .replaceAll("{vin}", vin)
    .replaceAll("{starpiba}", starpiba)
    .replaceAll("{maksajuma_saite}", pay);
  const vehicle = miniToAuditsVehiclePhrase({ vin: opts.vin, car: opts.car });
  const subjectVehicle = vehicle ? ` (${vehicle})` : "";

  return {
    subject: `PROVIN.LV: ${MINI_TO_AUDITS_RECOMMENDATION_LABEL}${subjectVehicle}`,
    emailText: text,
    whatsappText: text,
  };
}
