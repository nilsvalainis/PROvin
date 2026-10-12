/**
 * MINI → AUDITS ieteikuma e-pasta melnraksts (rediģējams adminā pirms sūtīšanas).
 * Tīri stringi: der arī klienta komponentei, bez server-only.
 */

import { clientMessageSignOff } from "@/lib/email/report-ready-copy";

export const MINI_TO_AUDITS_RECOMMENDATION_LABEL = "MINI → AUDITS ieteikums";

export const MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER = "[maksājuma saite]";

export type MiniToAuditsRecommendationInput = {
  customerName?: string | null;
  vin?: string | null;
  /** Marka/modelis, ja zināms (piem. no CSDD). */
  car?: string | null;
  paymentUrl?: string | null;
  miniPrice: string;
  auditsPrice: string;
  differencePrice: string;
  dealerAddonPrice: string;
};

export type MiniToAuditsRecommendationDraft = {
  subject: string;
  emailText: string;
  whatsappText: string;
};

export function miniToAuditsGreeting(customerName?: string | null): string {
  const name = (customerName ?? "").trim();
  return name ? `Labdien, ${name}!` : "Labdien!";
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

function payLine(paymentUrl?: string | null): string {
  const url = (paymentUrl ?? "").trim();
  return `Apmaksāt: ${url || MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER}`;
}

function orderLead(vehicle: string): string {
  if (!vehicle) return "Rakstām par Jūsu PROVIN MINI pasūtījumu.";
  if (vehicle.startsWith("VIN ")) {
    return `Rakstām par Jūsu PROVIN MINI pasūtījumu (${vehicle}).`;
  }
  return `Rakstām par Jūsu PROVIN MINI pasūtījumu: ${vehicle}.`;
}

/**
 * Prefillēts klienta e-pasts: ko MINI jau sedz, ko redz tikai AUDITS,
 * starpības apmaksa, MINI turpinājums vai dīlera starpsolis.
 */
export function buildMiniToAuditsRecommendationDraft(
  opts: MiniToAuditsRecommendationInput,
): MiniToAuditsRecommendationDraft {
  const hello = miniToAuditsGreeting(opts.customerName);
  const vehicle = miniToAuditsVehiclePhrase({ vin: opts.vin, car: opts.car });
  const pay = payLine(opts.paymentUrl);
  const sign = clientMessageSignOff();
  const subjectVehicle = vehicle ? ` (${vehicle})` : "";

  const emailText = [
    hello,
    "",
    orderLead(vehicle),
    "",
    "PROVIN MINI šajā pasūtījumā ietver:",
    "- individuālu konsultāciju un ieteikumus klātienes apskatei;",
    "- apdrošinātāju datus un tehniskās apskates vēsturi;",
    "- sludinājuma, pārdevēja un tehnisko risku analīzi.",
    "",
    "Ko MINI nepārbauda un ko var noskaidrot tikai PROVIN AUDITS:",
    "- CarVertical un AutoDNA, kā arī izcelsmes valsts reģistrus;",
    "- oficiālā dīlera servisa vēsturi un izsoļu portālu arhīvu.",
    "",
    "Īpaši izceļam trīs lietas, ko MINI neredz: negadījumu vēsturi, ārvalstu nobraukuma hronoloģiju un oficiālā dīlera datus.",
    "",
    `Iesakām šim auto pāriet uz pilno PROVIN AUDITS. Jau samaksāts ${opts.miniPrice}, papildu apmaksa ${opts.differencePrice} (kopā ${opts.auditsPrice}).`,
    "",
    pay,
    "",
    "Ja šie papildu dati nav vajadzīgi, turpināsim ar PROVIN MINI kā pasūtīts.",
    "",
    `Ir arī starpsolis: vispirms pievienot tikai oficiālā dīlera datus (${opts.dealerAddonPrice}) un pēc tam lemt par pilno auditu. Šajā solī nebūs pārbaužu maksas ārvalstu datubāzēs (CarVertical, AutoDNA); paliek starptautiskie valsts reģistri un dīlera ieraksti. Ja vēlaties šo variantu, atbildiet uz šo e-pastu.`,
    "",
    "Apmaksas saite ir piesaistīta šim pasūtījumam. Ja tā vairs neatveras, atbildiet uz šo e-pastu.",
    "",
    sign,
  ].join("\n");

  const whatsappLead = vehicle
    ? `Jūsu PROVIN MINI (${vehicle}) pārbauda konsultāciju un ieteikumus klātienes apskatei, apdrošinātāju datus un TA vēsturi, kā arī sludinājuma, pārdevēja un tehnisko risku analīzi.`
    : "Jūsu PROVIN MINI pārbauda konsultāciju un ieteikumus klātienes apskatei, apdrošinātāju datus un TA vēsturi, kā arī sludinājuma, pārdevēja un tehnisko risku analīzi.";

  const whatsappText = [
    hello,
    "",
    whatsappLead,
    "",
    "Tikai PROVIN AUDITS redz CarVertical, AutoDNA, izcelsmes valsts reģistrus, oficiālā dīlera datus un izsoļu arhīvu, īpaši negadījumu vēsturi un ārvalstu nobraukumu.",
    "",
    `Iesakām pilno auditu. Papildu apmaksa ${opts.differencePrice} (MINI ${opts.miniPrice}, AUDITS ${opts.auditsPrice}).`,
    "",
    pay,
    "",
    `Ja papildu dati nav vajadzīgi, turpināsim ar MINI. Varat arī vispirms pievienot tikai dīlera datus (${opts.dealerAddonPrice}) un tad lemt; tas neiekļauj maksas ārvalstu datubāzes, tikai starptautiskos valsts reģistrus.`,
    "",
    sign,
  ].join("\n");

  return {
    subject: `PROVIN.LV: ${MINI_TO_AUDITS_RECOMMENDATION_LABEL}${subjectVehicle}`,
    emailText,
    whatsappText,
  };
}
