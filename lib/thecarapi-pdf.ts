/**
 * Izsoļu portāla ieraksts klienta PDF: strukturēts modelis (`buildThecarapiPdfModel`) -> kompaktas tabulas.
 * Ārējā pakalpojuma nosaukums netiek drukāts. Saites, bilžu tehniskie lauki un iekšējie id netiek drukāti.
 */
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import {
  buildThecarapiPdfModel,
  thecarapiPdfDate,
  type ThecarapiPdfDamage,
  type ThecarapiPdfGrid,
  type ThecarapiPdfKv,
  type ThecarapiPdfModel,
} from "@/lib/thecarapi-pdf-model";
import {
  thecarapiPdfGroupTitle,
  type ThecarapiAdminRecord,
  type ThecarapiStoredPhoto,
} from "@/lib/vin-scan/thecarapi-fields";

/** Galerija nedrīkst aprauties zem 100 bildēm. cc_vin griesti ir lielāki. */
export const THECARAPI_PDF_GALLERY_MAX = Math.max(100, CC_VIN_MAX_PHOTOS);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subhead(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

function minihead(title: string): string {
  return `<p class="pdf-tc-zone">${escapeHtml(title)}</p>`;
}

function kvTable(rows: readonly ThecarapiPdfKv[]): string {
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td${row.highlight ? ' class="pdf-tc-warn"' : ""}>${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<table class="pdf-v1-kv"><tbody>${body}</tbody></table>`;
}

/** Divas kolonnas (pdf-v1-kv-pair), lai sadaļa aizņem uz pusi mazāk rindu. */
function kvPair(rows: readonly ThecarapiPdfKv[]): string {
  if (rows.length === 0) return "";
  if (rows.length < 3) return `<div class="pdf-tc-kv">${kvTable(rows)}</div>`;
  const half = Math.ceil(rows.length / 2);
  return `<div class="pdf-v1-kv-pair pdf-tc-kv">${kvTable(rows.slice(0, half))}${kvTable(rows.slice(half))}</div>`;
}

function gridTable(grid: ThecarapiPdfGrid | null): string {
  if (!grid || grid.rows.length === 0) return "";
  const keep = grid.columns.map((_, i) => i === 0 || grid.rows.some((r) => (r[i] ?? "").trim()));
  const head = grid.columns
    .filter((_, i) => keep[i])
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const body = grid.rows
    .map((r) => `<tr>${r.filter((_, i) => keep[i]).map((c) => `<td>${escapeHtml(c.trim() || "-")}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log pdf-tc-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function damagesTable(rows: readonly ThecarapiPdfDamage[]): string {
  if (rows.length === 0) return "";
  const cols: { title: string; get: (d: ThecarapiPdfDamage) => string }[] = [
    { title: "Zona", get: (d) => d.zone },
    { title: "Detaļa", get: (d) => d.part },
    { title: "Bojājuma tips", get: (d) => d.type },
    { title: "Izmērs", get: (d) => d.size },
    { title: "Daudzums", get: (d) => d.quantity },
    { title: "Remonts", get: (d) => d.repair },
    { title: "Piezīmes", get: (d) => d.notes },
  ];
  const used = cols.filter((c, i) => i < 3 || rows.some((d) => c.get(d).trim()));
  const head = used.map((c) => `<th>${escapeHtml(c.title)}</th>`).join("");
  let prevZone = "";
  const body = rows
    .map((d) => {
      const cells = used.map((c) => {
        if (c.title === "Zona") {
          const z = d.zone === prevZone ? "" : d.zone || "-";
          prevZone = d.zone;
          return `<td>${escapeHtml(z)}</td>`;
        }
        return `<td>${escapeHtml(c.get(d).trim() || "-")}</td>`;
      });
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log pdf-tc-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function line(text: string): string {
  return text ? `<p class="pdf-tc-line">${escapeHtml(text)}</p>` : "";
}

/** Viena izsole: galvene + sadaļas spec 3.1-3.11 secībā; tukšās izlaistas. */
export function renderThecarapiPdfModelHtml(model: ThecarapiPdfModel): string {
  const blocks: string[] = [`<p class="pdf-subhead pdf-tc-head">${escapeHtml(model.header)}</p>`];
  const section = (title: string, html: string): void => {
    if (html) blocks.push(subhead(title), html);
  };
  section("Pamatdati", kvPair(model.basics));
  section("Cenas", kvPair(model.prices));
  section("Nobraukums", kvPair(model.mileage));
  section("Datumi", kvPair(model.dates));

  const damage: string[] = [];
  if (model.damages.length) {
    damage.push(damagesTable(model.damages));
    if (model.damagesTotal != null) damage.push(line(`Kopā bojājumi: ${model.damagesTotal}`));
  }
  if (model.paint.length) damage.push(minihead("Laka, µm"), kvPair(model.paint));
  if (model.brakes) damage.push(minihead("Bremzes"), gridTable(model.brakes));
  section("Bojājumi", damage.join(""));

  if (model.equipment.length) {
    const groups = model.equipment
      .map((g) => `<p><strong>${escapeHtml(g.group)}:</strong> ${escapeHtml(g.items.join(" · "))}</p>`)
      .join("");
    section("Aprīkojums", `<div class="pdf-tc-eq">${groups}</div>`);
  }

  section(
    "Riepas un diski",
    model.wheels.map((set) => minihead(set.title) + gridTable(set.grid)).join(""),
  );

  const service = [
    line(model.service.summary),
    kvPair(model.service.rows),
    gridTable(model.service.entries),
    model.documents.length ? line(`Dokumenti: ${model.documents.join(", ")}`) : "",
  ].join("");
  section("Servisa vēsture", service);

  section("Citi dati", kvPair(model.other));
  return `<section class="pdf-tc-lot">${blocks.join("\n")}</section>`;
}

function recordHasData(record: ThecarapiAdminRecord): boolean {
  return Boolean(record.raw || record.rawDetail || record.rawHistory || record.fields.length || record.photos.length || record.photoUrls.length);
}

export function buildThecarapiRecordsPdfHtml(records: readonly ThecarapiAdminRecord[] | null | undefined): string {
  const parts: string[] = [];
  for (const record of records ?? []) {
    if (!recordHasData(record)) continue;
    parts.push(renderThecarapiPdfModelHtml(buildThecarapiPdfModel(record)));
  }
  return parts.join("\n");
}

/** Bildes saite -> paraksta kategorija visiem ierakstiem (Bojājums: ..., Serviss, Dokuments). */
export function thecarapiPdfPhotoCategories(records: readonly ThecarapiAdminRecord[] | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const record of records ?? []) {
    if (!recordHasData(record)) continue;
    for (const [url, cat] of Object.entries(buildThecarapiPdfModel(record).photoCategories)) {
      if (!out.has(url)) out.set(url, cat);
    }
  }
  return out;
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

function photoDay(raw: string): string {
  const t = raw.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? thecarapiPdfDate(t, false) : t;
}

/** Kompakts 4 kolonnu režģis ar datumu un kategoriju; saites netiek drukātas. */
export function buildThecarapiPdfGalleryHtml(
  photos: readonly ThecarapiStoredPhoto[],
  dataUrls: ReadonlyMap<string, string> | undefined,
  categories?: ReadonlyMap<string, string>,
): string {
  if (!dataUrls?.size || photos.length === 0) return "";
  const figures: string[] = [];
  for (const photo of photos) {
    const src = dataUrls.get(photo.id);
    if (!src) continue;
    const date = photoDay(photo.date || thecarapiPdfGroupTitle(photo.caption));
    const cat = categories?.get(photo.sourceUrl) ?? "";
    const capText = [date, cat].filter(Boolean).join(" · ");
    const cap = capText ? `<figcaption class="pdf-listing-photo-cap">${escapeHtml(capText)}</figcaption>` : "";
    figures.push(
      `<figure class="pdf-listing-photo-cell pdf-listing-photo-cell--appendix"><img class="pdf-listing-photo-img" src="${src}" alt=""/>${cap}</figure>`,
    );
  }
  if (figures.length === 0) return "";
  return `<section class="pdf-listing-photo-group"><p class="pdf-subhead">Bildes (${figures.length})</p><div class="pdf-listing-photo-grid pdf-listing-photo-grid--tc">${figures.join("")}</div></section>`;
}
