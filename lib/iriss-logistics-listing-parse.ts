/**
 * Bezmaksas sludinājuma / izsoles lapas atpazīšana.
 * Tikai HTML (JSON-LD, meta, lauki). Nav Apify un nav maksas ielādes.
 */

export type LogisticsParsedListing = {
  ok: boolean;
  host: string;
  url: string;
  make: string;
  model: string;
  vin: string;
  priceEur: number | null;
  mileageKm: number | null;
  address: string;
  title: string;
  source: string;
  parsedAt: string;
  note?: string;
};

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, attr: "property" | "name", key: string): string {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return decodeEntities((m?.[1] || m?.[2] || "").trim());
}

function extractJsonLdObjects(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* nederīgs JSON-LD */
    }
  }
  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function jsonLdType(v: unknown): string[] {
  if (!isObj(v)) return [];
  const t = v["@type"];
  if (typeof t === "string") return [t.toLowerCase()];
  if (Array.isArray(t)) return t.map((x) => String(x).toLowerCase());
  return [];
}

function flattenGraph(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const n of nodes) {
    if (isObj(n) && Array.isArray(n["@graph"])) {
      for (const g of n["@graph"]) if (isObj(g)) out.push(g);
    } else if (isObj(n)) out.push(n);
  }
  return out;
}

function addressFromJsonLd(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (!isObj(v)) return "";
  const parts = [str(v.streetAddress), [str(v.postalCode), str(v.addressLocality)].filter(Boolean).join(" "), str(v.addressCountry)].filter(
    Boolean,
  );
  return parts.join(", ");
}

function fromVehicleNode(node: Record<string, unknown>): Partial<LogisticsParsedListing> {
  const brand = isObj(node.brand) ? str(node.brand.name) || str(node.brand) : str(node.brand);
  const mileage =
    num(isObj(node.mileageFromOdometer) ? node.mileageFromOdometer.value : node.mileageFromOdometer) ??
    num(node.mileage);
  const offers = isObj(node.offers) ? node.offers : null;
  const price = offers ? num(offers.price) : num(node.price);
  return {
    make: brand || str(node.manufacturer),
    model: str(node.model) || str(node.name),
    vin: str(node.vehicleIdentificationNumber) || str(node.vin),
    priceEur: price,
    mileageKm: mileage,
    address: addressFromJsonLd(node.address) || (isObj(node.seller) ? addressFromJsonLd(node.seller.address) : ""),
    title: str(node.name),
  };
}

function parseVin(text: string): string {
  const m = text.match(VIN_RE);
  return m?.[1] ? m[1].toUpperCase() : "";
}

function parsePriceEur(text: string, html: string): number | null {
  const og = metaContent(html, "property", "product:price:amount") || metaContent(html, "property", "og:price:amount");
  const ogN = num(og);
  if (ogN != null && ogN > 50) return Math.round(ogN);
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+)(?:\s*)(?:€|eur)/i);
  if (!m?.[1]) return null;
  const n = Number.parseFloat(m[1].replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseKm(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\s*(?:km)\b/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1].replace(/[.\s]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAddressHint(text: string, html: string): string {
  const og = metaContent(html, "name", "geo.placename") || metaContent(html, "property", "og:street-address");
  if (og) return og;
  const m = text.match(
    /\b(\d{4,5}\s+[A-ZÄÖÜ][\wÄÖÜäöüß.\-]+(?:\s+\d+[a-z]?)?(?:,\s*(?:DE|NL|BE|FR|AT|PL|CZ|IT|ES|LV))?)/,
  );
  return m?.[1]?.trim() ?? "";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function logisticsListingParserKind(url: string): string {
  const host = hostOf(url);
  if (host.includes("mobile.de")) return "mobile.de";
  if (host.includes("autoscout24")) return "autoscout24";
  if (host.includes("autobid")) return "autobid";
  if (host.includes("auto1.com") || host.includes("autohero")) return "auto1";
  if (host.includes("openlane") || host.includes("adesa")) return "openlane";
  return host || "html";
}

export function parseLogisticsListingHtml(html: string, url: string, now = new Date()): LogisticsParsedListing {
  const host = hostOf(url);
  const source = logisticsListingParserKind(url);
  const empty: LogisticsParsedListing = {
    ok: false,
    host,
    url,
    make: "",
    model: "",
    vin: "",
    priceEur: null,
    mileageKm: null,
    address: "",
    title: "",
    source,
    parsedAt: now.toISOString(),
  };
  if (!html.trim()) {
    return { ...empty, note: "Lapa ir tukša - saglabāta tikai saite." };
  }

  const nodes = flattenGraph(extractJsonLdObjects(html));
  let fromLd: Partial<LogisticsParsedListing> = {};
  for (const node of nodes) {
    const types = jsonLdType(node);
    if (types.some((t) => /car|vehicle|product|automobile|motorizedbicycle/i.test(t))) {
      fromLd = fromVehicleNode(node);
      if (fromLd.make || fromLd.vin || fromLd.title) break;
    }
  }

  const text = stripTags(html);
  const title =
    fromLd.title ||
    metaContent(html, "property", "og:title") ||
    (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ? stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)![1]) : "");

  const vin = (fromLd.vin || parseVin(html) || parseVin(text)).toUpperCase();
  const makeModel = splitMakeModel(fromLd.make || "", fromLd.model || title);
  const priceEur = fromLd.priceEur ?? parsePriceEur(text, html);
  const mileageKm = fromLd.mileageKm ?? parseKm(text);
  const address = fromLd.address || parseAddressHint(text, html);

  const ok = Boolean(makeModel.make || makeModel.model || vin || priceEur || address);
  return {
    ...empty,
    ok,
    make: makeModel.make,
    model: makeModel.model,
    vin,
    priceEur,
    mileageKm,
    address,
    title,
    note: ok ? undefined : "Strukturēti dati lapā netika atrasti. Saite saglabāta.",
  };
}

const KNOWN_MAKES = [
  "Volkswagen",
  "VW",
  "Audi",
  "BMW",
  "Mercedes-Benz",
  "Mercedes",
  "Skoda",
  "Škoda",
  "Volvo",
  "Ford",
  "Opel",
  "Toyota",
  "Renault",
  "Peugeot",
  "Citroen",
  "Hyundai",
  "Kia",
  "Nissan",
  "Mazda",
  "Porsche",
  "Seat",
  "Cupra",
  "Mini",
  "Fiat",
  "Nussbaum",
  "Unsinn",
];

function splitMakeModel(make: string, modelOrTitle: string): { make: string; model: string } {
  if (make && modelOrTitle && !modelOrTitle.toLowerCase().startsWith(make.toLowerCase())) {
    return { make: make.trim(), model: modelOrTitle.trim() };
  }
  const title = (make && modelOrTitle.toLowerCase().startsWith(make.toLowerCase()) ? modelOrTitle : make || modelOrTitle).trim();
  for (const brand of KNOWN_MAKES) {
    const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(title)) {
      return { make: brand === "VW" ? "Volkswagen" : brand, model: title.replace(re, "").trim() };
    }
  }
  const parts = title.split(/\s+/);
  return { make: parts[0] ?? "", model: parts.slice(1).join(" ") };
}

export function isLogisticsListingUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
