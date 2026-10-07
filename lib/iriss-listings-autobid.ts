/**
 * Autobid.de meklēšanas lapa ir Nuxt SSR: viss saraksts ir `<script id="__NUXT_DATA__">` devalue masīvā.
 * Lapošana: `currentPage=N` (1-based). Aprīkojuma lauki ir ar stabiliem ID neatkarīgi no valodas (/en, /lv, /de).
 * Pārbaudīts 2026-10: HTTP 200 bez login, bez captcha.
 */

export type AutobidVehicle = {
  externalId: string;
  auctionId: string;
  title: string;
  manufacturer: string;
  slug: string;
  detailUrl: string;
  auctionStage: string;
  auctionStartAt: string;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  vatNote: string;
  imageUrl: string;
  firstRegistration: string;
  year: string;
  mileageKm: number | null;
  fuel: string;
  transmission: string;
  powerKw: string;
  location: string;
  countryCode: string;
};

export type AutobidSearchPage = {
  vehicles: AutobidVehicle[];
  pageCount: number;
  pageNumber: number;
};

/** Autobid aprīkojuma ID (vienādi visās valodās). */
const EQ_FIRST_REGISTRATION = "eq21";
const EQ_MILEAGE = "eq68";
const EQ_FUEL = "eq17";
const EQ_TRANSMISSION = "eq70";
const EQ_LOCATION = "eq168";
const EQ_POWER_KW = "eq19";

const WRAPPERS = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "NuxtError"]);

export function extractNuxtDataJson(html: string): string | null {
  const m = html.match(/<script[^>]*\bid=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  const body = m?.[1]?.trim() ?? "";
  return body ? body : null;
}

/** devalue formāts (Nuxt 3): plakans masīvs, atsauces ir indeksi; negatīvie skaitļi ir speciālās vērtības. */
export function hydrateNuxtData(flat: unknown[]): unknown {
  const cache = new Map<number, unknown>();
  const hydrate = (ref: unknown): unknown => {
    if (typeof ref !== "number") return ref;
    if (ref === -1) return undefined;
    if (ref === -2) return undefined;
    if (ref === -3) return Number.NaN;
    if (ref === -4) return Number.POSITIVE_INFINITY;
    if (ref === -5) return Number.NEGATIVE_INFINITY;
    if (ref === -6) return -0;
    if (ref < 0 || ref >= flat.length) return undefined;
    if (cache.has(ref)) return cache.get(ref);
    const value = flat[ref];
    if (Array.isArray(value)) {
      if (value.length >= 1 && typeof value[0] === "string") {
        const tag = value[0];
        if (WRAPPERS.has(tag)) {
          const inner = value[1];
          if (tag.startsWith("Empty") && typeof inner === "string") {
            let parsed: unknown = undefined;
            try {
              parsed = JSON.parse(inner);
            } catch {
              parsed = inner;
            }
            cache.set(ref, parsed);
            return parsed;
          }
          const out = hydrate(inner);
          cache.set(ref, out);
          return out;
        }
        if (tag === "Date" && typeof value[1] === "string") {
          cache.set(ref, value[1]);
          return value[1];
        }
        if (tag === "Set") {
          const out: unknown[] = [];
          cache.set(ref, out);
          for (const x of value.slice(1)) out.push(hydrate(x));
          return out;
        }
        if (tag === "Map") {
          const out: Record<string, unknown> = {};
          cache.set(ref, out);
          const rest = value.slice(1);
          for (let i = 0; i + 1 < rest.length; i += 2) out[String(hydrate(rest[i]))] = hydrate(rest[i + 1]);
          return out;
        }
        if (tag === "BigInt" && typeof value[1] === "string") {
          cache.set(ref, value[1]);
          return value[1];
        }
      }
      const out: unknown[] = [];
      cache.set(ref, out);
      for (const x of value) out.push(hydrate(x));
      return out;
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      cache.set(ref, out);
      for (const [k, x] of Object.entries(value as Record<string, unknown>)) out[k] = hydrate(x);
      return out;
    }
    cache.set(ref, value);
    return value;
  };
  return hydrate(0);
}

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function looksLikeVehicle(v: unknown): v is Rec {
  return isRec(v) && "auctionId" in v && "price" in v && "name" in v && "id" in v;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Cena 0 Autobid nozīmē „nav” (piem. `current` pirms izsoles). */
function price(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? Math.round(n) : null;
}

function equipmentValue(equipments: unknown, key: string): string {
  if (!isRec(equipments)) return "";
  const e = equipments[key];
  if (!isRec(e)) return "";
  return str(e.value) || str(e.rawValue);
}

function pickImage(imageGroups: unknown): string {
  if (!isRec(imageGroups)) return "";
  for (const group of Object.values(imageGroups)) {
    if (!Array.isArray(group)) continue;
    for (const img of group) {
      if (!isRec(img) || !isRec(img.links)) continue;
      const links = img.links as Rec;
      const url = str(links.m) || str(links.l) || str(links.s) || str(links.hd) || str(links.xs);
      if (url) return url;
    }
  }
  return "";
}

function yearFromRegistration(reg: string): string {
  const m = reg.match(/((?:19|20)\d{2})/);
  return m?.[1] ?? "";
}

export function autobidDetailUrl(slug: string, externalId: string): string {
  const s = slug.trim();
  if (s) return `https://autobid.de/en/item/${encodeURIComponent(s)}`;
  return externalId ? `https://autobid.de/en/item/${encodeURIComponent(externalId)}` : "";
}

export function mapAutobidVehicle(raw: Rec): AutobidVehicle | null {
  const externalId = str(raw.id);
  const title = str(raw.name);
  if (!externalId || !title) return null;
  const p = isRec(raw.price) ? raw.price : {};
  const manufacturer = isRec(raw.manufacturer) ? str(raw.manufacturer.name) : "";
  const slug = str(raw.slug);
  const firstRegistration = equipmentValue(raw.equipments, EQ_FIRST_REGISTRATION);
  const add = isRec(raw.additionalInformation) ? raw.additionalInformation : {};
  const country = isRec(add.itemLocationCountry) ? str(add.itemLocationCountry.isoCode) : "";
  return {
    externalId,
    auctionId: str(raw.auctionId),
    title,
    manufacturer,
    slug,
    detailUrl: autobidDetailUrl(slug, externalId),
    auctionStage: str(raw.stage),
    auctionStartAt: str(raw.auctionStartDate),
    priceStart: price(p.start),
    priceMinimal: price(p.minimal),
    priceCurrent: price(p.current),
    vatNote: str(raw.taxInformation),
    imageUrl: pickImage(raw.imageGroups),
    firstRegistration,
    year: yearFromRegistration(firstRegistration),
    mileageKm: num(equipmentValue(raw.equipments, EQ_MILEAGE)),
    fuel: equipmentValue(raw.equipments, EQ_FUEL),
    transmission: equipmentValue(raw.equipments, EQ_TRANSMISSION),
    powerKw: equipmentValue(raw.equipments, EQ_POWER_KW),
    location: equipmentValue(raw.equipments, EQ_LOCATION),
    countryCode: country,
  };
}

/** Atrod sarakstu ar `items` + `itemPageCount` un visus auto objektus (arī ja ceļš `queries[N]` mainās). */
export function parseAutobidSearchPage(html: string): AutobidSearchPage | null {
  const json = extractNuxtDataJson(html);
  if (!json) return null;
  let flat: unknown;
  try {
    flat = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(flat)) return null;
  const root = hydrateNuxtData(flat);

  const byId = new Map<string, AutobidVehicle>();
  let pageCount = 0;
  let pageNumber = 0;
  /** Saraksta konteiners ar `items` + `itemPageCount` pastāv arī tad, ja meklējums dod 0 auto. */
  let foundListContainer = false;
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (depth > 40 || node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const x of node) {
        if (looksLikeVehicle(x)) {
          const v = mapAutobidVehicle(x);
          if (v && !byId.has(v.externalId)) byId.set(v.externalId, v);
        } else {
          walk(x, depth + 1);
        }
      }
      return;
    }
    const rec = node as Rec;
    if (typeof rec.itemPageCount === "number" && Array.isArray(rec.items)) {
      foundListContainer = true;
      pageCount = Math.max(pageCount, rec.itemPageCount);
    }
    if (typeof rec.pageNumber === "number" && typeof rec.pageSize === "number") {
      pageNumber = rec.pageNumber;
    }
    for (const x of Object.values(rec)) walk(x, depth + 1);
  };
  walk(root, 0);

  if (byId.size === 0 && !foundListContainer) return null;
  return { vehicles: [...byId.values()], pageCount: Math.max(pageCount, byId.size > 0 ? 1 : 0), pageNumber };
}

/** `page` ir 1-based. Pirmajai lapai parametru noņem, lai URL sakrīt ar pasūtījumā saglabāto. */
export function autobidPageUrl(sourceUrl: string, page: number): string {
  const u = new URL(sourceUrl);
  if (page <= 1) u.searchParams.delete("currentPage");
  else u.searchParams.set("currentPage", String(page));
  return u.toString();
}
