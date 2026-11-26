/** Black Friday B dizaina teksti (LV/EN/DE/RU). Tikai īsā defise «-». */

import { BLACK_FRIDAY_END_EXCLUSIVE_MS, promoLocale, type PromoLocale } from "@/lib/promo/black-friday";

export type BlackFridayCopy = {
  eyebrow: string;
  /** Pilnais nosaukums joslā / logā. */
  dealerLong: string;
  /** Īsais nosaukums kapsulā. */
  dealerShort: string;
  endsIn: string;
  order: string;
  /** «17,49 € - Pasūtīt» */
  orderWithPrice: (price: string) => string;
  /** «Pasūtīt - 17,49 €» */
  orderPriceAfter: (price: string) => string;
  /** «Pasūtīt dīlera datus · 17,49 €» */
  orderDealer: (price: string) => string;
  /** Loga virsraksts - tikai «BLACK FRIDAY» (Nila labojums 26.11). */
  popEyebrow: string;
  noThanks: string;
  close: string;
  timerAria: string;
  regionAria: string;
  until: string;
  /** Taimera vienības: dienas, stundas, minūtes, sekundes. */
  units: [string, string, string, string];
  /** Dienu saīsinājums rindas taimerī («5 d 08:15:24»). */
  dayShort: string;
  /** «Pasūtīt dīlera datus - 17,49 €» (logs). */
  orderDealerDash: (price: string) => string;
  /** Faktu rinda logā: «★ 5,0 Google · Izpilde 24 h · Pēc VIN vai numura». */
  factRating: string;
  factTurnaround: string;
  factInput: string;
  /** Garantijas teikums akcijas laikā: summa nav 24,99 €, bet samaksātā. */
  creditFrom: RegExp;
  creditTo: string;
};

const COPY: Record<PromoLocale, BlackFridayCopy> = {
  lv: {
    eyebrow: "Black Friday",
    dealerLong: "Oficiālie dīlera servisa dati",
    dealerShort: "Dīlera dati",
    endsIn: "Beidzas pēc",
    order: "Pasūtīt",
    orderWithPrice: (p) => `${p} - Pasūtīt`,
    orderPriceAfter: (p) => `Pasūtīt - ${p}`,
    orderDealer: (p) => `Pasūtīt dīlera datus · ${p}`,
    popEyebrow: "Black Friday",
    noThanks: "Nē, paldies",
    close: "Aizvērt",
    timerAria: "Līdz akcijas beigām",
    regionAria: "Black Friday piedāvājums",
    until: "Akcija līdz 01.12. 23:59",
    units: ["dienas", "stundas", "min", "sek"],
    dayShort: "d",
    orderDealerDash: (p) => `Pasūtīt dīlera datus - ${p}`,
    factRating: "5,0 Google",
    factTurnaround: "Izpilde 24 h",
    factInput: "Pēc VIN vai numurzīmes",
    creditFrom: /24,99[ \u00a0]€ ieskaitām/,
    creditTo: "samaksāto summu ieskaitām",
  },
  en: {
    eyebrow: "Black Friday",
    dealerLong: "Official dealer service data",
    dealerShort: "Dealer data",
    endsIn: "Ends in",
    order: "Order",
    orderWithPrice: (p) => `${p} - Order`,
    orderPriceAfter: (p) => `Order - ${p}`,
    orderDealer: (p) => `Order dealer data · ${p}`,
    popEyebrow: "Black Friday",
    noThanks: "No, thanks",
    close: "Close",
    timerAria: "Until the offer ends",
    regionAria: "Black Friday offer",
    until: "Offer until 1 Dec, 23:59",
    units: ["days", "hours", "min", "sec"],
    dayShort: "d",
    orderDealerDash: (p) => `Order dealer data - ${p}`,
    factRating: "5.0 Google",
    factTurnaround: "Delivery 24 h",
    factInput: "By VIN or licence plate",
    creditFrom: /the €24\.99 is credited/,
    creditTo: "the amount paid is credited",
  },
  de: {
    eyebrow: "Black Friday",
    dealerLong: "Offizielle Händler-Servicedaten",
    dealerShort: "Händlerdaten",
    endsIn: "Endet in",
    order: "Bestellen",
    orderWithPrice: (p) => `${p} - Bestellen`,
    orderPriceAfter: (p) => `Bestellen - ${p}`,
    orderDealer: (p) => `Händlerdaten bestellen · ${p}`,
    popEyebrow: "Black Friday",
    noThanks: "Nein, danke",
    close: "Schließen",
    timerAria: "Bis zum Ende der Aktion",
    regionAria: "Black-Friday-Angebot",
    until: "Aktion bis 01.12., 23:59",
    units: ["Tage", "Std.", "Min.", "Sek."],
    dayShort: "T",
    orderDealerDash: (p) => `Händlerdaten bestellen - ${p}`,
    factRating: "5,0 Google",
    factTurnaround: "Bearbeitung 24 h",
    factInput: "Per FIN oder Kennzeichen",
    creditFrom: /die 24,99[ \u00a0]€ auf/,
    creditTo: "den bezahlten Betrag auf",
  },
  ru: {
    eyebrow: "Black Friday",
    dealerLong: "Данные официального дилера",
    dealerShort: "Данные дилера",
    endsIn: "До конца",
    order: "Заказать",
    orderWithPrice: (p) => `${p} - Заказать`,
    orderPriceAfter: (p) => `Заказать - ${p}`,
    orderDealer: (p) => `Заказать данные дилера · ${p}`,
    popEyebrow: "Black Friday",
    noThanks: "Нет, спасибо",
    close: "Закрыть",
    timerAria: "До конца акции",
    regionAria: "Предложение Black Friday",
    until: "Акция до 01.12, 23:59",
    units: ["дней", "часов", "мин", "сек"],
    dayShort: "д",
    orderDealerDash: (p) => `Заказать данные дилера - ${p}`,
    factRating: "5,0 Google",
    factTurnaround: "Срок 24 ч",
    factInput: "По VIN или номерному знаку",
    creditFrom: /24,99[ \u00a0]€ засчитаем/,
    creditTo: "уплаченную сумму засчитаем",
  },
};

export function getBlackFridayCopy(locale?: string | null): BlackFridayCopy {
  return COPY[promoLocale(locale)];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Atlikušais laiks līdz akcijas beigām: [dienas, stundas, min, sek] ar divām zīmēm. */
export function blackFridayCountdownParts(nowMs: number, endMs: number = BLACK_FRIDAY_END_EXCLUSIVE_MS): [string, string, string, string] {
  let s = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  return [pad(d), pad(Math.floor(s / 3600)), pad(Math.floor((s % 3600) / 60)), pad(s % 60)];
}

/** «5 d 08:15:24» */
export function blackFridayCountdownLine(nowMs: number, locale?: string | null): string {
  const [d, h, m, s] = blackFridayCountdownParts(nowMs);
  return `${Number(d)}\u00a0${getBlackFridayCopy(locale).dayShort} ${h}:${m}:${s}`;
}

/** Garantijas teksts akcijas laikā: «…, samaksāto summu ieskaitām audita cenā.» */
export function blackFridayGuaranteeText(text: string, locale?: string | null): string {
  const c = getBlackFridayCopy(locale);
  return text.replace(c.creditFrom, c.creditTo);
}
