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
