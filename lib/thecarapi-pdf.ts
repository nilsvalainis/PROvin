/**
 * Izsoļu portāla ieraksts klienta PDF: strukturēts modelis (`buildThecarapiPdfModel`) -> kartītes, čipi un
 * kompakti režģi atskaites vizuālajā valodā (kopsavilkuma kartītes, zaļie/dzeltenie/sarkanie čipi).
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

type Tone = "ok" | "warn" | "alert" | "neutral";

function chip(text: string, cls = ""): string {
  return `<span class="pdf-tc-chip${cls ? ` ${cls}` : ""}">${escapeHtml(text)}</span>`;
}

function toneChip(text: string, tone: Tone): string {
  return chip(text, `pdf-tc-chip--${tone}`);
}

/** Etiķete (mazie burti, pelēka) + vērtība (trekna) kompaktā 3 kolonnu režģī. */
function factsGrid(rows: readonly ThecarapiPdfKv[], light = false): string {
  if (rows.length === 0) return "";
  const cells = rows
    .map(
      (row) =>
        `<div class="pdf-tc-fact"><p class="pdf-tc-fact__lab">${escapeHtml(row.label)}</p><p class="pdf-tc-fact__val${row.highlight ? " pdf-tc-warn" : ""}">${escapeHtml(row.value)}</p></div>`,
    )
    .join("");
  return `<div class="pdf-tc-facts${light ? " pdf-tc-facts--light" : ""}">${cells}</div>`;
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

const KM_RE = /^([\d\s ]+km)\s*(?:\((.+)\))?$/;

function kmParts(value: string): { main: string; note: string } {
  const m = KM_RE.exec(value.trim());
  return m ? { main: m[1]!.trim(), note: (m[2] ?? "").trim() } : { main: value, note: "" };
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

function damageTone(n: number): Tone {
  if (n <= 0) return "ok";
  return n <= 3 ? "warn" : "alert";
}

function auctionDay(model: ThecarapiPdfModel): string {
  const end = findKv(model.dates, /beigas|izsoles datums/i)?.value ?? "";
  const fromDates = /^\d{2}\.\d{2}\.\d{4}/.exec(end)?.[0];
  if (fromDates) return fromDates;
  return /\b\d{2}\.\d{2}\.\d{4}\b/.exec(model.header)?.[0] ?? "";
}

/** 1. Galvenie fakti: 4 kartītes kā atskaites kopsavilkumā. */
function keyTiles(model: ThecarapiPdfModel): string {
  const tiles: { label: string; value: string; tone: Tone; note?: string }[] = [];
  const price = findKv(model.prices, /^Noslēguma cena$/) ?? findKv(model.prices, /^Pēdējā cena$/);
  if (price) tiles.push({ label: price.label, value: price.value, tone: "neutral" });
  const odo = findKv(model.mileage, /^Nobraukums$/);
  if (odo) tiles.push({ label: "Nobraukums", value: kmParts(odo.value).main, tone: "neutral" });
  const day = auctionDay(model);
  if (day) tiles.push({ label: "Izsoles datums", value: day, tone: "neutral" });
  const n = damageCount(model);
  if (n != null) tiles.push({ label: "Bojājumi", value: String(n), tone: damageTone(n) });
  if (tiles.length === 0) return "";
  const items = tiles
    .map(
      (t) =>
        `<li class="pdf-summary-tile pdf-summary-tile--${t.tone === "neutral" ? "info" : t.tone} pdf-tc-tile"><p class="pdf-summary-tile__label">${escapeHtml(t.label)}</p><p class="pdf-summary-tile__value">${escapeHtml(t.value)}</p></li>`,
    )
    .join("");
  return `<ul class="pdf-summary-tiles pdf-tc-tiles">${items}</ul>`;
}

const LADDER_ORDER = ["Sākuma cena", "Pārdevēja prasītā cena", "Pēdējā cena", "Noslēguma cena"];

/** 3. Cenu kāpnes: Sākuma -> Pārdevēja prasītā -> Noslēguma (izcelta); pārējās cenas blakus. */
function priceLadder(rows: readonly ThecarapiPdfKv[]): string {
  if (rows.length === 0) return "";
  const ladder = LADDER_ORDER.map((l) => rows.find((r) => r.label === l)).filter((r): r is ThecarapiPdfKv => Boolean(r));
  const rest = rows.filter((r) => !LADDER_ORDER.includes(r.label));
  const step = (r: ThecarapiPdfKv, final: boolean): string =>
    `<div class="pdf-tc-price${final ? " pdf-tc-price--final" : ""}"><p class="pdf-tc-price__lab">${escapeHtml(r.label)}</p><p class="pdf-tc-price__val">${escapeHtml(r.value)}</p></div>`;
  const ladderHtml = ladder
    .map((r, i) => step(r, i === ladder.length - 1 && ladder.length > 1))
    .join(`<span class="pdf-tc-arrow" aria-hidden="true">→</span>`);
  const restHtml = rest.map((r) => step(r, false)).join("");
  return `<div class="pdf-tc-ladder">${ladderHtml}${restHtml}</div>`;
}

/** 4. Nobraukums: vērtība + avota piezīme kā čips. */
function mileageList(rows: readonly ThecarapiPdfKv[]): string {
  if (rows.length === 0) return "";
  const items = rows
    .map((row) => {
      const { main, note } = kmParts(row.value);
      const head = row.label === "Nobraukums" ? "" : `<p class="pdf-tc-fact__lab">${escapeHtml(row.label)}</p>`;
      return `<div class="pdf-tc-odo">${head}<p class="pdf-tc-odo__val"><strong>${escapeHtml(main)}</strong>${note ? ` ${chip(note)}` : ""}</p></div>`;
    })
    .join("");
  return `<div class="pdf-tc-odos">${items}</div>`;
}

/** 5. Bojājumi pa zonām: zonas kartīte ar čipiem; kopskaits kā žetons. */
function damageCards(model: ThecarapiPdfModel): string {
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
          const chips = [
            d.type ? toneChip(d.type, "alert") : "",
            d.size ? chip(d.size) : "",
            d.quantity ? chip(`${d.quantity} gab.`) : "",
            d.repair ? chip(`Remonts: ${d.repair}`) : "",
          ].join("");
          const notes = d.notes ? `<p class="pdf-tc-dmg__note">${escapeHtml(d.notes)}</p>` : "";
          return `<div class="pdf-tc-dmg__line"><p class="pdf-tc-dmg__part">${escapeHtml(d.part || "-")}</p><p class="pdf-tc-chips">${chips}</p>${notes}</div>`;
        })
        .join("");
      return `<div class="pdf-tc-card pdf-tc-dmg"><p class="pdf-tc-card__top">${chip(zone, "pdf-tc-chip--zone")}</p>${lines}</div>`;
    })
    .join("");
  return `<div class="pdf-tc-cards">${cards}</div>`;
}

/** 6. Lakas biezums: ≤160 rūpnīcas, 161-300 iespējama pārkrāsošana, >300 iespējams špaktelis. */
export function thecarapiPaintTone(value: string): Tone {
  const n = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n)) return "neutral";
  if (n <= 160) return "ok";
  return n <= 300 ? "warn" : "alert";
}

function paintGrid(rows: readonly ThecarapiPdfKv[]): string {
  if (rows.length === 0) return "";
  const cells = rows
    .map((row) => {
      const tone = thecarapiPaintTone(row.value);
      const unit = /^\d+([.,]\d+)?$/.test(row.value.trim()) ? " µm" : "";
      return `<div class="pdf-tc-paint__cell"><p class="pdf-tc-paint__lab">${escapeHtml(row.label)}</p>${toneChip(`${row.value}${unit}`, tone)}</div>`;
    })
    .join("");
  const legend = `<p class="pdf-tc-legend"><span class="pdf-tc-dot pdf-tc-dot--ok"></span>≤160 µm rūpnīcas krāsojums<span class="pdf-tc-dot pdf-tc-dot--warn"></span>161-300 µm iespējama pārkrāsošana<span class="pdf-tc-dot pdf-tc-dot--alert"></span>&gt;300 µm iespējams špaktelis</p>`;
  return `<div class="pdf-tc-paint">${cells}</div>${legend}`;
}

/** Kolonnas nosaukums -> īss priedēklis riteņa kartītē (bez tā vērtība nav saprotama). */
const WHEEL_PREFIX: Record<string, string> = {
  "Kluču biezums": "kluči",
  "Diska stāvoklis": "disks",
  Protektors: "protektors",
  DOT: "DOT",
  Izmērs: "",
  Riepa: "",
  Tips: "",
  Stāvoklis: "",
  Disks: "",
};

function statusTone(value: string): Tone {
  const v = value.trim().toLowerCase();
  if (!v) return "neutral";
  if (/^(ok|labs|laba|labā|kā jauna|jā)$/.test(v)) return "ok";
  if (/bojāt|nomain|kritisk|slikt|nolietot|nav ok|defekt|trūkst/.test(v)) return "alert";
  return "warn";
}

/** 7. Riteņu kartītes (bremzes, riepas): nosaukums + statusa čips + vērtības vienā rindā. */
function wheelCards(grid: ThecarapiPdfGrid | null): string {
  if (!grid || grid.rows.length === 0) return "";
  const statusIdx = grid.columns.findIndex((c) => /novērtējums|statuss/i.test(c));
  const cards = grid.rows
    .map((row) => {
      const name = row[0]?.trim() || "-";
      const status = statusIdx > 0 ? (row[statusIdx] ?? "").trim() : "";
      const bits = row
        .map((cell, i) => ({ cell: cell.trim(), col: grid.columns[i] ?? "" }))
        .filter((x, i) => i > 0 && i !== statusIdx && x.cell)
        .map(({ cell, col }) => {
          const prefix = col in WHEEL_PREFIX ? WHEEL_PREFIX[col] : col.toLowerCase();
          return prefix ? `${prefix} ${cell}` : cell;
        });
      const statusHtml = status ? toneChip(status, statusTone(status)) : "";
      return `<div class="pdf-tc-card pdf-tc-wheel"><p class="pdf-tc-card__top"><span class="pdf-tc-wheel__name">${escapeHtml(name)}</span>${statusHtml}</p><p class="pdf-tc-wheel__vals">${escapeHtml(bits.join(" · "))}</p></div>`;
    })
    .join("");
  return `<div class="pdf-tc-wheels">${cards}</div>`;
}

/** 8. Aprīkojums: grupas ar čipu mākoņiem. */
function equipmentClouds(model: ThecarapiPdfModel): string {
  if (model.equipment.length === 0) return "";
  const groups = model.equipment
    .map(
      (g) =>
        `<div class="pdf-tc-eq__group"><p class="pdf-tc-fact__lab">${escapeHtml(g.group)}</p><ul class="pdf-incident-chips pdf-tc-eq__chips">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>`,
    )
    .join("");
  return `<div class="pdf-tc-eq">${groups}</div>`;
}

/** Viena izsole: galvene, galvenie fakti, sadaļas spec 3.1-3.11 secībā; tukšās izlaistas. */
export function renderThecarapiPdfModelHtml(model: ThecarapiPdfModel): string {
  const blocks: string[] = [`<p class="pdf-tc-head">${escapeHtml(model.header)}</p>`, keyTiles(model)];
  const section = (title: string, html: string, extra = ""): string =>
    html ? `<div class="pdf-tc-sec${extra ? ` ${extra}` : ""}">${subhead(title)}${html}</div>` : "";
  const push = (html: string): void => {
    if (html) blocks.push(html);
  };

  push(section("Pamatdati", factsGrid(model.basics)));
  const prices = section("Cenas", priceLadder(model.prices));
  const odo = section("Nobraukums", mileageList(model.mileage));
  if (prices && odo) push(`<div class="pdf-tc-row">${prices}${odo}</div>`);
  else push(prices || odo);
  push(section("Datumi", factsGrid(model.dates, true)));

  const damage: string[] = [];
  const n = damageCount(model);
  if (model.damages.length) {
    const total = model.damagesTotal ?? n;
    const badge = total != null ? `<p class="pdf-tc-total">${toneChip(`Kopā bojājumi: ${total}`, damageTone(total))}</p>` : "";
    damage.push(badge, damageCards(model));
  }
  if (model.paint.length) damage.push(minihead("Lakas biezums, µm"), paintGrid(model.paint));
  if (model.brakes) damage.push(minihead("Bremzes"), wheelCards(model.brakes));
  push(section("Bojājumi", damage.join("")));

  push(section("Aprīkojums", equipmentClouds(model)));

  push(section("Riepas un diski", model.wheels.map((set) => minihead(set.title) + wheelCards(set.grid)).join("")));

  const summaryChips = model.service.summary
    ? `<p class="pdf-tc-chips">${model.service.summary
        .split(" · ")
        .map((s) => chip(s.trim()))
        .join("")}</p>`
    : "";
  const docs = model.documents.length
    ? `<div class="pdf-tc-docs"><p class="pdf-tc-fact__lab">Dokumenti</p><p class="pdf-tc-chips">${model.documents.map((d) => chip(d)).join("")}</p></div>`
    : "";
  const service = [summaryChips, factsGrid(model.service.rows, true), gridTable(model.service.entries), docs].join("");
  push(section("Servisa vēsture", service));

  push(section("Citi dati", factsGrid(model.other, true)));
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
