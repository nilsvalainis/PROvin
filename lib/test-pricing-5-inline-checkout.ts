import {
  isPlausibleListingUrl,
  isValidVinOrPlate,
  normalizeVin,
} from "@/lib/order-field-validation";
import { HOME_PRICING_CHECKOUT_SOURCE } from "@/lib/home-pricing-checkout";
import { TP5_CHECKOUT_SOURCE } from "@/lib/test-pricing-5-checkout-routing";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export const TP5_INLINE_CHECKOUT_SOURCE = "test-pricing-5" as const;

export type Tp5StripeCheckoutProduct = {
  productName: string;
  /** Ja nav — Stripe Checkout rāda tikai nosaukumu un cenu. */
  productDesc?: string;
  amountCents: number;
};

/** Sākumlapa un vēsturiski tp5/test-checkout avoti — vienmēr `price_data` (bez Stripe Catalog ID). */
export const TP5_STRIPE_CHECKOUT_PRODUCT: Record<
  Extract<TestPricingPlanId, "plus" | "premium" | "dealer" | "koreaUsa">,
  Tp5StripeCheckoutProduct
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc:
      "Latvijā ekspluatētiem auto. Bez maksas starptautisko datubāžu pārbaudes. Citiem auto izvēlies PROVIN AUDITS.",
    amountCents: 3999,
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc:
      "Pilna vēstures pārbaude maksas datubāzēs, sludinājuma un risku analīze.",
    amountCents: 9999,
  },
  dealer: {
    productName: "Oficiālā dīlera servisa vēstures dati",
    productDesc:
      "Oficiālie dīlera servisa vēstures ieraksti. Ja dati nav pieejami, 100% naudas atmaksa.",
    amountCents: 2499,
  },
  koreaUsa: {
    productName: "ASV UN KOREJA",
    productDesc:
      "ASV un Korejas reģistru, izsoļu arhīva un bojājumu pārbaude. Ja dati nav pieejami, 100% naudas atmaksa.",
    amountCents: 1999,
  },
};

export function isTp5CheckoutSource(sourcePage: string): boolean {
  return (
    sourcePage === TP5_INLINE_CHECKOUT_SOURCE ||
    sourcePage === TP5_CHECKOUT_SOURCE ||
    sourcePage === HOME_PRICING_CHECKOUT_SOURCE
  );
}

const TP5_MINI_CHECKOUT_NOTE = {
  lv: "PROVIN MINI ir paredzēts Latvijā ekspluatētiem auto bez maksas starptautisko datubāžu pārbaudes. Citiem auto izvēlies PROVIN AUDITS.",
  en: "PROVIN MINI is for cars used in Latvia and does not include paid international database checks. For other cars, choose PROVIN AUDITS.",
  de: "PROVIN MINI ist für Autos gedacht, die in Lettland genutzt wurden, und enthält keine kostenpflichtige Prüfung internationaler Datenbanken. Für andere Autos wählen Sie PROVIN AUDITS.",
  ru: "PROVIN MINI рассчитан на автомобили, которые эксплуатировались в Латвии, и не включает платную проверку международных баз. Для остальных машин выберите PROVIN AUDITS.",
} as const;

const TP5_DEALER_CHECKOUT_NOTE = {
  lv: "Oficiālā dīlera servisa vēsture. Ja dati nav pieejami, 100% naudas atmaksa.",
  en: "Official dealer service history. 100% refund if no data is available.",
  de: "Servicehistorie des offiziellen Händlers. 100 % Rückerstattung, wenn keine Daten vorliegen.",
  ru: "Сервисная история официального дилера. 100 % возврат, если данных нет.",
} as const;

const TP5_KOREA_USA_CHECKOUT_NOTE = {
  lv: "ASV un Korejas reģistru, izsoļu arhīva un bojājumu pārbaude. Ja dati nav pieejami, 100% naudas atmaksa.",
  en: "US and Korea registry, auction archive and damage check. 100% refund if no data is available.",
  de: "Prüfung der US- und Korea-Register, des Auktionsarchivs und der Schäden. 100 % Rückerstattung, wenn keine Daten vorliegen.",
  ru: "Проверка реестров США и Кореи, архива аукционов и повреждений. 100 % возврат, если данных нет.",
} as const;

function checkoutNoteLocale(locale?: string): "lv" | "en" | "de" | "ru" {
  if (locale === "en" || locale === "de" || locale === "ru") return locale;
  return "lv";
}

/** Stripe Checkout submit note (step 2) for PROVIN MINI. */
export function getTp5MiniCheckoutNote(locale?: string): string {
  return TP5_MINI_CHECKOUT_NOTE[checkoutNoteLocale(locale)];
}

/** Stripe `custom_text.submit.message` when the selected plan needs a pre-pay note. */
export function getTp5CheckoutSubmitMessage(
  planId: TestPricingPlanId,
  locale?: string,
): string | null {
  if (planId === "plus") return getTp5MiniCheckoutNote(locale);
  if (planId === "dealer") return TP5_DEALER_CHECKOUT_NOTE[checkoutNoteLocale(locale)];
  if (planId === "koreaUsa") return TP5_KOREA_USA_CHECKOUT_NOTE[checkoutNoteLocale(locale)];
  return null;
}

const TP5_STRIPE_CHECKOUT_PRODUCT_EN: Record<
  keyof typeof TP5_STRIPE_CHECKOUT_PRODUCT,
  Pick<Tp5StripeCheckoutProduct, "productName" | "productDesc">
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc:
      "For cars used in Latvia. No paid international database checks. Other cars: choose PROVIN AUDITS.",
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc:
      "Full history check in paid databases, listing and risk analysis.",
  },
  dealer: {
    productName: "Official dealer service history data",
    productDesc: "Official dealer service history. 100% refund if no data is available.",
  },
  koreaUsa: {
    productName: "USA & KOREA",
    productDesc:
      "US and Korea registry, auction archive and damage check. 100% refund if no data is available.",
  },
};

const TP5_STRIPE_CHECKOUT_PRODUCT_DE: Record<
  keyof typeof TP5_STRIPE_CHECKOUT_PRODUCT,
  Pick<Tp5StripeCheckoutProduct, "productName" | "productDesc">
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc:
      "Für Autos, die in Lettland genutzt wurden. Ohne kostenpflichtige Prüfung internationaler Datenbanken. Andere Autos: PROVIN AUDITS.",
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc:
      "Vollständige Historienprüfung in kostenpflichtigen Datenbanken, Analyse von Inserat und Risiken.",
  },
  dealer: {
    productName: "Servicehistorie des offiziellen Händlers",
    productDesc: "Servicehistorie des offiziellen Händlers. 100 % Rückerstattung, wenn keine Daten vorliegen.",
  },
  koreaUsa: {
    productName: "USA UND KOREA",
    productDesc:
      "Prüfung der US- und Korea-Register, des Auktionsarchivs und der Schäden. 100 % Rückerstattung, wenn keine Daten vorliegen.",
  },
};

const TP5_STRIPE_CHECKOUT_PRODUCT_RU: Record<
  keyof typeof TP5_STRIPE_CHECKOUT_PRODUCT,
  Pick<Tp5StripeCheckoutProduct, "productName" | "productDesc">
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc:
      "Для автомобилей, которые эксплуатировались в Латвии. Без платной проверки международных баз. Для остальных: PROVIN AUDITS.",
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc: "Полная проверка истории в платных базах, разбор объявления и анализ рисков.",
  },
  dealer: {
    productName: "Сервисная история официального дилера",
    productDesc: "Сервисная история официального дилера. 100 % возврат, если данных нет.",
  },
  koreaUsa: {
    productName: "США И КОРЕЯ",
    productDesc:
      "Проверка реестров США и Кореи, архива аукционов и повреждений. 100 % возврат, если данных нет.",
  },
};

export function getTp5StripeCheckoutProduct(
  planId: TestPricingPlanId,
  locale?: string,
): Tp5StripeCheckoutProduct | null {
  if (planId === "plus" || planId === "premium" || planId === "dealer" || planId === "koreaUsa") {
    const row = TP5_STRIPE_CHECKOUT_PRODUCT[planId];
    if (locale === "en") return { ...row, ...TP5_STRIPE_CHECKOUT_PRODUCT_EN[planId] };
    if (locale === "de") return { ...row, ...TP5_STRIPE_CHECKOUT_PRODUCT_DE[planId] };
    if (locale === "ru") return { ...row, ...TP5_STRIPE_CHECKOUT_PRODUCT_RU[planId] };
    return row;
  }
  return null;
}

export type Tp5InlineFieldErrors = {
  listingUrl?: string;
  vin?: string;
};

const TP5_INLINE_FIELD_MESSAGES = {
  lv: {
    listingUrl: "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.",
    vin: "Ievadi derīgu VIN kodu vai valsts numurzīmi (3-6 zīmes).",
  },
  en: {
    listingUrl: "Please enter the full link to a specific listing.",
    vin: "Enter a valid VIN or licence plate number (3-6 characters).",
  },
  de: {
    listingUrl: "Bitte den vollständigen Link zu einem konkreten Inserat eingeben.",
    vin: "Bitte eine gültige VIN oder ein Kennzeichen eingeben (3-6 Zeichen).",
  },
  ru: {
    listingUrl: "Введите полную ссылку на конкретное объявление.",
    vin: "Введите корректный VIN или госномер (3-6 знаков).",
  },
} as const;

export function validateTp5InlineFields(
  listingUrl: string,
  vin: string,
  locale?: string,
): { ok: true } | { ok: false; errors: Tp5InlineFieldErrors } {
  const messages = TP5_INLINE_FIELD_MESSAGES[checkoutNoteLocale(locale)];
  const errors: Tp5InlineFieldErrors = {};
  const listing = listingUrl.trim();

  /** Sludinājuma saite nav obligāta — pārbauda tikai tad, ja ievadīta. */
  if (listing && !isPlausibleListingUrl(listing)) {
    errors.listingUrl = messages.listingUrl;
  }

  const normalized = normalizeVin(vin.trim());
  if (!normalized || !isValidVinOrPlate(normalized)) {
    errors.vin = messages.vin;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
