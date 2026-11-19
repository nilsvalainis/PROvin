/**
 * Izsoļu portāla ieraksts klienta PDF: strukturēts modelis (`buildThecarapiPdfModel`) -> tās pašas klases kā
 * «OFICIĀLĀ DĪLERA DATI» sadaļā (pdf-dealer-cover, pdf-svc-summary, pdf-dealer-vehicle-kv, pdf-svc-major, pdf-dealer-eq).
 * Ārējā pakalpojuma nosaukums netiek drukāts. Saites, bilžu tehniskie lauki un iekšējie id netiek drukāti.
 */
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import { buildPaintMapSvg, paintMapSlotOf, type PaintMapReading } from "@/lib/paint-map-svg";
import { buildPdfKvPairHtml } from "@/lib/pdf-fact-card";
import {
  buildThecarapiPdfModel,
  thecarapiPdfDate,
  type ThecarapiPdfDamage,
  type ThecarapiPdfGrid,
  type ThecarapiPdfKv,
  type ThecarapiPdfModel,
  type ThecarapiPdfPaint,
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

type Tone = "ok" | "warn" | "alert" | "neutral";

/** Krāsains teksts (tikai lakai un stāvokļiem); pārējais kā dīlera sadaļā. */
function toneText(text: string, tone: Tone): string {
  if (tone === "neutral") return escapeHtml(text);
  return `<span class="pdf-tc-tone pdf-tc-tone--${tone}">${escapeHtml(text)}</span>`;
}

/** Dīlera «Transportlīdzekļa informācija» kv tabula (divas kolonnas). */
function kvBlock(rows: readonly ThecarapiPdfKv[]): string {
  if (rows.length === 0) return "";
  const table = buildPdfKvPairHtml(
    rows.map((row) => ({
      k: row.label,
      v: row.value,
      vHtml: row.highlight ? toneText(row.value, "alert") : undefined,
    })),
  );
  return `<div class="pdf-dealer-vehicle-kv">${table}</div>`;
}

/** Sadaļa ar dīlera virsraksta + tabulas «keep-head» uzvedību. */
function kvSection(title: string, rows: readonly ThecarapiPdfKv[]): string {
  const body = kvBlock(rows);
  if (!body) return "";
  // Īsa tabula paliek kopā ar virsrakstu; gara drīkst plūst pāri lapai (citādi paliek tukša puslapa).
  return rows.length <= 8 ? `<div class="pdf-keep-head">${subhead(title)}${body}</div>` : `${subhead(title)}${body}`;
}

function gridTable(grid: ThecarapiPdfGrid | null, toneCol?: (col: string) => boolean): string {
  if (!grid || grid.rows.length === 0) return "";
  const keep = grid.columns.map((_, i) => i === 0 || grid.rows.some((r) => (r[i] ?? "").trim()));
  const head = grid.columns
    .filter((_, i) => keep[i])
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const body = grid.rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => ({ c: c.trim(), i }))
          .filter(({ i }) => keep[i])
          .map(({ c, i }) => {
            if (!c) return "<td>-</td>";
            const tone = toneCol?.(grid.columns[i] ?? "") ? statusTone(c) : "neutral";
            return `<td>${toneText(c, tone)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log pdf-tc-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const KM_RE = /^([\d\s ]+km)\s*(?:\((.+)\))?$/;

function kmMain(value: string): string {
  const m = KM_RE.exec(value.trim());
  return m ? m[1]!.trim() : value;
}

function findKv(rows: readonly ThecarapiPdfKv[], label: RegExp): ThecarapiPdfKv | undefined {
  return rows.find((r) => label.test(r.label));
}

function damageCount(model: ThecarapiPdfModel): number | null {
  if (model.damagesTotal != null) return model.damagesTotal;
  if (model.damages.length) {
    return model.damages.reduce((sum, d) => {
      const n = Number.parseInt(d.quantity, 10);
      return sum + (Number.isFinite(n) && n > 0 ? n : 1);
    }, 0);
  }
  const hasInspection = model.paint.length > 0 || model.brakes != null || model.wheels.length > 0;
  return hasInspection ? 0 : null;
}

function auctionDay(model: ThecarapiPdfModel): string {
  const end = findKv(model.dates, /beigas|izsoles datums/i)?.value ?? "";
  const fromDates = /^\d{2}\.\d{2}\.\d{4}/.exec(end)?.[0];
  if (fromDates) return fromDates;
  return /\b\d{2}\.\d{2}\.\d{4}\b/.exec(model.header)?.[0] ?? "";
}

/** Izsoles galvene dīlera vāka stilā: platforma kā virsraksts, pārējais meta rindā. */
function coverHtml(model: ThecarapiPdfModel): string {
  const [title, ...meta] = model.header.split(" · ");
  const metaHtml = meta.length ? `<p class="pdf-dealer-cover__meta">${escapeHtml(meta.join(" · "))}</p>` : "";
  return `<div class="pdf-dealer-cover pdf-tc-cover"><p class="pdf-dealer-cover__kicker">Izsoles dati</p><h3 class="pdf-dealer-cover__model">${escapeHtml(title || "Izsole")}</h3>${metaHtml}</div>`;
}

/** Galvenie fakti - dīlera kopsavilkuma josla (4 šūnas). */
function summaryHtml(model: ThecarapiPdfModel): string {
  const cells: { k: string; v: string }[] = [];
  const price = findKv(model.prices, /^Noslēguma cena$/) ?? findKv(model.prices, /^Pēdējā cena$/);
  if (price) cells.push({ k: price.label, v: price.value });
  const odo = findKv(model.mileage, /^Nobraukums$/);
  if (odo) cells.push({ k: "Nobraukums", v: kmMain(odo.value) });
  const day = auctionDay(model);
  if (day) cells.push({ k: "Izsoles datums", v: day });
  const n = damageCount(model);
  if (n != null) cells.push({ k: "Bojājumi", v: String(n) });
  if (cells.length === 0) return "";
  return `<div class="pdf-svc-summary pdf-tc-summary">${cells
    .map((c) => `<div class="pdf-svc-summary__cell"><span>${escapeHtml(c.k)}</span><b>${escapeHtml(c.v)}</b></div>`)
    .join("")}</div>`;
}

/** Bojājumi pa zonām: katra zona kā dīlera «Lielie darbi» kartīte. */
function damageZones(model: ThecarapiPdfModel): string {
  const rows = model.damages;
  if (rows.length === 0) return "";
  const zones: { zone: string; items: ThecarapiPdfDamage[] }[] = [];
  for (const d of rows) {
    const z = d.zone || "Cita zona";
    const last = zones[zones.length - 1];
    if (last && last.zone === z) last.items.push(d);
    else zones.push({ zone: z, items: [d] });
  }
  const cards = zones
    .map(({ zone, items }) => {
      const lines = items
        .map((d) => {
          const meta = [d.type, d.size, d.quantity ? `${d.quantity} gab.` : "", d.repair ? `Remonts: ${d.repair}` : "", d.notes]
            .filter(Boolean)
            .join(" · ");
          return `<li class="pdf-svc-major__item"><b>${escapeHtml(d.part || "-")}</b><span class="pdf-svc-major__meta">${escapeHtml(meta)}</span></li>`;
        })
        .join("");
      return `<aside class="pdf-svc-major pdf-tc-zone"><p class="pdf-subhead">${escapeHtml(zone)}</p><ul class="pdf-svc-major__list">${lines}</ul></aside>`;
    })
    .join("");
  return `<div class="pdf-tc-cols">${cards}</div>`;
}

/** Lakas biezums: ≤160 rūpnīcas, 161-300 iespējama pārkrāsošana, >300 iespējams špaktelis. */
export function thecarapiPaintTone(value: string): Tone {
  const n = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n)) return "neutral";
  if (n <= 160) return "ok";
  return n <= 300 ? "warn" : "alert";
}

/** Shēmas tonis (bez «neutral»): skaitlis bez vērtības paliek tikai tabulā. */
function paintMapTone(value: string): PaintMapReading["tone"] | null {
  const tone = thecarapiPaintTone(value);
  return tone === "neutral" ? null : tone;
}

function paintValueText(value: string): string {
  return /^\d+([.,]\d+)?$/.test(value.trim()) ? `${value} µm` : value;
}

/**
 * Lakas biezums: IRISS piedāvājuma virsbūves shēma (tā pati ģeometrija kā `PdPaintMap`) ar µm uz detaļām.
 * Mērījumi, kam shēmā nav vietas (vai vieta jau aizņemta), - tabulā zem shēmas, lai nekas nepazūd.
 */
function paintBlock(rows: readonly ThecarapiPdfPaint[]): string {
  if (rows.length === 0) return "";
  const readings: PaintMapReading[] = [];
  const taken = new Set<string>();
  const rest: ThecarapiPdfPaint[] = [];
  for (const row of rows) {
    const slot = paintMapSlotOf(row.area || row.label);
    const tone = paintMapTone(row.value);
    const key = slot ? `${slot.zone}:${slot.slot}` : "";
    if (slot && tone && !taken.has(key)) {
      taken.add(key);
      readings.push({ slot, text: paintValueText(row.value), tone });
    } else rest.push(row);
  }
  const map = readings.length ? `<div class="pdf-tc-paint-map">${buildPaintMapSvg(readings)}</div>` : "";
  const table = rest.length
    ? `<div class="pdf-dealer-vehicle-kv">${buildPdfKvPairHtml(
        rest.map((row) => {
          const v = paintValueText(row.value);
          return { k: row.label, v, vHtml: toneText(v, thecarapiPaintTone(row.value)) };
        }),
      )}</div>`
    : "";
  const legend = `<p class="pdf-dealer-cover-note pdf-tc-legend">${toneText("≤160 µm rūpnīcas krāsojums", "ok")} · ${toneText("161-300 µm iespējama pārkrāsošana", "warn")} · ${toneText(">300 µm iespējams špaktelis", "alert")}</p>`;
  return `${map}${table}${legend}`;
}

/** «Automašīnas pamatdati» - tikai šie lauki un šajā secībā (Nils 19.11, v4). Pārējie pamatdati PDF netiek drukāti. */
export const THECARAPI_PDF_VEHICLE_LABELS = [
  "Izcelsmes valsts",
  "Reģistrācijas valsts",
  "Iepriekšējā lietošana",
  "Komerclietošana",
  "Auto statuss",
  "Īpašnieku skaits",
  "Atslēgu skaits",
  "Tehniskā apskate derīga līdz",
  "Negadījumi",
] as const;

/** Citu izsoļu svarīgie pamatdati, kas pārcelti uz atbilstošo sadaļu (Copart, BCA u.c.). */
export const THECARAPI_PDF_DAMAGE_LABELS = ["Galvenais bojājums", "Papildu bojājums", "Iedarbojas un brauc", "Dokumentu statuss"] as const;
export const THECARAPI_PDF_PRICE_LABELS = ["PVN režīms"] as const;

function basicsByLabels(basics: readonly ThecarapiPdfKv[], labels: readonly string[]): ThecarapiPdfKv[] {
  const base = (label: string): string => label.replace(/\s+\((cits avots|vēstures dati)\)$/, "");
  return labels.flatMap((label) => basics.filter((row) => base(row.label) === label && row.value.trim()));
}

export function thecarapiPdfVehicleRows(basics: readonly ThecarapiPdfKv[]): ThecarapiPdfKv[] {
  return basicsByLabels(basics, THECARAPI_PDF_VEHICLE_LABELS);
}

function statusTone(value: string): Tone {
  const v = value.trim().toLowerCase();
  if (!v || /nav izmērām|nav zinām|nav pieejam/.test(v)) return "neutral";
  if (/^(ok|labs|laba|labā|kā jauna|jā)$/.test(v)) return "ok";
  if (/bojāt|nomain|kritisk|slikt|nolietot|nav ok|defekt|trūkst/.test(v)) return "alert";
  return "warn";
}

const STATUS_COL = (col: string): boolean => /novērtējums|statuss|stāvoklis/i.test(col);

/** «Pēdējais serviss X pie Y km · Servisa grāmata: papīra» -> kv rindas. */
function serviceSummaryRows(summary: string): ThecarapiPdfKv[] {
  if (!summary.trim()) return [];
  return summary.split(" · ").map((part) => {
    const t = part.trim();
    const colon = t.indexOf(": ");
    if (colon > 0) return { label: t.slice(0, colon), value: t.slice(colon + 2) };
    const m = /^(Pēdējais serviss)\s+(.+)$/.exec(t);
    return m ? { label: m[1]!, value: m[2]! } : { label: "Serviss", value: t };
  });
}

/**
 * Viena izsole dīlera sadaļas vizuālajā valodā: vāks, kopsavilkuma josla, kv tabulas, «Lielie darbi» kartītes.
 * Aprīkojums netiek drukāts (Nils 19.11) - modelī tas paliek, bet PDF nav.
 */
export function renderThecarapiPdfModelHtml(model: ThecarapiPdfModel): string {
  const blocks: string[] = [`<div class="pdf-tc-intro">${coverHtml(model)}${summaryHtml(model)}</div>`];
  const push = (html: string): void => {
    if (html) blocks.push(html);
  };

  push(kvSection("Automašīnas pamatdati", thecarapiPdfVehicleRows(model.basics)));
  push(kvSection("Cenas", [...model.prices, ...basicsByLabels(model.basics, THECARAPI_PDF_PRICE_LABELS)]));
  push(kvSection("Nobraukums", model.mileage));
  push(kvSection("Datumi", model.dates));

  // Bojājumu kopsavilkums (Copart u.c.) īsā kv tabulā pirms zonu kartītēm.
  const damageRows = basicsByLabels(model.basics, THECARAPI_PDF_DAMAGE_LABELS).map((row) => ({
    ...row,
    highlight: /bojājums$/.test(row.label) || (row.label === "Iedarbojas un brauc" && /^nē/i.test(row.value)) || (row.label === "Dokumentu statuss" && /avārij|salvage/i.test(row.value)),
  }));
  const zones = damageZones(model);
  if (zones || damageRows.length) push(`${subhead("Bojājumi")}${kvBlock(damageRows)}${zones}`);
  const paint = paintBlock(model.paint);
  if (paint) push(`<div class="pdf-keep-head pdf-tc-paint">${subhead("Lakas biezums")}${paint}</div>`);
  if (model.brakes?.rows.length) push(`<div class="pdf-keep-head">${subhead("Bremzes")}${gridTable(model.brakes, STATUS_COL)}</div>`);

  for (const set of model.wheels) {
    const table = gridTable(set.grid, STATUS_COL);
    if (table) push(`<div class="pdf-keep-head">${subhead(`Riepas un diski - ${set.title}`)}${table}</div>`);
  }

  const serviceRows = [...serviceSummaryRows(model.service.summary), ...model.service.rows];
  const service = [kvBlock(serviceRows), gridTable(model.service.entries)].join("");
  if (service) push(`${subhead("Servisa vēsture")}${service}`);
  if (model.documents.length) {
    push(
      `<div class="pdf-keep-head">${subhead("Dokumenti")}<ul class="pdf-dealer-eq">${model.documents.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul></div>`,
    );
  }

  push(kvSection("Citi dati", model.other));
  return `<section class="pdf-tc-lot">${blocks.filter(Boolean).join("\n")}</section>`;
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
