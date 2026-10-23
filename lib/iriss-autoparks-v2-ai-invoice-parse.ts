/**
 * F10: servisa rēķina summas AI ieteikuma shēma un atbildes pārbaude (tīra loģika, testējama).
 * Ieteikums nekad nenonāk pašizmaksā bez cilvēka apstiprinājuma (20:17).
 */
import { JsonType, type AiJsonSchema } from "@/lib/ai-json-schema";
import type { V2InvoiceAi } from "@/lib/iriss-autoparks-v2";

export const INVOICE_AI_MODEL = "claude-sonnet-5-5";

export const INVOICE_AI_SCHEMA: AiJsonSchema = {
  type: JsonType.OBJECT,
  properties: {
    found: { type: JsonType.BOOLEAN },
    totalAmount: { type: JsonType.NUMBER },
    currency: { type: JsonType.STRING },
    amountIncludesVat: { type: JsonType.BOOLEAN },
    invoiceDate: { type: JsonType.STRING },
    confidence: { type: JsonType.NUMBER },
  },
  required: ["found", "totalAmount", "currency", "amountIncludesVat", "invoiceDate", "confidence"],
};

export const INVOICE_AI_SYSTEM = `Tu nolasi auto servisa rēķina (Latvija) skenētas lapas.
Atrodi GALĪGO summu apmaksai AR PVN - parasti "Kopā apmaksai", "Summa apmaksai", "Kopā ar PVN", "Total".
Neņem summu bez PVN, PVN summu, atsevišķu rindu summas, avansu vai iepriekšējo parādu.
Ja rēķinā ir vairākas lapas, kopsumma parasti ir pēdējā lapā.
totalAmount - skaitlis eiro ar punktu kā decimālo atdalītāju (piem. 258.4). currency - valūtas kods (EUR).
amountIncludesVat - vai totalAmount ietver PVN. invoiceDate - rēķina datums YYYY-MM-DD vai "".
confidence 0..1 - cik droši, ka tā ir pareizā galīgā summa (ar roku rakstīts, izplūdis vai vairākas iespējamas summas - zemāk).
Ja kopsummu nevar atrast, found=false un totalAmount=0.`;

export function parseInvoiceAiResult(raw: string, model: string, now = new Date()): V2InvoiceAi {
  const base: V2InvoiceAi = { amountEur: null, currency: "", withVat: null, date: "", confidence: null, at: now.toISOString(), model, error: "" };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...base, error: "invalid_json" };
  }
  const amount = typeof o.totalAmount === "number" && Number.isFinite(o.totalAmount) ? Math.round(o.totalAmount * 100) / 100 : null;
  const currency = typeof o.currency === "string" ? o.currency.trim().toUpperCase().slice(0, 8) : "";
  const conf = typeof o.confidence === "number" && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : null;
  const date = typeof o.invoiceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.invoiceDate) ? o.invoiceDate : "";
  if (o.found !== true || amount == null || amount <= 0) return { ...base, currency, confidence: conf, date, error: "not_found" };
  // Ne-EUR summu kā eiro ieteikumu nerāda (pārrēķins nav šī darba daļa).
  if (currency && currency !== "EUR" && currency !== "€") return { ...base, currency, confidence: conf, date, error: "not_eur" };
  return { ...base, amountEur: amount, currency: "EUR", withVat: typeof o.amountIncludesVat === "boolean" ? o.amountIncludesVat : null, date, confidence: conf };
}
