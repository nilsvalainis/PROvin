import type Stripe from "stripe";
import { isAppLocale, type AppLocale } from "@/i18n/locales";

export type CheckoutLineKind =
  | "audit"
  | "consultation"
  | "provin_select"
  | "mini"
  | "premium"
  | "dealer"
  | "business";

/** Stripe Checkout `metadata.checkout_line` — vecām sesijām bez lauka uzskatām par `audit`. */
export function getCheckoutLineFromSession(session: Stripe.Checkout.Session): CheckoutLineKind {
  const raw = session.metadata?.checkout_line?.trim().toLowerCase();
  if (raw === "provin_select") return "provin_select";
  if (raw === "consultation") return "consultation";
  if (raw === "mini") return "mini";
  if (raw === "listing_filter") return "mini";
  if (raw === "premium") return "premium";
  if (raw === "dealer") return "dealer";
  if (raw === "business") return "business";
  if (raw === "plus") return "mini";
  return "audit";
}

/** Hosted Stripe Checkout chrome follows the page locale. */
export function stripeCheckoutLocale(locale?: string): AppLocale {
  return isAppLocale(locale) ? locale : "lv";
}

export const HEARD_ABOUT_FIELD_KEY = "heard_about";

export const HEARD_ABOUT_OPTION_VALUES = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "google",
  "other",
] as const;

export type HeardAboutValue = (typeof HEARD_ABOUT_OPTION_VALUES)[number];

const HEARD_ABOUT_LABELS: Record<HeardAboutValue, Record<"lv" | "en" | "de" | "ru", string>> = {
  tiktok: { lv: "TikTok", en: "TikTok", de: "TikTok", ru: "TikTok" },
  instagram: { lv: "Instagram", en: "Instagram", de: "Instagram", ru: "Instagram" },
  facebook: { lv: "Facebook", en: "Facebook", de: "Facebook", ru: "Facebook" },
  youtube: { lv: "YouTube", en: "YouTube", de: "YouTube", ru: "YouTube" },
  google: { lv: "Google", en: "Google", de: "Google", ru: "Google" },
  other: { lv: "Cits", en: "Other", de: "Sonstiges", ru: "Другое" },
};

function checkoutFieldLocale(locale?: string): "lv" | "en" | "de" | "ru" {
  if (locale === "en" || locale === "de" || locale === "ru") return locale;
  return "lv";
}

export function isHeardAboutValue(v: string | null | undefined): v is HeardAboutValue {
  return Boolean(v && (HEARD_ABOUT_OPTION_VALUES as readonly string[]).includes(v));
}

export function heardAboutDisplayLabel(
  value: string | null | undefined,
  locale?: string,
): string | null {
  if (!isHeardAboutValue(value)) return value?.trim() || null;
  return HEARD_ABOUT_LABELS[value][checkoutFieldLocale(locale)];
}

/** Rinda, ko agrāk līmējām klienta piezīmēs. PDF un klienta komentārā tai nav jāparādās. */
const HEARD_ABOUT_NOTE_LINE = /^\s*(?:<p[^>]*>\s*)?Kur uzzināja:\s*\S.*$/i;

/** Izņem tikai „Kur uzzināja: …” rindas. Pārējais klienta komentārs paliek. */
export function stripHeardAboutFromClientNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const kept = notes
    .replace(/<p[^>]*>\s*Kur uzzināja:\s*[^<]*<\/p>/gi, "")
    .split(/\r?\n/)
    .filter((line) => !HEARD_ABOUT_NOTE_LINE.test(line));
  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text || null;
}

/**
 * Stripe Checkout „Kur uzzinājāt par mums?” - dropdown, jo hosted Checkout
 * nezīmē čipus. Tās pašas opcijas, ko dizainā rādījām kā čipus.
 */
export function getHeardAboutCustomField(
  locale?: string,
): Stripe.Checkout.SessionCreateParams.CustomField {
  const loc = checkoutFieldLocale(locale);
  const title =
    loc === "en"
      ? "How did you hear about us?"
      : loc === "de"
        ? "Wie haben Sie von uns erfahren?"
        : loc === "ru"
          ? "Как вы о нас узнали?"
          : "Kur uzzinājāt par mums?";
  return {
    key: HEARD_ABOUT_FIELD_KEY,
    label: { type: "custom", custom: title },
    type: "dropdown",
    optional: true,
    dropdown: {
      options: HEARD_ABOUT_OPTION_VALUES.map((value) => ({
        label: HEARD_ABOUT_LABELS[value][loc],
        value,
      })),
    },
  };
}

/**
 * Stripe Checkout papildu lauks „Komentārs” — īsa piezīme pirms apmaksas.
 * Hosted Checkout neatbalsta placeholder tekstu; etiķete ir „Komentārs”.
 * Stripe `custom_fields` ierobežojumi: viena rinda, max 255 rakstzīmes.
 */
export const CLIENT_COMMENT_CUSTOM_FIELD = {
  key: "client_comment",
  label: { type: "custom", custom: "Komentārs" },
  type: "text",
  optional: true,
  text: { maximum_length: 255 },
} satisfies Stripe.Checkout.SessionCreateParams.CustomField;

export function getClientCommentCustomField(
  locale?: string,
): Stripe.Checkout.SessionCreateParams.CustomField {
  if (locale === "en") {
    return { ...CLIENT_COMMENT_CUSTOM_FIELD, label: { type: "custom", custom: "Comment" } };
  }
  if (locale === "de") {
    return { ...CLIENT_COMMENT_CUSTOM_FIELD, label: { type: "custom", custom: "Kommentar" } };
  }
  if (locale === "ru") {
    return { ...CLIENT_COMMENT_CUSTOM_FIELD, label: { type: "custom", custom: "Комментарий" } };
  }
  return CLIENT_COMMENT_CUSTOM_FIELD;
}

/** Sociālie tīkli + komentārs. Stripe hosted max 3 custom lauki; šie ir 2. */
export function getCheckoutIntakeCustomFields(
  locale?: string,
): Stripe.Checkout.SessionCreateParams.CustomField[] {
  return [getHeardAboutCustomField(locale), getClientCommentCustomField(locale)];
}

export function getCustomFieldValue(
  session: Stripe.Checkout.Session,
  key: string
): string | null {
  const fields = session.custom_fields ?? [];
  for (const f of fields) {
    if (f.key !== key) continue;
    if (f.type === "text" && f.text?.value) return f.text.value;
    if (f.type === "numeric" && f.numeric?.value != null) return String(f.numeric.value);
    if (f.type === "dropdown" && f.dropdown?.value) return f.dropdown.value;
  }
  return null;
}

export function formatStripeCheckoutAddress(
  address: Stripe.Address | null | undefined,
): string | null {
  if (!address) return null;
  const cityLine = [address.postal_code, address.city].filter(Boolean).join(" ").trim();
  const parts = [address.line1, address.line2, cityLine || null, address.country]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Jaunākās pasūtījuma formas dati ir `metadata`; vecākām sesijām - Stripe custom lauki. */
export function getOrderFieldsFromSession(session: Stripe.Checkout.Session): {
  vin: string | null;
  listingUrl: string | null;
  contactMethod: string | null;
  customerName: string | null;
  notes: string | null;
  heardAbout: string | null;
  formPhone: string | null;
  companyName: string | null;
  companyReg: string | null;
  companyAddress: string | null;
} {
  const m = session.metadata ?? {};
  const meta = (k: string) => {
    const v = m[k];
    if (typeof v !== "string" || !v.trim()) return null;
    return v.trim();
  };

  /** Formas piezīmes (`metadata.notes`) + Stripe lapā ievadītais „Komentārs”. */
  const metaNotes = meta("notes");
  const clientComment = getCustomFieldValue(session, "client_comment")?.trim() || null;
  const heardRaw = meta(HEARD_ABOUT_FIELD_KEY) ?? getCustomFieldValue(session, HEARD_ABOUT_FIELD_KEY);
  const heardLabel = heardAboutDisplayLabel(heardRaw, "lv");
  const commentParts = [metaNotes, clientComment].filter((p): p is string => Boolean(p));
  const uniqueComments = commentParts.filter((p, i) => commentParts.indexOf(p) === i);
  const notes = stripHeardAboutFromClientNotes(uniqueComments.length ? uniqueComments.join("\n\n") : null);

  return {
    vin: meta("vin") ?? getCustomFieldValue(session, "vin"),
    listingUrl: meta("listing_url") ?? getCustomFieldValue(session, "listing_url"),
    contactMethod: meta("contact_method") ?? getCustomFieldValue(session, "contact_method"),
    customerName: meta("customer_name") ?? session.customer_details?.name?.trim() ?? null,
    notes,
    heardAbout: heardLabel,
    formPhone: meta("phone"),
    companyName: meta("company_name"),
    companyReg: meta("company_reg"),
    companyAddress: meta("company_address") ?? formatStripeCheckoutAddress(session.customer_details?.address),
  };
}

/** Stripe Checkout `metadata` — PROVIN SELECT stratēģijas anketa (atbilst `ConsultationDraftOrderEdits`). */
export type ProvinSelectSessionMetadata = {
  selectBrandModel: string | null;
  selectProductionYearsDpf: string | null;
  selectPlannedBudget: string | null;
  selectEngineType: string | null;
  selectTransmission: string | null;
  selectMaxMileage: string | null;
  selectExteriorColor: string | null;
  selectInteriorMaterial: string | null;
  selectRequiredEquipment: string | null;
  selectDesiredEquipment: string | null;
};

export function getProvinSelectFieldsFromSession(session: Stripe.Checkout.Session): ProvinSelectSessionMetadata {
  const m = session.metadata ?? {};
  const meta = (k: string) => {
    const v = m[k];
    if (typeof v !== "string" || !v.trim()) return null;
    return v.trim();
  };
  return {
    selectBrandModel: meta("select_brand_model"),
    selectProductionYearsDpf: meta("select_production_years"),
    selectPlannedBudget: meta("select_planned_budget"),
    selectEngineType: meta("select_engine_type"),
    selectTransmission: meta("select_transmission"),
    selectMaxMileage: meta("select_max_mileage"),
    selectExteriorColor: meta("select_exterior_color"),
    selectInteriorMaterial: meta("select_interior_material"),
    selectRequiredEquipment: meta("select_required_equipment"),
    selectDesiredEquipment: meta("select_desired_equipment"),
  };
}

/**
 * Stripe Checkout sesijas kopējā summa centos.
 * Dažos izlaidumos `amount_total` var būt `null` pat apmaksātai sesijai — tad ņemam summu no izvērstām `line_items`.
 */
export function resolveCheckoutSessionAmountTotalCents(session: Stripe.Checkout.Session): number | null {
  if (typeof session.amount_total === "number" && session.amount_total > 0) {
    return session.amount_total;
  }
  const raw = session.line_items;
  if (!raw || typeof raw === "string") return null;
  const data = raw.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  let sum = 0;
  for (const item of data) {
    if (typeof item.amount_total === "number") sum += item.amount_total;
  }
  return sum > 0 ? sum : null;
}
