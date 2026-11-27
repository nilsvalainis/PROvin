/**
 * Pasūtījuma `notes` laukā sistēma glabā gan klienta brīvo tekstu, gan iekšējās
 * servera atzīmes (B2B partneris, maks, lots, valoda). Atzīmes vajag adminam un
 * loģikai, bet klientam (PDF, e-pasts, klienta saite) un AI kā «klienta komentārs»
 * tās nekad nedrīkst parādīties. Šī funkcija atstāj tikai patieso klienta tekstu.
 */

/** Zināmās iekšējās atslēgas `atslēga=vērtība` formā. */
const INTERNAL_NOTE_KEYS = [
  "partner_id",
  "partner_company",
  "audit_purpose",
  "lot",
  "checkout_line",
  "wallet_txn",
  "wallet_product",
  "wallet_cents",
  "report_lang",
  "source",
  "ref",
  "fulfillment",
  "plan",
  "session_id",
  "order_id",
  "fbclid",
  "gclid",
] as const;

/** Atslēgas, kuru vērtībā var būt atstarpes (līdz nākamajam « · »). */
const SEGMENT_VALUE_KEYS = new Set<string>(["partner_company"]);

const KEY_ALT = INTERNAL_NOTE_KEYS.join("|");
/** Zināma atslēga vai jebkura `utm_*`, vai mašīnas stila `snake_case` atslēga. */
const KEY_PATTERN = `(?:${KEY_ALT}|utm_[a-z0-9_]+|[a-z][a-z0-9]*_[a-z0-9_]+)`;

const SEGMENT_KEY_RE = new RegExp(`^(${KEY_PATTERN})=`, "i");
const TOKEN_RE = new RegExp(`(^|[\\s>])${KEY_PATTERN}=[^\\s<]*`, "gi");
/** «B2B business», «B2B dealer» u.c. sistēmas prefiksi. */
const B2B_PREFIX_RE = /^B2B(?:\s+(?:business|dealer|dealer_raw|dealer_pro|wallet))?$/i;

const TAG_RE = /<[^>]+>/g;

function cleanSegment(segment: string): string {
  const s = segment.trim();
  if (!s) return "";
  // Bagātinātā teksta piezīmēs (`<p>B2B business · …</p>`) HTML tagi paliek, teksts ne.
  const tagsOnly = (s.match(TAG_RE) ?? []).join("");
  const plain = s.replace(TAG_RE, "").trim();
  if (B2B_PREFIX_RE.test(plain)) return tagsOnly;
  const head = plain.match(SEGMENT_KEY_RE);
  if (head && SEGMENT_VALUE_KEYS.has(head[1].toLowerCase())) return tagsOnly;
  return s.replace(TOKEN_RE, "$1").replace(/\s{2,}/g, " ").trim();
}

function cleanLine(line: string): string {
  if (!line.includes("=") && !/\bB2B\b/.test(line)) return line.trimEnd();
  return line
    .split(/\s*·\s*/)
    .map(cleanSegment)
    .filter(Boolean)
    .reduce((acc, seg) => {
      const textual = seg.replace(TAG_RE, "").trim().length > 0;
      if (!acc) return seg;
      const prevTextual = acc.replace(TAG_RE, "").trim().length > 0;
      return textual && prevTextual ? `${acc} · ${seg}` : `${acc}${seg}`;
    }, "");
}

/**
 * Klientam redzamais komentārs: bez «B2B …» prefiksa, bez iekšējām `atslēga=vērtība`
 * atzīmēm un bez liekiem « · » atdalītājiem. `null`, ja nekas nepaliek.
 */
export function clientVisibleComment(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map(cleanLine);
  const joined = lines.join("\n");
  // Ja palika tikai tukši HTML tagi - komentāra nav.
  if (!joined.replace(TAG_RE, "").replace(/&nbsp;|\u00a0/g, " ").trim()) return null;
  const text = joined
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

const AI_PARTNER_COMPANY_RE = /partner_company=([^·\n]+)/i;
const AI_AUDIT_PURPOSE_RE = /audit_purpose=(client|internal)\b/i;

/**
 * AI drīkst zināt, ka pasūtījums ir no B2B partnera (iekšējs konteksts), bet ne kā
 * «klienta komentārs» un bez ID / maka summām. Tukša virkne, ja nav partnera atzīmju.
 */
export function b2bPartnerAiContextLine(raw: string | null | undefined): string {
  const text = raw ?? "";
  if (!/partner_id=|^\s*B2B\s+(?:business|dealer)\b/im.test(text)) return "";
  const company = text.match(AI_PARTNER_COMPANY_RE)?.[1]?.trim();
  const purpose = text.match(AI_AUDIT_PURPOSE_RE)?.[1]?.toLowerCase();
  const purposeLv = purpose === "internal" ? "partnera iekšējai lietošanai" : purpose === "client" ? "partnera klientam" : "";
  const bits = [company ? `partneris ${company}` : "partneris", purposeLv].filter(Boolean).join(", ");
  return `B2B pasūtījums (iekšējs konteksts, ne klienta komentārs; klientam nerakstīt): ${bits}`;
}
