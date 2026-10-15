/**
 * Valūtas → EUR pēc šodienas ECB dienas kursa (kešots uz kalendāro dienu).
 * Kursu neizdomā: ja ECB tabulas nav, paliek sākotnējā valūta ar atzīmi.
 */

export const ECB_DAILY_RATES_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export const ECB_RATE_MISSING_MARKER = "ECB kurss nav pieejams";

export type EcbDailyRates = {
  /** ECB Cube `time` (YYYY-MM-DD). */
  date: string;
  /** Cik valūtas vienību par 1 EUR. */
  rates: Record<string, number>;
  /** Kalendārā diena, kad tabula ielādēta (Europe/Riga). */
  fetchedOn: string;
};

/** @deprecated Tikai atpakaļsaderībai; konversija vairs nelieto fiksētus kursus. */
export const EUR_REFERENCE_RATES: Record<string, number> = { EUR: 1 };

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
  { code: "AUD", re: /\bAUD\b/i },
  { code: "CNY", re: /(?:\bCNY\b|¥|RMB)/i },
  { code: "INR", re: /\bINR\b/i },
  { code: "KRW", re: /\bKRW\b/i },
  { code: "BRL", re: /\bBRL\b/i },
  { code: "MXN", re: /\bMXN\b/i },
  { code: "SGD", re: /\bSGD\b/i },
  { code: "HKD", re: /\bHKD\b/i },
  { code: "NZD", re: /\bNZD\b/i },
  { code: "ZAR", re: /\bZAR\b/i },
  { code: "ISK", re: /\bISK\b/i },
  { code: "ILS", re: /\bILS\b/i },
  { code: "THB", re: /\bTHB\b/i },
  { code: "IDR", re: /\bIDR\b/i },
  { code: "MYR", re: /\bMYR\b/i },
  { code: "PHP", re: /\bPHP\b/i },
];

let cachedRates: EcbDailyRates | null = null;
let inflight: Promise<EcbDailyRates | null> | null = null;

function todayRigaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function formatEcbDateLv(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function parseEcbEurofxXml(xml: string): EcbDailyRates | null {
  const date = xml.match(/\btime="(\d{4}-\d{2}-\d{2})"/)?.[1];
  if (!date) return null;
  const rates: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/currency="([A-Z]{3})"\s+rate="([0-9.]+)"/g)) {
    const n = Number.parseFloat(m[2]!);
    if (Number.isFinite(n) && n > 0) rates[m[1]!] = n;
  }
  if (Object.keys(rates).length < 2) return null;
  return { date, rates, fetchedOn: todayRigaDate() };
}

export function getCachedEcbDailyRates(): EcbDailyRates | null {
  return cachedRates;
}

/** Testiem: iestata ECB tabulu. `null` notīra kešu. */
export function setEcbDailyRatesForTests(table: Omit<EcbDailyRates, "fetchedOn"> | EcbDailyRates | null): void {
  cachedRates = table
    ? {
        date: table.date,
        rates: { EUR: 1, ...table.rates },
        fetchedOn: "fetchedOn" in table && table.fetchedOn ? table.fetchedOn : todayRigaDate(),
      }
    : null;
}

export async function loadEcbDailyRates(fetcher: typeof fetch = fetch): Promise<EcbDailyRates | null> {
  const today = todayRigaDate();
  if (cachedRates && cachedRates.fetchedOn === today) return cachedRates;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetcher(ECB_DAILY_RATES_URL, { cache: "no-store" });
      if (!res.ok) return cachedRates;
      const xml = await res.text();
      const parsed = parseEcbEurofxXml(xml);
      if (parsed) cachedRates = parsed;
      return cachedRates;
    } catch {
      return cachedRates;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

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
  /** Attēlojums admin/PDF laukam, piem. „20 400 - 20 800 €”. */
  display: string;
  /** Sākotnējā valūta („EUR”, ja jau eiro vai bez apzīmējuma). */
  fromCurrency: string;
  /** Cik valūtas vienību par 1 EUR (1, ja EUR; 0, ja kursa nav). */
  ratePerEur: number;
  /** ECB kursa datums (YYYY-MM-DD), ja konvertēts. */
  rateDate?: string;
  /** Sākotnējais noformējums pirms pārrēķina. */
  originalDisplay?: string;
  /** `true`, ja summa tika pārrēķināta no citas valūtas. */
  converted: boolean;
  /** `true`, ja valūta atpazīta, bet ECB kursa nav. */
  rateMissing?: boolean;
};

function formatOriginalAmount(bounds: { lo: number; hi: number }, code: string): string {
  const lo = groupEur(Math.round(bounds.lo));
  const hi = groupEur(Math.round(bounds.hi));
  const amount = lo === hi ? lo : `${lo} - ${hi}`;
  return `${amount} ${code}`;
}

/**
 * Summas teksts (jebkurā valūtā) → EUR, ja ir šodienas ECB kurss.
 * Nezināmu valūtu vai teksta bez cipariem neizdomā — atgriež `null`.
 */
export function convertAmountTextToEur(raw: string): EurConversion | null {
  const text = raw.trim();
  if (!text || !/\d/.test(text)) return null;
  const bounds = parseAmountBounds(text);
  if (!bounds) return null;

  const detected = detectCurrencyCode(text);
  const code = detected || "EUR";
  if (code === "EUR") {
    const lo = Math.round(bounds.lo);
    const hi = Math.round(bounds.hi);
    const display = lo === hi ? `${groupEur(lo)} €` : `${groupEur(lo)} - ${groupEur(hi)} €`;
    return { display, fromCurrency: "EUR", ratePerEur: 1, converted: false };
  }

  const rate = cachedRates?.rates[code];
  const originalDisplay = formatOriginalAmount(bounds, code);
  if (!(rate && rate > 0)) {
    return {
      display: `${originalDisplay} (${ECB_RATE_MISSING_MARKER})`,
      fromCurrency: code,
      ratePerEur: 0,
      originalDisplay,
      converted: false,
      rateMissing: true,
    };
  }

  const lo = roundEur(bounds.lo / rate);
  const hi = roundEur(bounds.hi / rate);
  const display = lo === hi ? `${groupEur(lo)} €` : `${groupEur(lo)} - ${groupEur(hi)} €`;
  return {
    display,
    fromCurrency: code,
    ratePerEur: rate,
    rateDate: cachedRates?.date,
    originalDisplay,
    converted: true,
  };
}

/** Īss audita ieraksts: „38 745 USD → 35 550 € (ECB 15.10.2026, 1 EUR = 1.09 USD)”. */
export function describeEurConversion(rawAmount: string, conversion: EurConversion): string {
  const raw = rawAmount.replace(/\s+/g, " ").trim();
  if (conversion.rateMissing) return `${raw} (${ECB_RATE_MISSING_MARKER})`;
  if (!conversion.converted) return "";
  const datePart = conversion.rateDate ? `ECB ${formatEcbDateLv(conversion.rateDate)}, ` : "";
  return `${raw} → ${conversion.display} (${datePart}1 EUR = ${conversion.ratePerEur} ${conversion.fromCurrency})`;
}
