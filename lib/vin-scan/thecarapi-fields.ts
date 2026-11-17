/**
 * TheCarApi lauki: nekas netiek izmests.
 * Zināmie atslēgas nosaukumi ir latviski, pārējie paliek kā atslēga/vērtība.
 * Pilnais JSON glabājas `raw`, `rawHistory`, `rawDetail`, `rawImages`.
 */

export type ThecarapiField = {
  key: string;
  label: string;
  value: string;
};

export type ThecarapiStoredPhoto = {
  id: string;
  sourceUrl: string;
  contentHash: string;
  date: string;
  venue: string;
  caption: string;
};

export type ThecarapiAdminRecord = {
  site: string;
  id: string;
  date: string;
  venue: string;
  photoDate: string;
  photoUrls: string[];
  fields: ThecarapiField[];
  raw: unknown;
  rawHistory: unknown;
  rawDetail: unknown;
  rawImages: unknown;
  photos: ThecarapiStoredPhoto[];
};

/** Dokumentētie un tipiskie TheCarApi lauki. Nezināma atslēga paliek pati. */
export const THECARAPI_FIELD_LABELS: Record<string, string> = {
  site_name: "Platforma",
  site: "Platforma",
  platform: "Platforma",
  auction_id: "Izsoles ID",
  id: "Izsoles ID",
  auctionId: "Izsoles ID",
  mileage: "Nobraukums",
  odometer: "Nobraukums",
  start_price: "Sākuma cena",
  current_price: "Pašreizējā cena",
  final_price: "Noslēguma cena",
  public_price_eur: "Cena EUR",
  first_seen_at: "Pirmoreiz redzēts",
  last_seen_at: "Pēdējo reizi redzēts",
  is_active: "Aktīva izsole",
  archived: "Arhīvā",
  detail_path: "Detaļu ceļš",
  auction_date: "Izsoles datums",
  date: "Datums",
  sale_date: "Pārdošanas datums",
  start_date: "Sākuma datums",
  end_date: "Beigu datums",
  seller: "Pārdevējs",
  seller_name: "Pārdevējs",
  location: "Atrašanās vieta",
  city: "Pilsēta",
  country: "Valsts",
  status: "Statuss",
  damage: "Bojājumi",
  damages: "Bojājumi",
  damage_description: "Bojājumu apraksts",
  zone: "Bojājuma zona",
  note: "Piezīme",
  notes: "Piezīmes",
  description: "Apraksts",
  DamageImageUrls: "Bojājumu bildes",
  damage_image_urls: "Bojājumu bildes",
  gallery: "Galerija",
  images: "Bildes",
  photos: "Bildes",
  auction_images: "Izsoles bildes",
  url: "Saite",
  equipment: "Aprīkojums",
  Equipment: "Aprīkojums",
  vin: "VIN",
  make: "Marka",
  brand: "Marka",
  model: "Modelis",
  year: "Gads",
  fuel: "Degviela",
  transmission: "Ātrumkārba",
  color: "Krāsa",
  colour: "Krāsa",
  currency: "Valūta",
  vat: "PVN",
  bid_count: "Solījumu skaits",
  details_pending: "Detaļas vēl nav gatavas",
  title: "Nosaukums",
};

const AUCTION_DATE_KEYS = ["auction_date", "sale_date", "end_date", "start_date", "date", "auctionDate"] as const;
const PHOTO_URL_KEYS = [
  "DamageImageUrls",
  "damage_image_urls",
  "gallery",
  "images",
  "photos",
  "image_urls",
  "auction_images",
  "AuctionImages",
  "url",
  "Url",
  "href",
];

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function leafLabel(path: string): string {
  const last = path.split(".").pop() ?? path;
  const bare = last.replace(/\[\d+\]/g, "");
  return THECARAPI_FIELD_LABELS[bare] || THECARAPI_FIELD_LABELS[last] || path;
}

function scalar(raw: unknown): string {
  if (raw == null) return raw === null ? "null" : "";
  if (typeof raw === "boolean") return raw ? "jā" : "nē";
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : "";
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return "";
  }
}

function flattenInto(value: unknown, path: string, out: ThecarapiField[], depth: number): void {
  if (depth > 8) {
    if (!path) return;
    out.push({ key: path, label: leafLabel(path), value: scalar(value) });
    return;
  }
  if (Array.isArray(value)) {
    if (value.every((item) => item == null || typeof item !== "object")) {
      if (!path) return;
      out.push({ key: path, label: leafLabel(path), value: value.map((item) => scalar(item)).join(", ") });
      return;
    }
    value.forEach((item, index) => flattenInto(item, path ? `${path}[${index}]` : `[${index}]`, out, depth + 1));
    return;
  }
  const rec = asRecord(value);
  if (!rec) {
    if (!path) return;
    out.push({ key: path, label: leafLabel(path), value: scalar(value) });
    return;
  }
  const keys = Object.keys(rec);
  if (path && keys.length === 0) {
    out.push({ key: path, label: leafLabel(path), value: "{}" });
    return;
  }
  for (const key of keys) {
    flattenInto(rec[key], path ? `${path}.${key}` : key, out, depth + 1);
  }
}

export function thecarapiFieldsOf(raw: unknown): ThecarapiField[] {
  const out: ThecarapiField[] = [];
  flattenInto(raw, "", out, 0);
  return out;
}

function isoDay(raw: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(typeof raw === "string" ? raw.trim() : "");
  return m?.[1] ?? "";
}

export function thecarapiPhotoDate(row: Record<string, unknown>): string {
  for (const key of AUCTION_DATE_KEYS) {
    const day = isoDay(row[key]);
    if (day) return day;
  }
  return isoDay(row.first_seen_at) || isoDay(row.last_seen_at);
}

function pushUrl(raw: unknown, out: string[], seen: Set<string>): void {
  if (typeof raw === "string") {
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
    return;
  }
  const rec = asRecord(raw);
  if (!rec) return;
  for (const key of PHOTO_URL_KEYS) pushUrl(rec[key], out, seen);
}

function walkUrls(raw: unknown, out: string[], seen: Set<string>, depth: number): void {
  if (depth > 8 || raw == null) return;
  if (typeof raw === "string") {
    if (/^https?:\/\//i.test(raw.trim())) pushUrl(raw, out, seen);
    return;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) walkUrls(item, out, seen, depth + 1);
    return;
  }
  const rec = asRecord(raw);
  if (!rec) return;
  for (const value of Object.values(rec)) walkUrls(value, out, seen, depth + 1);
}

export function thecarapiAllUrls(...parts: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) walkUrls(part, out, seen, 0);
  return out;
}

export function thecarapiDownloadUrls(urls: readonly string[], allow: (url: string) => boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = raw.trim();
    if (!url || seen.has(url) || !allow(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function mergeThecarapiRaw(history: unknown, detail: unknown, images: unknown): Record<string, unknown> {
  const h = asRecord(history) ?? {};
  const d = asRecord(detail) ?? {};
  const merged: Record<string, unknown> = { ...h, ...d };
  if (images != null) merged.auction_images = images;
  for (const [key, value] of Object.entries(h)) {
    if (Object.prototype.hasOwnProperty.call(d, key) && !sameJson(value, d[key])) {
      merged[`history_${key}`] = value;
    }
  }
  return merged;
}

export function thecarapiRecordKey(site: string, id: string): string {
  return `${site}:${id}`;
}

export function emptyThecarapiAdminRecord(): ThecarapiAdminRecord {
  return {
    site: "",
    id: "",
    date: "",
    venue: "",
    photoDate: "",
    photoUrls: [],
    fields: [],
    raw: null,
    rawHistory: null,
    rawDetail: null,
    rawImages: null,
    photos: [],
  };
}

export function normalizeThecarapiAdminRecords(raw: unknown): ThecarapiAdminRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ThecarapiAdminRecord[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fields = Array.isArray(rec.fields)
      ? rec.fields
          .map((field) => {
            const row = asRecord(field);
            if (!row) return null;
            const key = typeof row.key === "string" ? row.key.slice(0, 200) : "";
            if (!key) return null;
            return {
              key,
              label: typeof row.label === "string" && row.label.trim() ? row.label.slice(0, 200) : key,
              value: typeof row.value === "string" ? row.value : scalar(row.value),
            };
          })
          .filter((field): field is ThecarapiField => Boolean(field))
      : [];
    const photos = Array.isArray(rec.photos)
      ? rec.photos
          .map((photo) => {
            const row = asRecord(photo);
            if (!row) return null;
            const id = typeof row.id === "string" ? row.id : "";
            if (!/^ih_ph_[a-f0-9]{24}$/.test(id)) return null;
            const sourceUrl = typeof row.sourceUrl === "string" ? row.sourceUrl : "";
            const contentHash = typeof row.contentHash === "string" ? row.contentHash : "";
            return {
              id,
              sourceUrl,
              contentHash,
              date: typeof row.date === "string" ? row.date.slice(0, 40) : "",
              venue: typeof row.venue === "string" ? row.venue.slice(0, 80) : "",
              caption: typeof row.caption === "string" ? row.caption.slice(0, 160) : "",
            };
          })
          .filter((photo): photo is ThecarapiStoredPhoto => Boolean(photo))
      : [];
    out.push({
      site: typeof rec.site === "string" ? rec.site.slice(0, 40) : "",
      id: typeof rec.id === "string" ? rec.id.slice(0, 80) : "",
      date: typeof rec.date === "string" ? rec.date.slice(0, 40) : "",
      venue: typeof rec.venue === "string" ? rec.venue.slice(0, 80) : "",
      photoDate: typeof rec.photoDate === "string" ? rec.photoDate.slice(0, 40) : "",
      photoUrls: Array.isArray(rec.photoUrls) ? rec.photoUrls.filter((url): url is string => typeof url === "string").slice(0, 500) : [],
      fields,
      raw: rec.raw ?? null,
      rawHistory: rec.rawHistory ?? null,
      rawDetail: rec.rawDetail ?? null,
      rawImages: rec.rawImages ?? null,
      photos,
    });
    if (out.length >= 100) break;
  }
  return out;
}

export function thecarapiPhotoCaption(venue: string, date: string): string {
  return ["TheCarApi", venue, date].filter(Boolean).join(" · ");
}

export function thecarapiGalleryTitle(venue: string, date: string): string {
  return thecarapiPhotoCaption(venue, date).slice(0, 120);
}

/** Klienta PDF neredz ārējā pakalpojuma nosaukumu. Admin paraksts paliek. */
export function thecarapiPdfGroupTitle(title: string): string {
  return title.replace(/^TheCarApi\s*·\s*/, "").trim();
}
