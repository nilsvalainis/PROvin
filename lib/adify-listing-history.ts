/**
 * adify.lv/history — publiskā sludinājuma cenu vēsture.
 * Kopš 2026. gada API `api.adify.lv/api/v1/history/...` atgriež HTTP 403.
 * Vēsture tiek lasīta no Next.js SSR lapas `/history?url=` (`__NEXT_DATA__`).
 */

export const ADIFY_HISTORY_PAGE_URL = "https://adify.lv/history";
export const ADIFY_HISTORY_API_BASE = "https://api.adify.lv/api/v1";

const ADIFY_HISTORY_PAGE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const ADIFY_SOURCE = {
  ss: 0,
  rentinriga: 1,
  city24: 2,
  cityreal: 3,
  cv: 4,
  inch: 5,
  pp: 6,
} as const;

export type AdifyListingKind = "car" | "flat" | "house" | "land" | "premise" | "unknown";

export type AdifyHistoryUrlRef = {
  source: number;
  kind: AdifyListingKind;
  id: string;
};

export type TirgusPriceHistoryRow = {
  date: string;
  price: number;
  mileage: number | null;
  year: number | null;
  /** Starpība pret vecāko nākamo ierakstu (0 = nav izmaiņas / pēdējā rinda). */
  delta: number;
};

export type AdifyListingHistorySnapshot = {
  found: boolean;
  message: string;
  rows: TirgusPriceHistoryRow[];
  durationDays: number;
  oldestDate: string;
  newestDate: string;
  priceChangeEur: number;
  listingUrl: string | null;
};

const MAX_HISTORY_ROWS = 80;

export function formatAdifyGroupedNumber(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped}`;
}

/** Adify kājenes formāts: `€ -3 790` / `€ +500` / `€ 0`. */
export function formatAdifySignedEur(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "€ 0";
  const sign = rounded > 0 ? "+" : "";
  return `€ ${sign}${formatAdifyGroupedNumber(rounded)}`;
}

export function formatAdifyPriceLabel(price: number): string {
  return `€ ${formatAdifyGroupedNumber(price)}`;
}

export function formatAdifyDeltaLabel(delta: number): string | null {
  if (!delta) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatAdifyGroupedNumber(delta)}€`;
}

export function formatAdifyMileageLabel(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  return `${formatAdifyGroupedNumber(km)} km`;
}

export function formatAdifyYearLabel(year: number | null): string {
  if (year == null || !Number.isFinite(year) || year <= 0) return "—";
  return `${Math.round(year)} g.`;
}

function parseAdifyDay(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const lv = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) {
    const d = Number(lv[1]);
    const mo = Number(lv[2]) - 1;
    const y = Number(lv[3]);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

export function formatAdifyLvDate(raw: string): string {
  const dt = parseAdifyDay(raw);
  if (!dt) return raw.trim();
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

/** 1 diena, 11 dienas, 21 diena. */
export function formatAdifyDurationLabel(days: number): string {
  const n = Math.round(days);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "diena" : "dienas";
  return `${n} ${word}`;
}

/** Vecākais ieraksts vispirms — cenu soļi no pirmās dienas. */
export function adifyChronologicalPriceRows(rows: TirgusPriceHistoryRow[]): TirgusPriceHistoryRow[] {
  return [...rows].reverse();
}

/** Kalendārās dienas (kā adify `differenceInDays` + vismaz 1, ja ir vēsture). */
export function adifyDurationDays(oldestRaw: string, now: Date = new Date()): number {
  const from = parseAdifyDay(oldestRaw);
  if (!from) return 1;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b - a) / 86400000);
  return days > 0 ? days : 1;
}

export function parseAdifyHistoryUrl(listingUrlRaw: string): AdifyHistoryUrlRef | null {
  let u: URL;
  try {
    u = new URL(listingUrlRaw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  const pathname = (u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname) || "/";
  const last = pathname.split("/").pop() ?? "";
  const id = last.split(".")[0]?.split("!").at(-1)?.trim() ?? "";
  if (!id || id.length < 3) return null;

  let source: number = ADIFY_SOURCE.ss;
  if (host.includes("ss.lv") || host.includes("ss.com")) source = ADIFY_SOURCE.ss;
  else if (host.includes("rentinriga.lv")) source = ADIFY_SOURCE.rentinriga;
  else if (host.includes("city24.lv")) source = ADIFY_SOURCE.city24;
  else if (host.includes("cityreal.lv")) source = ADIFY_SOURCE.cityreal;
  else if (host.includes("cv.lv")) source = ADIFY_SOURCE.cv;
  else if (host.includes("inch.lv")) source = ADIFY_SOURCE.inch;
  else if (host.includes("pp.lv")) source = ADIFY_SOURCE.pp;
  else return null;

  const p = pathname.toLowerCase();
  let kind: AdifyListingKind = "unknown";
  if (p.includes("/flats/") || p.includes("/apartment")) kind = "flat";
  else if (p.includes("/homes") || p.includes("/farms") || p.includes("/house")) kind = "house";
  else if (p.includes("/transport") || p.includes("/cars") || p.includes("/car")) kind = "car";
  else if (p.includes("/plots")) kind = "land";
  else if (p.includes("/premises") || p.includes("/commercial") || p.includes("/offices")) kind = "premise";

  return { source, kind, id };
}

export function adifyHistoryApiUrl(ref: AdifyHistoryUrlRef): string {
  return `${ADIFY_HISTORY_API_BASE}/history/${ref.source}/${ref.kind}/${encodeURIComponent(ref.id)}`;
}

export function adifyHistoryPageLookupUrl(listingUrl: string): string {
  return `${ADIFY_HISTORY_PAGE_URL}?url=${encodeURIComponent(listingUrl.trim())}`;
}

type AdifySsrPageProps = {
  items?: unknown;
  retryAfter?: unknown;
};

/** Next.js `__NEXT_DATA__` no adify.lv/history?url= — tīra funkcija testiem. */
export function extractAdifyHistorySsrPayload(html: string): {
  items: unknown;
  retryAfter: number | null;
} {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return { items: null, retryAfter: null };
  try {
    const data = JSON.parse(m[1]) as { props?: { pageProps?: AdifySsrPageProps } };
    const page = data.props?.pageProps ?? {};
    const retryRaw = page.retryAfter;
    const retryAfter =
      typeof retryRaw === "number" && Number.isFinite(retryRaw) && retryRaw > 0 ? Math.ceil(retryRaw) : null;
    return { items: page.items ?? null, retryAfter };
  } catch {
    return { items: null, retryAfter: null };
  }
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type RawAdifyItem = {
  price?: unknown;
  mileage?: unknown;
  year?: unknown;
  created?: unknown;
  pubDate?: unknown;
  url?: unknown;
};

function isRawItem(v: unknown): v is RawAdifyItem {
  return Boolean(v) && typeof v === "object";
}

function extractAdifySeries(json: unknown): RawAdifyItem[] {
  if (!Array.isArray(json) || json.length === 0) return [];
  const first = json[0];
  if (Array.isArray(first)) return first.filter(isRawItem);
  if (isRawItem(first) && "price" in first) return json.filter(isRawItem);
  return [];
}

export function normalizeAdifyHistoryItems(
  json: unknown,
  now: Date = new Date(),
): AdifyListingHistorySnapshot {
  const rawItems = extractAdifySeries(json);
  const dated = rawItems
    .map((item) => {
      const price = numOrNull(item.price);
      const createdRaw =
        (typeof item.pubDate === "string" && item.pubDate.trim()) ||
        (typeof item.created === "string" && item.created.trim()) ||
        "";
      const day = parseAdifyDay(createdRaw);
      if (price == null || !day) return null;
      return {
        price,
        mileage: numOrNull(item.mileage),
        year: numOrNull(item.year),
        createdRaw,
        day,
        url: typeof item.url === "string" ? item.url : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.day.getTime() - a.day.getTime())
    .slice(0, MAX_HISTORY_ROWS);

  if (dated.length === 0) {
    return {
      found: false,
      message: "Meklētais objekts netika atrasts",
      rows: [],
      durationDays: 0,
      oldestDate: "",
      newestDate: "",
      priceChangeEur: 0,
      listingUrl: null,
    };
  }

  const rows: TirgusPriceHistoryRow[] = dated.map((item, i) => {
    const older = dated[i + 1];
    const delta = older ? item.price - older.price : 0;
    return {
      date: formatAdifyLvDate(item.createdRaw),
      price: item.price,
      mileage: item.mileage,
      year: item.year,
      delta,
    };
  });

  const newest = dated[0]!;
  const oldest = dated[dated.length - 1]!;
  const priceChangeEur = newest.price - oldest.price;
  const durationDays = adifyDurationDays(oldest.createdRaw, now);

  return {
    found: true,
    message: `Atrasta sludinājuma vēsture (${rows.length} ieraksti)`,
    rows,
    durationDays,
    oldestDate: formatAdifyLvDate(oldest.createdRaw),
    newestDate: formatAdifyLvDate(newest.createdRaw),
    priceChangeEur,
    listingUrl: newest.url,
  };
}

export function applyAdifyHistoryToTirgus<
  T extends {
    listedForSale: string;
    listingCreated: string;
    priceDrop: string;
    priceHistory?: TirgusPriceHistoryRow[];
  },
>(prev: T, snapshot: AdifyListingHistorySnapshot): T {
  if (!snapshot.found) return prev;
  return {
    ...prev,
    listedForSale: String(snapshot.durationDays),
    listingCreated: snapshot.oldestDate,
    priceDrop: formatAdifySignedEur(snapshot.priceChangeEur),
    priceHistory: snapshot.rows,
  };
}

export async function fetchAdifyListingHistory(
  listingUrl: string,
  now: Date = new Date(),
): Promise<AdifyListingHistorySnapshot> {
  const ref = parseAdifyHistoryUrl(listingUrl);
  if (!ref) {
    return {
      found: false,
      message: "Neatpazīta sludinājuma saite (ss.lv / ss.com)",
      rows: [],
      durationDays: 0,
      oldestDate: "",
      newestDate: "",
      priceChangeEur: 0,
      listingUrl: null,
    };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 18_000);
  try {
    const res = await fetch(adifyHistoryPageLookupUrl(listingUrl), {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "lv-LV,lv;q=0.9,en;q=0.8",
        "User-Agent": ADIFY_HISTORY_PAGE_UA,
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        ...normalizeAdifyHistoryItems([], now),
        message: `Adify neatbildēja (HTTP ${res.status})`,
      };
    }
    const html = await res.text();
    const { items, retryAfter } = extractAdifyHistorySsrPayload(html);
    if (retryAfter != null) {
      return {
        ...normalizeAdifyHistoryItems([], now),
        message: `Adify ierobežo pieprasījumus (mēģini pēc ${retryAfter} s)`,
      };
    }
    if (items == null) {
      return {
        ...normalizeAdifyHistoryItems([], now),
        message: "Adify lapas formāts mainījies",
      };
    }
    return normalizeAdifyHistoryItems(items, now);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ...normalizeAdifyHistoryItems([], now),
      message: aborted ? "Adify pieprasījums noildza" : "Neizdevās ielādēt Adify vēsturi",
    };
  } finally {
    clearTimeout(t);
  }
}
