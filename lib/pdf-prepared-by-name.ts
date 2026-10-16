/**
 * PDF kājene „Sagatavots”: privātpersonai „Vārds U.”, uzņēmumam - pilns nosaukums.
 */

const COMPANY_FORM_RE =
  /\b(SIA|IK|AS|UAB|OÜ|OY|GmbH|Ltd|LLC|AB|S\.A\.|Sp\.?\s*z\s*o\.?\s*o\.?)\b/i;
const COMPANY_WORD_RE = /\b(AUTO|AUTOS|CARS|MOTORS|MOTOR|CENTRS|CENTER|GROUP|SERVICE|SERVISS|TRADE)\b/i;

function lettersOnly(s: string): string {
  return s.replace(/[^A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]/g, "");
}

export function pdfCustomerNameLooksLikeCompany(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (COMPANY_FORM_RE.test(t) || COMPANY_WORD_RE.test(t)) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    const letters = lettersOnly(t);
    return letters.length >= 6 && letters === letters.toLocaleUpperCase("lv");
  }
  return false;
}

/** Privātpersona: pirmais vārds + uzvārda iniciālis. Uzņēmums: pilns nosaukums. */
export function formatPdfPreparedByName(name: string): string {
  const t = name.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (pdfCustomerNameLooksLikeCompany(t)) return t;
  const parts = t.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const initial = last.charAt(0).toLocaleUpperCase("lv");
  if (!initial) return first;
  return `${first} ${initial}.`;
}
