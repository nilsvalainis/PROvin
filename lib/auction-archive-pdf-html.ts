/**
 * «Izsoļu arhīvs» PDF (Nils 23.11: variants C «katalogs», pievilkts PROVIN atskaišu kopējam dizainam).
 * Tās pašas PROVIN PDF klases kā «Oficiālā dīlera dati»: sadaļas kartīte ar `pdf-sec-head` (ikona aplī + virsraksts
 * lielajiem burtiem + skaita nozīmīte), vāks `pdf-dealer-cover`, skaitļu josla `pdf-svc-summary`, apakšvirsraksti
 * `pdf-subhead`, tie paši rādiusi/apmales/tipogrāfijas mērogs (`--pdf-*`).
 * Simetrija: viens 12 kolonnu režģis visā dokumentā (5/7 izsoles bilde + datu josla, 6/6 datu pāri, 4/4/4 galerija),
 * vienādas iekšējās atkāpes, etiķete/vērtība vienādos platumos, nekādu pus-tukšu rindu (nepāra pēdējā rinda stiepjas).
 * Katrs fakts vienreiz:
 *   1. Vāks - auto, VIN, 4 skaitļi. 2. Izsoļu hronoloģija - katrai izsolei liela bilde + datu josla vienā augstumā
 *      (bez bildēm - kompakta datu kartīte pilnā platumā). 3. Galvenie fakti. 4. Transportlīdzekļa dati.
 *   5. Katra izsole - izsoles dati, cenas (tikai ar «Rādīt izsoļu cenas»), stāvoklis un dokumenti, bojājumi, apraksts.
 *   6. Galerija 3 kolonnās (15 lapā). 7. Aprīkojums - pēdējā sadaļa.
 * Tīrs modulis - bildes nāk kā data: URI no servera; tulkojumi - `translations` karte (avota teksts → LV).
 */
import {
  auctionArchiveMaxKm,
  formatEurWhole,
  formatIsoDayLv,
  formatKm,
  lvCount,
  type AuctionArchiveAuction,
  type AuctionArchiveOperatorMark,
  type AuctionArchivePhoto,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import {
  auctionArchiveEquipment,
  auctionArchiveKeyFindings,
  auctionArchiveLotFacts,
  auctionArchiveModelTitle,
  auctionArchiveVehicleRows,
  auctionArchiveVersion,
  type ArchiveKv,
  type ArchiveLotFacts,
} from "@/lib/auction-archive-facts";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildPdfDocFooterHtml } from "@/lib/client-report-pdf-footer";
import { provincLogoSvg } from "@/lib/client-report-pdf-layout-draft";
import { buildPaintMapSvg, type PaintMapReading, type PaintMapSlot } from "@/lib/paint-map-svg";
import { buildPdfRunningFooterLine, buildPdfRunningHeaderLine, clientReportRunningPageCss } from "@/lib/pdf-running-page";
import { sectionIconPdfHtml, type SectionIconId } from "@/lib/section-icons";
import { buildThecarapiPdfModel, type ThecarapiPdfDamage } from "@/lib/thecarapi-pdf-model";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Kartīšu primitīvi (PROVIN PDF valoda) ---------- */

type CardOpts = { icon?: SectionIconId; num?: number; badge?: string; alert?: boolean };

/** Sadaļas galvene kā dīlera PDF: ikona (vai izsoles numurs) aplī + virsraksts + skaita nozīmīte. */
function secHead(title: string, opts: CardOpts = {}): string {
  const mark =
    opts.num != null
      ? `<span class="pdf-sec-ico-wrap aa-num" aria-hidden="true">${opts.num}</span>`
      : `<span class="pdf-sec-ico-wrap${opts.alert ? " aa-ico--alert" : ""}" aria-hidden="true">${sectionIconPdfHtml(opts.icon ?? "layers")}</span>`;
  return `<div class="pdf-sec-head pdf-sec-head--brand">${mark}<h2 class="pdf-sec pdf-sec--nobar">${esc(title)}</h2>${
    opts.badge ? `<span class="pdf-src-count-badge">${esc(opts.badge)}</span>` : ""
  }</div>`;
}

function card(title: string, body: string, opts: CardOpts = {}): string {
  if (!body) return "";
  return `<section class="aa-card">${secHead(title, opts)}${body}</section>`;
}

function subhead(title: string): string {
  return `<p class="pdf-subhead">${esc(title)}</p>`;
}

/** Datu pāri: etiķete/vērtība vienādos platumos. 2 kolonnās nepāra pēdējā rinda stiepjas pa visu platumu. */
function kvGrid(rows: readonly ArchiveKv[], cols: 1 | 2 = 2): string {
  if (rows.length === 0) return "";
  const wideLast = cols === 2 && rows.length % 2 === 1;
  return `<dl class="aa-kv aa-kv--${cols}">${rows
    .map(
      (r, i) =>
        `<div class="aa-kv__row${wideLast && i === rows.length - 1 ? " aa-kv__row--wide" : ""}"><dt>${esc(r.k)}</dt><dd${
          r.missing || r.alert ? ' class="aa-red"' : ""
        }>${esc(r.v)}</dd></div>`,
    )
    .join("")}</dl>`;
}

/* ---------- Bojājumu shēma ---------- */

/** Latviskā zona/detaļa (no `ThecarapiPdfDamage`) → vieta IRISS virsbūves shēmā. */
export function damageSlotLv(zone: string, part: string): PaintMapSlot | null {
  const z = zone.toLowerCase();
  const p = part.toLowerCase();
  const rear = /aizmug/.test(p);
  if (/jumt/.test(z)) return { zone: "roof", slot: 0 };
  if (/priekš/.test(z)) return /pārseg|motora|kapot/.test(p) ? { zone: "front", slot: 0 } : { zone: "front", slot: 1 };
  if (/aizmug/.test(z)) return /bagāžn|vāk|durv|pārseg/.test(p) ? { zone: "rear", slot: 0 } : { zone: "rear", slot: 1 };
  const side = /kreis/.test(z) ? "left" : /lab/.test(z) ? "right" : null;
  if (!side) return null;
  if (/spārn/.test(p)) return { zone: side, slot: rear ? 3 : 0 };
  if (/durv/.test(p)) return { zone: side, slot: rear ? 2 : 1 };
  if (/panel|sān/.test(p)) return { zone: side, slot: 3 };
  return { zone: side, slot: 1 };
}

const ZONE_LABEL: Record<string, string> = {
  front: "Priekšpuse",
  rear: "Aizmugure",
  left: "Kreisā puse",
  right: "Labā puse",
  roof: "Jumts",
};

/** Bojājumu bloks izsoles kartītē: shēma (6/12) + saraksts (6/12). Bez bojājumiem un atzīmēm - tukšs. */
export function auctionArchiveDamageBlockHtml(
  damages: readonly ThecarapiPdfDamage[],
  marks: readonly AuctionArchiveOperatorMark[],
): string {
  if (damages.length === 0 && marks.length === 0) return "";
  const counts = new Map<string, { slot: PaintMapSlot; n: number }>();
  for (const d of damages) {
    const slot = damageSlotLv(d.zone, d.part);
    if (!slot) continue;
    const key = `${slot.zone}:${slot.slot}`;
    const n = Number.parseInt(d.quantity, 10);
    const cur = counts.get(key) ?? { slot, n: 0 };
    cur.n += Number.isFinite(n) && n > 0 ? n : 1;
    counts.set(key, cur);
  }
  for (const m of marks) {
    const slot = damageSlotLv(ZONE_LABEL[m.zone] ?? m.zone, m.part ?? "");
    if (!slot) continue;
    const key = `${slot.zone}:${slot.slot}`;
    if (!counts.has(key)) counts.set(key, { slot, n: 0 });
  }
  const readings: PaintMapReading[] = [...counts.values()].map((c) => ({
    slot: c.slot,
    text: c.n > 0 ? `${c.n} bojāj.` : "Redzams bildē",
    tone: c.n > 0 ? "alert" : "warn",
  }));
  const svg = readings.length ? `<div class="aa-scheme">${buildPaintMapSvg(readings)}</div>` : "";
  const rows = [
    ...damages.map(
      (d) =>
        `<li><b>${esc([d.zone, d.part].filter(Boolean).join(", ") || "Virsbūve")}</b><span>${esc(
          [d.type, d.size, Number.parseInt(d.quantity, 10) > 1 ? `${d.quantity} gab.` : "", d.repair, d.notes].filter(Boolean).join(" · "),
        )}</span></li>`,
    ),
    ...marks.map(
      (m) =>
        `<li class="aa-dmg--seen"><b>${esc([ZONE_LABEL[m.zone] ?? m.zone, m.part ?? ""].filter(Boolean).join(", "))}</b><span>Redzams bildē (PROVIN atzīme)${
          m.note ? ` · ${esc(m.note)}` : ""
        }</span></li>`,
    ),
  ].join("");
  const count = damages.length ? ` · ${lvCount(damages.length, "bojājums", "bojājumi")}` : "";
  return `<div class="aa-block aa-block--alert">${subhead(`Bojājumi${count}`)}<div class="aa-dmg${svg ? "" : " aa-dmg--list"}">${svg}<ul class="aa-dmg__list">${rows}</ul></div></div>`;
}

/* ---------- Apraksts ---------- */

const DESC_KEY = /(^|[._])(description|comments?|remarks?|condition_?(text|report)|notes?|seller_?comments?|damage_?description)$/i;

/** Izsoles brīvā teksta apraksti (ne virsraksti, ne atskaišu nosaukumi). */
export function auctionArchiveDescriptions(r: ThecarapiAdminRecord): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of r.fields) {
    const v = f.value.replace(/\s+/g, " ").trim();
    if (!DESC_KEY.test(f.key) || v.length < 12 || v.length > 2000 || /^https?:\/\//.test(v) || !/\p{L}{3}/u.test(v)) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= 6) break;
  }
  return out;
}

function descriptionBlock(texts: readonly string[], translations: ReadonlyMap<string, string>): string {
  if (texts.length === 0) return "";
  const items = texts
    .map((t) => {
      const lv = translations.get(t)?.trim() ?? "";
      const same = !lv || lv.toLowerCase() === t.toLowerCase();
      return `<div class="aa-desc">${
        same ? `<p class="aa-desc__lv">${esc(t)}</p>` : `<p class="aa-desc__lv">${esc(lv)}</p><p class="aa-desc__orig"><span>(oriģināls)</span> ${esc(t)}</p>`
      }</div>`;
    })
    .join("");
  return `<div class="aa-block">${subhead("Izsoles apraksts")}${items}</div>`;
}

/* ---------- Galerija ---------- */

/** 3 kolonnas × 5 rindas - viena A4 lapa bez pārgriešanas. */
export const AUCTION_ARCHIVE_PHOTOS_PER_PAGE = 15;

/**
 * Stingrs režģis bez pus-tukšām rindām: lapā `n` bildes pa 3 rindā; ja pēdējā rindā paliktu 2 - tās ir pusplatuma,
 * ja 1 - pēdējās četras ir 2 + 2 pusplatumā; viena pati bilde - pilnā platumā. Atgriež katras bildes platumu (12 kolonnās).
 */
export function auctionArchiveGallerySpans(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [12];
  const spans = Array.from({ length: n }, () => 4);
  const rem = n % 3;
  if (rem === 2) spans.splice(n - 2, 2, 6, 6);
  else if (rem === 1) spans.splice(n - 4, 4, 6, 6, 6, 6);
  return spans;
}

/** Paraksts bez dublikātiem: avota paraksts tikai, ja tas nav «portāls · datums». */
function photoNote(p: AuctionArchivePhoto, platform: string): string {
  const c = (p.caption ?? "").replace(/^TheCarApi\s*·\s*/i, "").trim();
  if (!c) return "";
  return c
    .split(/\s*·\s*/)
    .filter((x) => x && x.toLowerCase() !== platform.toLowerCase() && !/^\d{4}-\d{2}-\d{2}$/.test(x) && !/^\d{2}\.\d{2}\.\d{4}$/.test(x))
    .join(" · ");
}

function galleryHtml(
  title: string,
  platform: string,
  photos: readonly AuctionArchivePhoto[],
  dataUrls: ReadonlyMap<string, string>,
  num?: number,
): string {
  const list = photos.filter((p) => dataUrls.get(p.id));
  if (list.length === 0) return "";
  const pages: string[] = [];
  const pageCount = Math.ceil(list.length / AUCTION_ARCHIVE_PHOTOS_PER_PAGE);
  for (let i = 0; i < list.length; i += AUCTION_ARCHIVE_PHOTOS_PER_PAGE) {
    const chunk = list.slice(i, i + AUCTION_ARCHIVE_PHOTOS_PER_PAGE);
    const spans = auctionArchiveGallerySpans(chunk.length);
    const pageNo = i / AUCTION_ARCHIVE_PHOTOS_PER_PAGE + 1;
    const figs = chunk
      .map((p, j) => {
        const date = formatIsoDayLv(p.date) || p.date;
        const note = photoNote(p, platform);
        return `<figure class="aa-fig aa-fig--${spans[j]}"><img src="${dataUrls.get(p.id)!}" alt=""/><figcaption><b>${i + j + 1}/${list.length}</b><span>${esc(
          [note, date, platform].filter(Boolean).join(" · "),
        )}</span></figcaption></figure>`;
      })
      .join("");
    const badge = `${lvCount(list.length, "bilde", "bildes")}${pageCount > 1 ? ` · ${pageNo}/${pageCount}` : ""}`;
    pages.push(`<section class="aa-gallery">${secHead(title, num != null ? { num, badge } : { icon: "camera", badge })}<div class="aa-grid">${figs}</div></section>`);
  }
  return pages.join("\n");
}

/* ---------- Dokuments ---------- */

export type AuctionArchivePdfInput = {
  summary: AuctionArchiveSummary;
  records: readonly ThecarapiAdminRecord[];
  photos: readonly AuctionArchivePhoto[];
  dataUrls: ReadonlyMap<string, string>;
  /** Avota teksts → latviski (apraksti un nezināmi aprīkojuma nosaukumi). */
  translations?: ReadonlyMap<string, string>;
  marks?: readonly AuctionArchiveOperatorMark[];
  generatedAt?: Date;
  /** «Sagatavots klientam: …» kājenē (vārds, ja ir). */
  preparedFor?: string;
  /** «Rādīt izsoļu cenas» (Nils 23.11, lēmums 4): noklusējumā cenas PDF NErāda. */
  showPrices?: boolean;
};

function recordKey(r: ThecarapiAdminRecord): string {
  return `${(r.site || "thecarapi").toLowerCase()}:${r.id}`.slice(0, 120);
}

const DT = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fmtDateTime(d: Date): string {
  const p = Object.fromEntries(DT.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Dokumenta nosaukums vākā, galvenē un kolofonā (kā «OFICIĀLĀ DĪLERA DATI»). */
export const AUCTION_ARCHIVE_PDF_TITLE = "IZSOĻU ARHĪVS";

/**
 * Režģis: 12 kolonnas, sprauga 12px. Kartītes atkāpes un rādiusi - PROVIN PDF mainīgie (`--pdf-pad-outer`,
 * `--pdf-radius-outer/inner`, `--pdf-line`). Bez ēnām un krāsainām malām (Nila gaume).
 */
const ARCHIVE_CSS = `
.provin-report-doc{--aa-ink:#0f172a;--aa-mute:#64748b;--aa-red:#B91C1C;--aa-gap:12px}
.aa-card{border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-outer);background:#fff;padding:var(--pdf-pad-outer);margin:0 0 var(--aa-gap);break-inside:avoid;page-break-inside:avoid}
.aa-card .pdf-sec-head--brand{margin:0 0 12px;padding-bottom:10px}
.aa-card > :last-child{margin-bottom:0}
.aa-num{font:700 12px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}
.aa-ico--alert{color:var(--aa-red)!important;background:rgba(185,28,28,.08)!important}
.aa-ico--alert .pdf-ico{color:var(--aa-red)!important}
.aa-red{color:var(--aa-red)!important}
.aa-card .pdf-subhead{margin:0 0 4px}
.aa-card .pdf-dealer-cover__model{margin-top:4px}
.aa-card .pdf-dealer-cover__meta b{color:var(--aa-ink);font-weight:650;letter-spacing:.02em}
.aa-card .pdf-svc-summary{margin:var(--aa-gap) 0 0;padding:10px 0;gap:0}
.aa-card .pdf-svc-summary__cell{padding:0 14px;border-left:1px solid var(--pdf-line)}
.aa-card .pdf-svc-summary__cell:first-child{border-left:none}
.aa-card .pdf-svc-summary__cell b{font-size:13px;font-variant-numeric:tabular-nums}
.aa-cat{display:grid;gap:var(--aa-gap)}
.aa-cat__item{display:grid;grid-template-columns:5fr 7fr;gap:var(--aa-gap);align-items:stretch;break-inside:avoid;page-break-inside:avoid}
.aa-cat__img{display:block;width:100%;height:46mm;object-fit:cover;border-radius:var(--pdf-radius-inner);background:var(--pdf-line-soft)}
.aa-cat__panel{display:flex;flex-direction:column;justify-content:space-between;height:46mm;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);padding:12px 14px;background:#FCFDFF}
.aa-cat__item--plain{border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);padding:12px 14px;background:#FCFDFF;align-items:end}
.aa-cat__item--plain .aa-cat__cells{padding-left:calc(30px * 5 / 12)}
.aa-cat__n{margin:0;font:600 var(--pdf-fs-label)/1.3 Inter,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#86868b}
.aa-cat__date{margin:3px 0 0;font:750 18px/1.15 Inter,sans-serif;letter-spacing:-.02em;color:var(--aa-ink);font-variant-numeric:tabular-nums}
.aa-cat__where{margin:3px 0 0;font:500 var(--pdf-fs-base)/1.3 Inter,sans-serif;color:#475569}
.aa-cat__where b{font-weight:650;color:var(--aa-ink)}
.aa-cat__cells{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0;margin:0}
.aa-cat__cells div{padding:0 12px;border-left:1px solid var(--pdf-line)}
.aa-cat__cells div:first-child{padding-left:0;border-left:none}
.aa-cat__cells dt{font:600 9px/1.3 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--aa-mute)}
.aa-cat__cells dd{margin:2px 0 0;font:750 12px/1.3 Inter,sans-serif;color:var(--aa-ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.aa-findings{margin:0;padding:0;list-style:none}
.aa-findings li{position:relative;padding:5px 0 5px 14px;border-bottom:1px solid var(--pdf-line-soft);font:500 var(--pdf-fs-table)/1.45 Inter,sans-serif;color:#1e293b}
.aa-findings li:last-child{border-bottom:none;padding-bottom:0}
.aa-findings li:first-child{padding-top:0}
.aa-findings li::before{content:"";position:absolute;left:2px;top:11px;width:5px;height:5px;border-radius:50%;background:#94A3B8}
.aa-findings li:first-child::before{top:6px}
.aa-findings li.aa-red::before{background:var(--aa-red)}
.aa-kv{display:grid;gap:0 24px;margin:0}
.aa-kv--2{grid-template-columns:1fr 1fr}.aa-kv--1{grid-template-columns:1fr}
.aa-kv__row{display:grid;grid-template-columns:44% 1fr;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--pdf-line-soft);break-inside:avoid}
.aa-kv__row--wide{grid-column:1 / -1;grid-template-columns:calc((100% - 24px) * .22) 1fr}
.aa-kv__row dt{font:500 var(--pdf-fs-table)/1.45 Inter,sans-serif;color:#86868b}
.aa-kv__row dd{margin:0;font:550 var(--pdf-fs-table)/1.45 Inter,sans-serif;color:var(--aa-ink)}
.aa-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;align-items:start}
.aa-cols > div > .pdf-subhead + .aa-kv + .pdf-subhead{margin-top:14px}
.aa-block{margin-top:14px}
.aa-card > .pdf-sec-head + .aa-block{margin-top:0}
.aa-dmg{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;align-items:center}
.aa-dmg--list{grid-template-columns:1fr}
.aa-scheme svg{display:block;width:100%;height:auto}
.aa-dmg__list{margin:0;padding:0;list-style:none}
.aa-dmg__list li{display:grid;gap:1px;padding:5px 0;border-bottom:1px solid var(--pdf-line-soft);font:500 var(--pdf-fs-table)/1.4 Inter,sans-serif}
.aa-dmg__list b{color:var(--aa-red);font-weight:650}.aa-dmg__list span{color:#334155}
.aa-dmg__list .aa-dmg--seen b{color:#B45309}
.aa-desc{margin:0 0 6px}.aa-desc__lv{margin:0;font:500 var(--pdf-fs-table)/1.5 Inter,sans-serif;color:var(--aa-ink)}
.aa-desc__orig{margin:3px 0 0;font:400 var(--pdf-fs-fine)/1.45 Inter,sans-serif;color:#94a3b8}.aa-desc__orig span{font-weight:600}
.aa-gallery{break-before:page;page-break-before:always}
.aa-gallery .pdf-sec-head--brand{margin:0 0 10px;padding-bottom:8px}
.aa-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:8px var(--aa-gap)}
.aa-fig{margin:0;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.aa-fig--4{grid-column:span 4}.aa-fig--6{grid-column:span 6}.aa-fig--12{grid-column:span 12}
.aa-fig img{display:block;width:100%;height:39mm;object-fit:cover;background:var(--pdf-line-soft)}
.aa-fig--12 img{height:78mm}
.aa-fig figcaption{display:flex;justify-content:space-between;gap:6px;align-items:baseline;padding:4px 8px 5px;font:500 8px/1.3 Inter,sans-serif;color:var(--aa-mute)}
.aa-fig figcaption b{color:var(--aa-ink);font-weight:700;font-variant-numeric:tabular-nums}
.aa-tail{margin-top:var(--aa-gap)}
.aa-equip{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
.aa-equip__g--wide{grid-column:1 / -1}
.aa-equip__g .pdf-subhead{margin:0 0 6px}
.aa-chips{display:flex;flex-wrap:wrap;gap:5px}
.aa-chip{display:inline-block;padding:3px 9px;border:1px solid var(--pdf-line);border-radius:999px;background:#fff;font:500 var(--pdf-fs-label)/1.3 Inter,sans-serif;color:#1e293b}
.aa-sources{margin:0;padding:0 0 0 14px;font:500 var(--pdf-fs-table) Inter,sans-serif;color:#334155}
.aa-foot{font:500 var(--pdf-fs-fine)/1.5 Inter,sans-serif;color:var(--aa-mute);margin:10px 0 0}
`;

type Lot = {
  key: string;
  n: number;
  record: ThecarapiAdminRecord;
  auction: AuctionArchiveAuction | undefined;
  platform: string;
  date: string;
  km: number | null;
  facts: ArchiveLotFacts;
  damages: ThecarapiPdfDamage[];
  photos: AuctionArchivePhoto[];
};

export function buildAuctionArchivePdfHtml(input: AuctionArchivePdfInput): string {
  const s = input.summary;
  const showPrices = input.showPrices === true;
  const now = input.generatedAt ?? new Date();
  const translations = input.translations ?? new Map<string, string>();
  const marks = input.marks ?? [];
  const byKey = new Map(s.auctions.map((a) => [a.key, a]));
  const records = [...input.records].sort((a, b) =>
    (byKey.get(recordKey(a))?.date || "9999").localeCompare(byKey.get(recordKey(b))?.date || "9999"),
  );

  const lots: Lot[] = records.map((r, i) => {
    const key = recordKey(r);
    const a = byKey.get(key);
    let damages: ThecarapiPdfDamage[] = [];
    try {
      damages = buildThecarapiPdfModel(r).damages;
    } catch {
      damages = [];
    }
    return {
      key,
      n: i + 1,
      record: r,
      auction: a,
      platform: a?.platform || r.venue || r.site || "Izsole",
      date: a?.date || r.date || "",
      km: a?.km ?? null,
      facts: auctionArchiveLotFacts(r, { showPrices }),
      damages,
      photos: input.photos.filter((p) => p.auctionKey === key && input.dataUrls.has(p.id)),
    };
  });

  const title = auctionArchiveModelTitle(records, s.title || s.vin);
  const version = auctionArchiveVersion(records);
  const lastDate = [...s.auctions].reverse().find((a) => a.date)?.date ?? "";
  const km = auctionArchiveMaxKm(s);
  const photoTotal = input.photos.filter((p) => input.dataUrls.has(p.id)).length || input.photos.length || s.photoCount;

  /* --- 1. Vāks --- */
  const hero = `<header class="pdf-v1-hero"><div class="pdf-v1-hero-inner">${provincLogoSvg({ includeLvSuffix: true })}<div class="pdf-v1-hero-text"><h1 class="pdf-v1-doc-title">${esc(
    AUCTION_ARCHIVE_PDF_TITLE,
  )}</h1><p class="pdf-v1-meta">Ģenerēts: ${esc(fmtDateTime(now))} · VIN <span class="pdf-vin">${esc(s.vin)}</span></p></div></div></header>`;
  const stats = [
    { k: "Izsoles", v: String(s.auctions.length) },
    { k: "Bildes", v: String(photoTotal) },
    { k: "Pēdējā izsole", v: formatIsoDayLv(lastDate) || "-" },
    { k: "Nobraukums", v: km != null ? formatKm(km) : "-" },
  ];
  const cover = card(
    AUCTION_ARCHIVE_PDF_TITLE,
    `<div class="pdf-dealer-cover"><p class="pdf-dealer-cover__kicker">Eiropas izsoļu arhīvs</p><h3 class="pdf-dealer-cover__model">${esc(
      title,
    )}</h3><p class="pdf-dealer-cover__meta">${version ? `${esc(version)} · ` : ""}VIN <b class="pdf-vin">${esc(s.vin)}</b></p></div>
<div class="pdf-svc-summary">${stats.map((x) => `<div class="pdf-svc-summary__cell"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join("")}</div>`,
    { icon: "globe", badge: s.auctions.length ? lvCount(s.auctions.length, "izsole", "izsoles") : undefined },
  );

  /* --- 2. Hronoloģija («katalogs») --- */
  const catalog = lots
    .map((l) => {
      const cells: [string, string][] = [
        ["Nobraukums", formatKm(l.km) || "-"],
        ["Bildes", l.photos.length ? String(l.photos.length) : "nav"],
      ];
      if (showPrices && l.auction?.priceEur != null) cells.push(["Cena", formatEurWhole(l.auction.priceEur)]);
      if (l.facts.lotNo) cells.push(["Izsoles Nr.", l.facts.lotNo]);
      const country = l.facts.country || l.auction?.country || "";
      const headTxt = `<div class="aa-cat__head"><p class="aa-cat__n">${l.n}. izsole</p><p class="aa-cat__date">${esc(
        formatIsoDayLv(l.date) || "Datums nav zināms",
      )}</p><p class="aa-cat__where"><b>${esc(l.platform)}</b>${country ? ` · ${esc(country)}` : ""}</p></div>`;
      const cellsHtml = `<dl class="aa-cat__cells">${cells.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
      const coverPhoto = l.photos[0];
      // Bez bildēm - kompakta datu kartīte pilnā platumā (tas pats 5/7 režģis, lai šūnas sakrīt ar pārējām izsolēm).
      if (!coverPhoto) return `<article class="aa-cat__item aa-cat__item--plain">${headTxt}${cellsHtml}</article>`;
      return `<article class="aa-cat__item"><img class="aa-cat__img" src="${input.dataUrls.get(coverPhoto.id)!}" alt=""/><div class="aa-cat__panel">${headTxt}${cellsHtml}</div></article>`;
    })
    .join("");
  const timeline = lots.length ? card("Izsoļu hronoloģija", `<div class="aa-cat">${catalog}</div>`, { icon: "history" }) : "";

  /* --- 3. Galvenie fakti --- */
  const findings = auctionArchiveKeyFindings(
    lots.map((l) => ({
      platform: l.platform,
      date: l.date,
      km: l.km,
      facts: l.facts,
      damageCount: l.damages.length + marks.filter((m) => m.auctionKey === l.key).length,
    })),
  );
  const findingsHtml = findings.length
    ? card("Galvenie fakti", `<ul class="aa-findings">${findings.map((f) => `<li${f.alert ? ' class="aa-red"' : ""}>${esc(f.text)}</li>`).join("")}</ul>`, {
        icon: "listChecks",
      })
    : "";

  /* --- 4. Transportlīdzeklis --- */
  const vehicle = records.length ? card("Transportlīdzekļa dati", kvGrid(auctionArchiveVehicleRows(records)), { icon: "car" }) : "";
  const sources = s.manualSources.length
    ? card("Citi avoti", `<ul class="aa-sources">${s.manualSources.map((m) => `<li>${esc(m.label)}${m.kind === "pdf" ? " (PDF)" : ""}</li>`).join("")}</ul>`, {
        icon: "search",
      })
    : "";

  /* --- 5. Izsoles --- */
  const lotHtml = lots.map((l) => {
    const badge = [formatIsoDayLv(l.date), l.facts.country].filter(Boolean).join(" · ");
    // Izsoles Nr. ir hronoloģijā - šeit neatkārto.
    const sale = l.facts.sale.filter((r) => r.k !== "Izsoles Nr.");
    const left = [
      sale.length ? subhead("Izsoles dati") + kvGrid(sale, 1) : "",
      showPrices && l.facts.prices.length ? subhead("Cenas (avota dati)") + kvGrid(l.facts.prices, 1) : "",
    ].join("");
    const right = l.facts.condition.length ? subhead("Stāvoklis un dokumenti") + kvGrid(l.facts.condition, 1) : "";
    const cols = left && right ? `<div class="aa-cols"><div>${left}</div><div>${right}</div></div>` : left || right ? `<div>${left}${right}</div>` : "";
    const dmg = auctionArchiveDamageBlockHtml(l.damages, marks.filter((m) => m.auctionKey === l.key));
    const desc = descriptionBlock(auctionArchiveDescriptions(l.record), translations);
    return card(`${l.platform} izsole`, `${cols}${dmg}${desc}`, { num: l.n, badge });
  });

  /* --- 6. Galerijas --- */
  const galleries = lots.map((l) => galleryHtml(`Bildes · ${l.platform}`, l.platform, l.photos, input.dataUrls, l.n)).join("\n");
  const knownKeys = new Set(lots.map((l) => l.key));
  const manualPhotos = input.photos.filter((p) => !knownKeys.has(p.auctionKey));
  const manual = galleryHtml("Bildes · citi izsoļu avoti", "", manualPhotos, input.dataUrls);

  /* --- 7. Aprīkojums (Nils 23.11: pēdējā sadaļa) --- */
  const equipment = auctionArchiveEquipment(records, translations);
  const eqGroups = equipment.groups;
  const equipHtml = eqGroups.length
    ? `<div class="aa-tail">${card(
        "Aprīkojums",
        `<div class="aa-equip">${eqGroups
          .map(
            (g, i) =>
              `<div class="aa-equip__g${eqGroups.length % 2 === 1 && i === eqGroups.length - 1 ? " aa-equip__g--wide" : ""}">${subhead(g.group)}<div class="aa-chips">${g.items
                .map((x) => `<span class="aa-chip">${esc(x)}</span>`)
                .join("")}</div></div>`,
          )
          .join("")}</div>`,
        { icon: "layers", badge: "pēc izsoļu datiem" },
      )}</div>`
    : "";

  const header = buildPdfRunningHeaderLine(title, s.vin, `PROVIN.LV · ${AUCTION_ARCHIVE_PDF_TITLE}`);
  const footer = buildPdfRunningFooterLine({ vin: s.vin, dateLabel: fmtDateTime(now), preparedBy: input.preparedFor ?? "" });
  const css = `${getClientReportPrintCss()}${clientReportRunningPageCss({ header, footer, lang: "lv" })}${ARCHIVE_CSS}`;
  const note = `<p class="aa-foot">Dati no Eiropas izsoļu portālu arhīva izsoles dienā. Bildes, ${
    showPrices ? "cenas, " : ""
  }nobraukums un apraksti ir avota dati; tulkojums un apkopojums - PROVIN.${
    marks.length ? " «Redzams bildē» - PROVIN atzīme pēc bildes." : ""
  }</p>`;
  const foot = `${buildPdfDocFooterHtml({
    vin: s.vin,
    amountTotalCents: null,
    generatedLabel: `Ģenerēts ${fmtDateTime(now)}`,
    productLabel: AUCTION_ARCHIVE_PDF_TITLE,
  })}${note}`;
  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><meta name="color-scheme" content="light"/><title>${esc(
    `Izsolu_arhivs_${s.vin}.pdf`,
  )}</title><style>${css}</style></head><body class="provin-report-doc"><div class="sheet">${hero}${cover}${timeline}${findingsHtml}${vehicle}${sources}${lotHtml.join(
    "\n",
  )}${galleries}${manual}${equipHtml}${foot}</div>${FONT_READY_SCRIPT}</body></html>`;
}

/** Servera renderis gaida `data-provin-fonts="ready"` (kā klienta atskaitē). */
const FONT_READY_SCRIPT = `<script>(function(){function done(){document.documentElement.setAttribute("data-provin-fonts","ready")}if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load("400 12px Inter"),document.fonts.load("700 12px Inter")]).then(done,done)}else done()})();</script>`;

/** Teksti, kas jātulko pirms PDF: apraksti + aprīkojums, ko vārdnīca nezina. */
export function auctionArchiveTextsToTranslate(records: readonly ThecarapiAdminRecord[]): string[] {
  return [...new Set([...records.flatMap(auctionArchiveDescriptions), ...auctionArchiveEquipment(records).untranslated])];
}

export function auctionArchivePdfFilename(vin: string): string {
  // Nils 23.11: viens nosaukums visur (piedāvājuma PDF un atsevišķais pakalpojums).
  const v = vin.replace(/[^A-Za-z0-9]/g, "").slice(0, 17).toUpperCase() || "VIN";
  return `IZSOLU_ARHIVS_${v}.pdf`;
}
