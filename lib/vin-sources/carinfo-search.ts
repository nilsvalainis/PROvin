/**
 * car.info super-search JSON (bez tīkla). Meklēšana: GET /{locale}/search/super/{VIN}?time=
 */
export type CarinfoSearchHit = {
  href: string;
  country: string;
  vin: string;
  summary: string;
};

function identHrefFromHtml(html: string): string {
  const unescaped = html.replace(/\\\//g, "/").replace(/\\"/g, '"');
  const m = /https?:\/\/www\.car\.info\/[a-z0-9-]+\/vin\/[A-Z]{1,3}\/[A-HJ-NPR-Z0-9]{11,17}/i.exec(unescaped);
  if (m?.[0]) return m[0];
  const href = /href="([^"]*\/vin\/[^"]+)"/i.exec(unescaped);
  const raw = (href?.[1] ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://www.car.info${raw}`;
  return `https://www.car.info/${raw.replace(/^\/+/, "")}`;
}

export function parseCarinfoSearchBody(text: string, vin: string): CarinfoSearchHit | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return parseCarinfoSuperSearch(JSON.parse(trimmed) as unknown, vin);
  } catch {
    return null;
  }
}

export function parseCarinfoSuperSearch(raw: unknown, vin: string): CarinfoSearchHit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hits = o.hits && typeof o.hits === "object" ? (o.hits as Record<string, unknown>) : {};
  const idents = Array.isArray(hits.idents) ? hits.idents : [];
  const html = String(o.hits_html ?? "");
  const href = identHrefFromHtml(html);
  if (idents.length === 0 && !href) return null;
  const first = idents[0] && typeof idents[0] === "object" ? (idents[0] as Record<string, unknown>) : {};
  const country = String(first.country ?? first.license_code ?? "").trim().toUpperCase();
  const hitVin = String(first.vin ?? vin).replace(/[\s-]/g, "").toUpperCase();
  const summary = String(first.secondary_name_blurred ?? first.name ?? "").trim();
  let page = href;
  if (!page && country) {
    const loc = country === "S" || country === "SE" ? "en-se" : `en-${country.toLowerCase()}`;
    const disc = country === "SE" ? "S" : country;
    page = `https://www.car.info/${loc}/vin/${disc}/${encodeURIComponent(hitVin)}`;
  }
  if (!page) return null;
  return { href: page, country, vin: hitVin, summary };
}

export function carinfoSuperSearchUrl(locale: string, vin: string, timeMs: number): string {
  return `https://www.car.info/${locale}/search/super/${encodeURIComponent(vin)}?time=${timeMs}`;
}

export const CARINFO_SEARCH_LOCALES = ["en-se", "sv-se", "en-dk", "da-dk", "en-no", "nb-no", "en-fi"] as const;
