/**
 * Valūtas → EUR pārrēķins avotu atskaišu summām (AutoDNA CZK/PLN, CarVertical u.c.).
 *
 * Kursi ir fiksēti orientējoši (statiski) — atskaitēs summas pašas ir aptuvenas
 * (diapazoni), tāpēc ārējs kursu API nav vajadzīgs. Vērtība „cik valūtas vienību par 1 EUR”.
 */

export const EUR_REFERENCE_RATES: Record<string, number> = {
  EUR: 1,
  CZK: 25,
  PLN: 4.3,
  SEK: 11.3,
  NOK: 11.7,
  DKK: 7.46,
  CHF: 0.95,
  GBP: 0.85,
  USD: 1.09,
  CAD: 1.48,
  HUF: 395,
  RON: 4.97,
  BGN: 1.9558,
  UAH: 45,
  TRY: 38,
  RSD: 117,
  MDL: 19.5,
  JPY: 165,
};

/** Teksta apzīmējumi → valūtas kods (garākie vārdi vispirms, lai „Kč” nesajaucas ar „K”). */
const CURRENCY_TOKENS: { code: string; re: RegExp }[] = [
  { code: "EUR", re: /(?:\bEUR\b|€)/i },
  { code: "CZK", re: /(?:\bCZK\b|\bKč\b|\bKc\b|\bkorun)/i },
  { code: "PLN", re: /(?:\bPLN\b|\bzł\b|\bzl\b|\bzlot)/i },
  { code: "SEK", re: /(?:\bSEK\b|\bskr\b)/i },
  { code: "NOK", re: /(?:\bNOK\b|\bnkr\b)/i },
  { code: "DKK", re: /(?:\bDKK\b|\bdkr\b)/i },
  { code: "CHF", re: /(?:\bCHF\b|\bFr\.?\b)/i },
  { code: "GBP", re: /(?:\bGBP\b|£)/i },
  { code: "USD", re: /(?:\bUSD\b|\$)/i },
  { code: "CAD", re: /\bCAD\b/i },
  { code: "HUF", re: /(?:\bHUF\b|\bFt\b|\bforint)/i },
  { code: "RON", re: /(?:\bRON\b|\blei\b)/i },
  { code: "BGN", re: /(?:\bBGN\b|\bлв\b)/i },
  { code: "UAH", re: /(?:\bUAH\b|₴|\bгрн\b)/i },
  { code: "TRY", re: /(?:\bTRY\b|₺)/i },
  { code: "RSD", re: /\bRSD\b/i },
  { code: "MDL", re: /\bMDL\b/i },
  { code: "JPY", re: /(?:\bJPY\b|¥)/i },
];

/** Atrod valūtas kodu summas tekstā („510 000 - 520 000 CZK” → CZK). Tukšs, ja nav apzīmējuma. */
export function detectCurrencyCode(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  for (const { code, re } of CURRENCY_TOKENS) {
    if (re.test(t)) return code;
  }
  return "";
}

function parseNumberToken(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, "");
  // 1.234,56 → 1234.56; 1,234.56 → 1234.56; 1234 → 1234
  let normalized = cleaned;
  if (/,\d{1,2}$/.test(cleaned) && /[.\s]/.test(cleaned.slice(0, -3))) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/,/.test(cleaned) && /\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Summas skaitļi tekstā: viena vērtība vai diapazons (lo/hi). */
export function parseAmountBounds(raw: string): { lo: number; hi: number } | null {
  const t = raw.replace(/\u00a0|\u202f/g, " ").trim();
  if (!t || !/\d/.test(t)) return null;
  const numberRe = /\d[\d\s.,]*/g;
  const tokens = (t.match(numberRe) ?? [])
    .map((s) => s.replace(/[\s.,]+$/, ""))
    .map(parseNumberToken)
    .filter((n): n is number => n != null && n >= 0);
  if (tokens.length === 0) return null;
  const lo = Math.min(...tokens);
  const hi = Math.max(...tokens);
  return { lo, hi };
}

function roundEur(value: number): number {
  if (value >= 1000) return Math.round(value / 10) * 10;
  return Math.round(value);
}

function groupEur(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export type EurConversion = {
  /** Attēlojums admin laukam, piem. „20 400 - 20 800 €”. */
  display: string;
  /** Sākotnējā valūta („EUR”, ja jau eiro vai bez apzīmējuma). */
  fromCurrency: string;
  /** Cik valūtas vienību par 1 EUR (1, ja EUR). */
  ratePerEur: number;
  /** `true`, ja summa tika pārrēķināta no citas valūtas. */
  converted: boolean;
};

/**
 * Summas teksts (jebkurā valūtā) → EUR attēlojums admin „Zaudējumu summa” laukam.
 * Nezināmu valūtu vai teksta bez cipariem neizdomā — atgriež `null`.
 */
export function convertAmountTextToEur(raw: string): EurConversion | null {
  const text = raw.trim();
  if (!text || !/\d/.test(text)) return null;
  const bounds = parseAmountBounds(text);
  if (!bounds) return null;

  const detected = detectCurrencyCode(text);
  const code = detected || "EUR";
  const rate = EUR_REFERENCE_RATES[code];
  if (!rate) return null;

  // EUR summas atstājam tieši tā, kā atskaitē („8501 – 9000 €”); noapaļo tikai pārrēķinu.
  const converted = code !== "EUR";
  const lo = converted ? roundEur(bounds.lo / rate) : Math.round(bounds.lo);
  const hi = converted ? roundEur(bounds.hi / rate) : Math.round(bounds.hi);
  const display = lo === hi ? `${groupEur(lo)} €` : `${groupEur(lo)} - ${groupEur(hi)} €`;
  return {
    display,
    fromCurrency: code,
    ratePerEur: rate,
    converted,
  };
}

/** Īss audita ieraksts operatoram: „510 000 - 520 000 CZK → 20 400 - 20 800 € (1 EUR = 25 CZK)”. */
export function describeEurConversion(rawAmount: string, conversion: EurConversion): string {
  if (!conversion.converted) return "";
  return `${rawAmount.replace(/\s+/g, " ").trim()} → ${conversion.display} (1 EUR = ${conversion.ratePerEur} ${conversion.fromCurrency})`;
}
