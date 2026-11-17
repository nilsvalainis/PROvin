/**
 * TheCarApi ieraksts klienta PDF: visi lauki grupās, bildes ar datumu.
 * Ārējā pakalpojuma nosaukums netiek drukāts.
 */
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import {
  thecarapiPdfGroupTitle,
  type ThecarapiAdminRecord,
  type ThecarapiField,
  type ThecarapiStoredPhoto,
} from "@/lib/vin-scan/thecarapi-fields";

/** Galerija nedrīkst aprauties zem 100 bildēm. cc_vin griesti ir lielāki. */
export const THECARAPI_PDF_GALLERY_MAX = Math.max(100, CC_VIN_MAX_PHOTOS);

const SECTION_TITLES = [
  "Pamatdati",
  "Cenas",
  "Nobraukums",
  "Datumi",
  "Bojājumi",
  "Aprīkojums",
  "Serviss",
  "Bildes",
  "Citi dati",
] as const;

type SectionTitle = (typeof SECTION_TITLES)[number];

const BASIC_KEYS = new Set([
  "site_name",
  "site",
  "platform",
  "auction_id",
  "id",
  "auctionId",
  "vin",
  "make",
  "brand",
  "model",
  "year",
  "fuel",
  "transmission",
  "color",
  "colour",
  "status",
  "seller",
  "seller_name",
  "location",
  "city",
  "country",
  "title",
  "body",
  "provin_archive",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leafKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  return last.replace(/\[\d+\]/g, "");
}

function sectionOf(key: string): SectionTitle {
  const leaf = leafKey(key);
  const full = key.toLowerCase();
  if (leaf === "provin_archive" || BASIC_KEYS.has(leaf)) return "Pamatdati";
  if (
    /image|gallery|documentphoto|videourl|thumbnail|vault_gallery|served_url|^photos$|^url$|^href$|^src$|image_index|image_source|image_status|image_url/i.test(leaf) ||
    /imageurls|imagevault|subareaimages|documentphoto|videourl|gallery|auction_images|thumbnail/.test(full)
  ) {
    return "Bildes";
  }
  if (/equipment|^options$|^features$/i.test(leaf) || /equipment/.test(full)) return "Aprīkojums";
  if (/service/.test(full)) return "Serviss";
  if (/damage|zone|subarea|severity/.test(full)) return "Bojājumi";
  if (/_at$|_date$|^date$|^first_seen$|^last_seen$|^server_time$/.test(leaf)) return "Datumi";
  if (/mileage|odometer|^km$/.test(leaf)) return "Nobraukums";
  if (/price|current_final|^start$|bid_count|^currency$|^vat$/.test(leaf) || /price/.test(full)) return "Cenas";
  return "Citi dati";
}

function damagePrefix(key: string): string {
  const indexed = /^(.*\[\d+\])/.exec(key);
  if (indexed?.[1]) return indexed[1];
  const dot = key.lastIndexOf(".");
  return dot > 0 ? key.slice(0, dot) : key;
}

function table(rows: readonly ThecarapiField[]): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label || row.key)}</th><td>${escapeHtml(row.value || "-")}</td></tr>`,
    )
    .join("");
  return `<table class="pdf-v1-kv pdf-tc-kv"><tbody>${body}</tbody></table>`;
}

function subhead(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

export function buildThecarapiRecordsPdfHtml(records: readonly ThecarapiAdminRecord[] | null | undefined): string {
  const parts: string[] = [];
  for (const record of records ?? []) {
    if (!record.fields.length && !record.photos.length && !record.photoUrls.length) continue;
    const buckets = new Map<SectionTitle, ThecarapiField[]>();
    for (const title of SECTION_TITLES) buckets.set(title, []);
    for (const field of record.fields) {
      if (!field.value.trim()) continue;
      buckets.get(sectionOf(field.key))!.push(field);
    }
    const headBits = [record.venue, record.photoDate || record.date, record.id].filter(Boolean);
    const blocks: string[] = [subhead(headBits.join(" · ") || "Izsole")];
    for (const title of SECTION_TITLES) {
      const rows = buckets.get(title) ?? [];
      if (rows.length === 0) continue;
      blocks.push(subhead(title));
      if (title === "Bojājumi") {
        const groups = new Map<string, ThecarapiField[]>();
        for (const row of rows) {
          const prefix = damagePrefix(row.key);
          const list = groups.get(prefix) ?? [];
          list.push(row);
          groups.set(prefix, list);
        }
        let n = 0;
        for (const group of groups.values()) {
          n += 1;
          const zone = group.find((row) => /zone|area|subarea/i.test(leafKey(row.key)) && !/image/i.test(row.key));
          blocks.push(`<p class="pdf-tc-zone">${escapeHtml(zone?.value || `Bojājums ${n}`)}</p>`);
          blocks.push(table(group));
        }
        continue;
      }
      blocks.push(table(rows));
    }
    parts.push(`<section class="pdf-tc-lot">${blocks.join("\n")}</section>`);
  }
  return parts.join("\n");
}

type PhotoLike = { id?: string; sourceUrl?: string; contentHash?: string };

export function collectPdfPhotoKeys(
  groups: readonly { photos?: readonly PhotoLike[] | null }[] | null | undefined,
): Set<string> {
  const keys = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (photo.id) keys.add(`id:${photo.id}`);
      if (photo.sourceUrl?.trim()) keys.add(`url:${photo.sourceUrl.trim()}`);
      if (photo.contentHash?.trim()) keys.add(`hash:${photo.contentHash.trim().toLowerCase()}`);
    }
  }
  return keys;
}

function photoKeys(photo: PhotoLike): string[] {
  const keys: string[] = [];
  if (photo.id) keys.push(`id:${photo.id}`);
  if (photo.sourceUrl?.trim()) keys.push(`url:${photo.sourceUrl.trim()}`);
  if (photo.contentHash?.trim()) keys.push(`hash:${photo.contentHash.trim().toLowerCase()}`);
  return keys;
}

export function selectThecarapiPdfPhotos(
  records: readonly ThecarapiAdminRecord[] | null | undefined,
  opts?: { usedKeys?: ReadonlySet<string>; max?: number },
): ThecarapiStoredPhoto[] {
  const max = opts?.max ?? THECARAPI_PDF_GALLERY_MAX;
  const seen = new Set<string>(opts?.usedKeys ?? []);
  const out: ThecarapiStoredPhoto[] = [];
  for (const record of records ?? []) {
    for (const photo of record.photos ?? []) {
      if (!photo?.id) continue;
      const keys = photoKeys(photo);
      if (keys.some((key) => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      out.push(photo);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function buildThecarapiPdfGalleryHtml(
  photos: readonly ThecarapiStoredPhoto[],
  dataUrls: ReadonlyMap<string, string> | undefined,
): string {
  if (!dataUrls?.size || photos.length === 0) return "";
  const figures: string[] = [];
  for (const photo of photos) {
    const src = dataUrls.get(photo.id);
    if (!src) continue;
    const date = photo.date || thecarapiPdfGroupTitle(photo.caption);
    const cap = date ? `<figcaption class="pdf-listing-photo-cap">${escapeHtml(date)}</figcaption>` : "";
    figures.push(`<figure class="pdf-listing-photo-cell"><img class="pdf-listing-photo-img" src="${src}" alt=""/>${cap}</figure>`);
  }
  if (figures.length === 0) return "";
  return `<section class="pdf-listing-photo-group"><p class="pdf-subhead">Bildes</p><div class="pdf-listing-photo-grid">${figures.join("")}</div></section>`;
}
