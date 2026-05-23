/**
 * Publiska sludinājuma lapa (ss.lv) — servera pusē nolasīti kopsavilkuma dati PDF atskaitei.
 */

export type ListingPriceRow = {
  /** Datums (kā parādās sludinājumā). */
  date: string;
  /** Nobraukums no sludinājuma, ja atrasts pie šī ieraksta. */
  km: string | null;
  /** Cena EUR teksta formā. */
  priceEur: string;
};

export type ListingMarketSnapshot = {
  ok: boolean;
  host: string;
  fetchedAt: string;
  /** Dienas kopš „Izvietots” datuma (pēc servera laika). */
  daysListed: number | null;
  postedDateRaw: string | null;
  currentKm: string | null;
  currentPriceEur: string | null;
  priceChanges: ListingPriceRow[];
  note?: string;
};

/** Pilns ss.lv sludinājuma saturs Gemini / AI analīzei. */
export type ListingAiSnapshot = ListingMarketSnapshot & {
  url: string;
  pageTitle: string | null;
  description: string | null;
  options: { label: string; value: string }[];
  photoCount: number | null;
};

const ALLOWED_HOSTS = new Set(["ss.lv", "www.ss.lv", "m.ss.lv"]);

export function isAllowedListingScrapeHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|div|p|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLvDmy(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Eralda `ads_opt_name` / `ads_opt` pārus tipiskajā ss.lv sludinājuma tabulā. */
function extractSsLvOptions(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /class="ads_opt_name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?class="ads_opt"[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = stripTags(m[1]).replace(/:\s*$/, "").trim();
    let val = m[2].replace(/<b>/gi, "").replace(/<\/b>/gi, "");
    val = stripTags(val);
    if (key.length > 0 && val.length > 0) map.set(key, val);
  }
  return map;
}

function extractSsLvPageTitle(html: string): string | null {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  const title = stripTags(m[1]).replace(/\s*-\s*Sludinājumi\s*$/i, "").trim();
  return title || null;
}

/** Sludinājuma brīvā teksta apraksts (pirms parametru tabulas). */
function extractSsLvDescription(html: string): string | null {
  const m = html.match(/id="msg_div_msg"[^>]*>([\s\S]*?)<table[\s\S]*?class="options_list"/i);
  if (!m?.[1]) return null;
  const inner = m[1].replace(/<div[^>]*id="content_sys_div_msg"[^>]*>[\s\S]*?<\/div>/gi, "");
  const text = stripTags(inner);
  return text.length >= 12 ? text : null;
}

function extractSsLvPhotoCount(html: string): number | null {
  const m = html.match(/var\s+msg_img\s*=\s*(\[[\s\S]*?\]);/i);
  if (!m?.[1]) return null;
  try {
    const arr = JSON.parse(m[1].replace(/'/g, '"')) as string[];
    const n = arr.filter((x) => typeof x === "string" && x.trim().length > 0).length;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

function extractSsLvAdsPrice(html: string): string | null {
  const m = html.match(/class="ads_price"[^>]*>([^<]+)/i);
  if (!m?.[1]?.trim()) return null;
  const price = m[1].trim().replace(/\s+/g, " ");
  return /€/.test(price) || /\d/.test(price) ? price : null;
}

function listingOptionsFromMap(opts: Map<string, string>): { label: string; value: string }[] {
  return [...opts.entries()].map(([label, value]) => ({ label, value }));
}

function resolveListingKm(opts: Map<string, string>): string | null {
  const kmRaw =
    opts.get("Nobraukums, km") ??
    opts.get("Nobraukums") ??
    opts.get("Nobraukums, tūkst. km") ??
    opts.get("Odometrs") ??
    null;
  if (!kmRaw) return null;
  return kmRaw
    .replace(/\s+/g, " ")
    .replace(/,\s*km$/i, " km")
    .replace(/(\d)\s+km$/i, "$1 km");
}

function resolveListingPrice(opts: Map<string, string>, html: string): string | null {
  let currentPriceEur =
    opts.get("Cena") ??
    opts.get("Cena, €") ??
    opts.get("Cena, eur") ??
    extractSsLvAdsPrice(html) ??
    extractPriceFromScript(html);

  if (currentPriceEur) {
    currentPriceEur = currentPriceEur.replace(/\s+/g, " ").replace(/eur/gi, "€");
    if (!/€/.test(currentPriceEur) && /\d/.test(currentPriceEur)) currentPriceEur = `${currentPriceEur} €`;
  }
  return currentPriceEur ?? null;
}

function failedListingSnapshot(
  partial: Pick<ListingMarketSnapshot, "host" | "note"> & { url?: string },
): ListingAiSnapshot {
  return {
    ok: false,
    url: partial.url ?? "",
    host: partial.host,
    fetchedAt: new Date().toISOString(),
    daysListed: null,
    postedDateRaw: null,
    currentKm: null,
    currentPriceEur: null,
    priceChanges: [],
    pageTitle: null,
    description: null,
    options: [],
    photoCount: null,
    note: partial.note,
  };
}

function extractPriceFromScript(html: string): string | null {
  const m = html.match(/MSG_PRICE_STR\s*=\s*'([^']*)'/i);
  if (m?.[1]?.trim()) return m[1].trim().replace(/\s+/g, " ");
  const m2 = html.match(/MSG_PRICE\s*=\s*([\d.]+)/i);
  if (m2?.[1]) {
    const n = parseFloat(m2[1]);
    if (!Number.isNaN(n) && n > 100) return `${Math.round(n).toLocaleString("lv-LV")} €`;
  }
  return null;
}

/** Meklē „Izvietots” / līdzīgus datumus kājā vai tekstā. */
function extractPostedDate(html: string, text: string): string | null {
  const patterns = [
    /Izvietots[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /Publicēts[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /Sludinājums\s+izvietots[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p) || html.match(p);
    if (m?.[1]) return m[1];
  }
  const foot = html.match(/class="msg_footer"[\s\S]{0,1800}?(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (foot?.[1]) return foot[1];
  return null;
}

/**
 * Mēģina atrast cenu vēstures rindas: datums + EUR (un brīvi km tajā pašā logā).
 */
function extractPriceHistoryLoose(html: string, text: string, fallbackKm: string | null): ListingPriceRow[] {
  const rows: ListingPriceRow[] = [];
  const seen = new Set<string>();

  const block =
    text.match(/Cenu\s+izmaiņas[\s\S]{0,3500}?((?:\d{1,2}\.\d{1,2}\.\d{4}[\s\S]{0,180}?€\s*)+)/i)?.[1] ??
    text.match(/cenas\s+vēsture[\s\S]{0,3500}?((?:\d{1,2}\.\d{1,2}\.\d{4}[\s\S]{0,180}?€\s*)+)/i)?.[1];

  const hay = block ?? text;
  const re = /(\d{1,2}\.\d{1,2}\.\d{4})[\s\S]{0,160}?(\d{1,3}(?:\s\d{3})*)\s*€/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay)) !== null) {
    const date = m[1];
    const priceRaw = m[2].replace(/\s+/g, " ");
    const priceEur = `${priceRaw} €`;
    const kmM = m[0].match(/(\d{1,3}(?:\s\d{3})+)\s*km/i);
    const km = kmM ? `${kmM[1].replace(/\s+/g, " ")} km` : fallbackKm;
    const k = `${date}|${priceEur}`;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ date, km, priceEur });
  }

  if (rows.length === 0) {
    const trRe =
      /<tr[^>]*>[\s\S]*?<td[^>]*>(\d{1,2}\.\d{1,2}\.\d{4})<\/td>[\s\S]*?<td[^>]*>([\s\S]*?\d[\d\s]*\s*€[\s\S]*?)<\/td>/gi;
    while ((m = trRe.exec(html)) !== null) {
      const date = m[1];
      const cell = stripTags(m[2]);
      const pm = cell.match(/(\d{1,3}(?:\s\d{3})*)\s*€/);
      if (!pm) continue;
      const priceEur = `${pm[1].replace(/\s+/g, " ")} €`;
      const kmM = cell.match(/(\d{1,3}(?:\s\d{3})+)\s*km/i);
      const k = `${date}|${priceEur}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ date, km: kmM ? `${kmM[1].replace(/\s+/g, " ")} km` : fallbackKm, priceEur });
    }
  }

  rows.sort((a, b) => {
    const da = parseLvDmy(a.date)?.getTime() ?? 0;
    const db = parseLvDmy(b.date)?.getTime() ?? 0;
    return da - db;
  });
  return rows;
}

export function parseSsLvListingHtml(html: string, now: Date = new Date()): ListingMarketSnapshot {
  const text = stripTags(html);
  const opts = extractSsLvOptions(html);
  const currentKm = resolveListingKm(opts);
  const currentPriceEur = resolveListingPrice(opts, html);
  const posted = extractPostedDate(html, text);
  const postedDt = posted ? parseLvDmy(posted) : null;
  const daysListed = postedDt ? daysBetween(postedDt, now) : null;
  const priceChanges = extractPriceHistoryLoose(html, text, currentKm);

  return {
    ok: true,
    host: "ss.lv",
    fetchedAt: now.toISOString(),
    daysListed,
    postedDateRaw: posted,
    currentKm,
    currentPriceEur,
    priceChanges,
    note:
      priceChanges.length === 0
        ? "Cenu izmaiņu tabula šajā lapā nav atpazīta — iespējams, vēsture nav publicēta vai ir cits sludinājuma veids."
        : undefined,
  };
}

export function parseSsLvListingAiHtml(html: string, url: string, now: Date = new Date()): ListingAiSnapshot {
  const market = parseSsLvListingHtml(html, now);
  const opts = extractSsLvOptions(html);
  return {
    ...market,
    url,
    pageTitle: extractSsLvPageTitle(html),
    description: extractSsLvDescription(html),
    options: listingOptionsFromMap(opts),
    photoCount: extractSsLvPhotoCount(html),
  };
}

/** Teksts Gemini promptam no servera nolasīta ss.lv sludinājuma. */
export function formatListingAiSnapshotForGemini(snapshot: ListingAiSnapshot): string {
  if (!snapshot.ok) {
    return [
      "### Sludinājums (ss.lv — neizdevās nolasīt)",
      snapshot.url ? `Saite: ${snapshot.url}` : "",
      snapshot.note ? `Kļūda: ${snapshot.note}` : "Sludinājuma saturs nav pieejams.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines: string[] = ["### Sludinājums (ss.lv — nolasīts serverī)"];
  if (snapshot.url) lines.push(`Saite: ${snapshot.url}`);
  if (snapshot.pageTitle) lines.push(`Virsraksts: ${snapshot.pageTitle}`);
  if (snapshot.currentPriceEur) lines.push(`Cena: ${snapshot.currentPriceEur}`);
  if (snapshot.currentKm) lines.push(`Nobraukums: ${snapshot.currentKm}`);
  if (snapshot.postedDateRaw) {
    const days =
      snapshot.daysListed != null ? ` (${snapshot.daysListed} d. platformā)` : "";
    lines.push(`Izvietots: ${snapshot.postedDateRaw}${days}`);
  }
  if (snapshot.photoCount != null) lines.push(`Foto skaits: ${snapshot.photoCount}`);

  if (snapshot.options.length > 0) {
    lines.push("", "Parametri:");
    for (const { label, value } of snapshot.options) {
      lines.push(`- ${label}: ${value}`);
    }
  }

  if (snapshot.description) {
    lines.push("", "Apraksts:", snapshot.description);
  }

  if (snapshot.priceChanges.length > 0) {
    lines.push("", "Cenu vēsture:");
    for (const row of snapshot.priceChanges) {
      const km = row.km ? `, ${row.km}` : "";
      lines.push(`- ${row.date}: ${row.priceEur}${km}`);
    }
  }

  if (snapshot.note) lines.push("", `Piezīme: ${snapshot.note}`);
  return lines.join("\n");
}

async function fetchSsLvListingHtml(listingUrl: string): Promise<
  | { ok: true; html: string; url: string; host: string }
  | { ok: false; snapshot: ListingAiSnapshot }
> {
  let u: URL;
  try {
    u = new URL(listingUrl.trim());
  } catch {
    return {
      ok: false,
      snapshot: failedListingSnapshot({ host: "", url: listingUrl.trim(), note: "Nederīga saite." }),
    };
  }

  const url = u.toString();

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return {
      ok: false,
      snapshot: failedListingSnapshot({ host: u.hostname, url, note: "Atļauts tikai HTTP(S)." }),
    };
  }

  if (!isAllowedListingScrapeHost(u.hostname)) {
    return {
      ok: false,
      snapshot: failedListingSnapshot({
        host: u.hostname,
        url,
        note: `Automātiska izguve šobrīd tikai ss.lv (saņemts: ${u.hostname}).`,
      }),
    };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 14_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PROVIN.lv/1.0; +https://provin.lv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "lv,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        snapshot: failedListingSnapshot({ host: "ss.lv", url, note: `HTTP ${res.status}` }),
      };
    }
    const html = await res.text();
    if (html.length > 2_500_000) {
      return {
        ok: false,
        snapshot: failedListingSnapshot({ host: "ss.lv", url, note: "Lapa pārāk liela." }),
      };
    }
    return { ok: true, html, url, host: "ss.lv" };
  } catch {
    return {
      ok: false,
      snapshot: failedListingSnapshot({
        host: "ss.lv",
        url,
        note: "Neizdevās ielādēt sludinājumu (tīkls vai timeout).",
      }),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchListingAiSnapshot(listingUrl: string): Promise<ListingAiSnapshot> {
  const fetched = await fetchSsLvListingHtml(listingUrl);
  if (!fetched.ok) return fetched.snapshot;
  return parseSsLvListingAiHtml(fetched.html, fetched.url);
}

function toMarketSnapshot(snapshot: ListingAiSnapshot): ListingMarketSnapshot {
  const {
    ok,
    host,
    fetchedAt,
    daysListed,
    postedDateRaw,
    currentKm,
    currentPriceEur,
    priceChanges,
    note,
  } = snapshot;
  return {
    ok,
    host,
    fetchedAt,
    daysListed,
    postedDateRaw,
    currentKm,
    currentPriceEur,
    priceChanges,
    note,
  };
}

export async function fetchListingMarketSnapshot(listingUrl: string): Promise<ListingMarketSnapshot> {
  const fetched = await fetchSsLvListingHtml(listingUrl);
  if (!fetched.ok) return toMarketSnapshot(fetched.snapshot);
  return parseSsLvListingHtml(fetched.html);
}
