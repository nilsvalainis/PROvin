import type Stripe from "stripe";

export type CheckoutLineKind = "audit" | "consultation" | "provin_select";

/** Stripe Checkout `metadata.checkout_line` — vecām sesijām bez lauka uzskatām par `audit`. */
export function getCheckoutLineFromSession(session: Stripe.Checkout.Session): CheckoutLineKind {
  const raw = session.metadata?.checkout_line?.trim().toLowerCase();
  if (raw === "provin_select") return "provin_select";
  if (raw === "consultation") return "consultation";
  return "audit";
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

/** Jaunākās pasūtījuma formas dati ir `metadata`; vecākām sesijām — Stripe custom lauki. */
export function getOrderFieldsFromSession(session: Stripe.Checkout.Session): {
  vin: string | null;
  listingUrl: string | null;
  contactMethod: string | null;
  customerName: string | null;
  notes: string | null;
  formPhone: string | null;
} {
  const m = session.metadata ?? {};
  const meta = (k: string) => {
    const v = m[k];
    if (typeof v !== "string" || !v.trim()) return null;
    return v.trim();
  };

  return {
    vin: meta("vin") ?? getCustomFieldValue(session, "vin"),
    listingUrl: meta("listing_url") ?? getCustomFieldValue(session, "listing_url"),
    contactMethod: meta("contact_method") ?? getCustomFieldValue(session, "contact_method"),
    customerName: meta("customer_name"),
    notes: meta("notes"),
    formPhone: meta("phone"),
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
