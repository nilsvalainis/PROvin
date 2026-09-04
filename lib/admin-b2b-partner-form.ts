export const ADMIN_PARTNER_FIELD_ERROR: Record<string, string> = {
  companyName: "Uzņēmuma nosaukums ir pārāk īss.",
  companyReg: "Reģistrācijas numurs ir pārāk īss.",
  companyAddress: "Adrese ir pārāk īsa.",
  contactName: "Kontaktpersonas vārds ir pārāk īss.",
  email: "E-pasta adrese nav derīga.",
  phone: "Tālruņa numurs nav derīgs.",
  password: "Parole jābūt vismaz 8 zīmēm.",
  invalid_fields: "Pārbaudi laukus.",
  email_taken: "Šis e-pasts jau ir reģistrēts.",
  weak_password: "Parole jābūt vismaz 8 zīmēm.",
  not_found: "Partneris nav atrasts.",
};

export function adminPartnerApiError(error: string | undefined): string {
  if (!error) return "Neizdevās saglabāt.";
  return ADMIN_PARTNER_FIELD_ERROR[error] ?? "Neizdevās saglabāt.";
}

export const ADMIN_PARTNER_INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)] focus:ring-1 focus:ring-[var(--color-provin-accent)]";

export const ADMIN_PARTNER_LABEL_CLASS =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]";
