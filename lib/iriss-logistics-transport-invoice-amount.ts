/**
 * Auto1 Transport Invoice PDF teksta parsēšana - mēģina atrast transporta rēķina kopsummu,
 * lai to automātiski ieliktu Pašizmaksas transporta laukā. Strādā gan ar EN formātu (1,234.56),
 * gan DE/LV formātu (1.234,56 / 1 234,56).
 */

export type TransportInvoiceParseResult =
  | { ok: true; amountEur: number; confidence: "label" | "fallback" }
  | { ok: false; reason: "empty_text" | "no_amount_found" };

const TOTAL_LABEL_RE =
  /\btotal\s*(?:amount|price|sum|cost|due|payable)?\b|\bamount\s*due\b|\binvoice\s*total\b|\bgrand\s*total\b|gesamtbetrag|rechnungsbetrag|gesamtsumme|endbetrag|kopā\s*apmaksai|kopsumma|apmaksai/gi;

const LABEL_WINDOW_CHARS = 200;

/** "1,234.56" (EN), "1.234,56" / "1 234,56" (DE/LV), "1234.56", "1234,56" -> skaitlis ar centiem. */
function parseAmountToken(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    const lastComma = t.lastIndexOf(",");
    const lastDot = t.lastIndexOf(".");
    normalized = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (hasComma) {
    const digitsAfter = t.length - t.lastIndexOf(",") - 1;
    normalized = digitsAfter === 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (hasDot) {
    const digitsAfter = t.length - t.lastIndexOf(".") - 1;
    normalized = digitsAfter === 2 ? t : t.replace(/\./g, "");
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
}

const AMOUNT_TOKEN = String.raw`\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?`;
const CURRENCY_MARKED_RE = new RegExp(`(?:€|eur\\b)\\s*(${AMOUNT_TOKEN})|(${AMOUNT_TOKEN})\\s*(?:€|eur\\b)`, "gi");
const BARE_DECIMAL_RE = new RegExp(`\\d{1,3}(?:[.,\\s]\\d{3})*[.,]\\d{2}\\b`, "g");

function currencyMarkedAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CURRENCY_MARKED_RE)) {
    const n = parseAmountToken((m[1] || m[2] || "").replace(/\s/g, ""));
    if (n != null) out.push(n);
  }
  return out;
}

function bareDecimalAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(BARE_DECIMAL_RE)) {
    const n = parseAmountToken(m[0].replace(/\s/g, ""));
    if (n != null) out.push(n);
  }
  return out;
}

/**
 * Auto-aizpilde drīkst pārrakstīt tikai tukšu vai iepriekš auto-aizpildītu vērtību -
 * lietotāja ar roku ievadītu summu PDF parsētājs nekad nepārraksta.
 */
export function shouldAutofillTransportCost(order: { transportCostEur: number | null; transportCostAuto: boolean }): boolean {
  return order.transportCostEur == null || order.transportCostAuto === true;
}

export function parseTransportInvoiceAmount(text: string): TransportInvoiceParseResult {
  const clean = text.replace(/ /g, " ").trim();
  if (!clean) return { ok: false, reason: "empty_text" };

  for (const m of clean.matchAll(TOTAL_LABEL_RE)) {
    const idx = m.index ?? 0;
    const window = clean.slice(idx, idx + LABEL_WINDOW_CHARS);
    const marked = currencyMarkedAmounts(window);
    if (marked.length > 0) return { ok: true, amountEur: marked[0]!, confidence: "label" };
    const bare = bareDecimalAmounts(window);
    if (bare.length > 0) return { ok: true, amountEur: bare[0]!, confidence: "label" };
  }

  const all = currencyMarkedAmounts(clean);
  if (all.length > 0) return { ok: true, amountEur: Math.max(...all), confidence: "fallback" };

  return { ok: false, reason: "no_amount_found" };
}
