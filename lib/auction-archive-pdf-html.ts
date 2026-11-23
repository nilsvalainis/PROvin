/**
 * «Izsoļu arhīvs» PDF v2 (Nils 23.11: «ļoti zaļš, slikti noformēts, neiztulkots, dati dublējas, vairāk kartītes»).
 * PROVIN PDF valoda kā «Oficiālā dīlera dati»: Inter, baltas kartītes ar apmali un vieglu ēnu, PROVIN zils akcentiem,
 * sarkans tikai bojājumiem / trūkstošiem svarīgiem datiem. Katrs fakts vienreiz:
 *   1. Vāks - auto, VIN, 4 skaitļu kartītes, izsoļu hronoloģija (kartīšu laika līnija), galvenie fakti.
 *   2. Transportlīdzekļa dati + aprīkojums (apvienots no visām izsolēm, tulkots, bez sīkumiem).
 *   3. Katra izsole - izsoles dati, stāvoklis un dokumenti, cenas (tikai ar «Rādīt izsoļu cenas»), bojājumi
 *      (shēma + saraksts), apraksts latviski (oriģināls mazāk).
 *   4. Bilžu galerija - 3 kolonnas, 15 lapā, paraksta josla (nr., datums, portāls); kartītes netiek pārgrieztas.
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
import { buildThecarapiPdfModel, type ThecarapiPdfDamage } from "@/lib/thecarapi-pdf-model";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Kartīšu primitīvi ---------- */

function card(title: string, body: string, opts: { cls?: string; aside?: string } = {}): string {
  if (!body) return "";
  return `<section class="aa-card${opts.cls ? ` ${opts.cls}` : ""}"><h3 class="aa-card__title"><span>${esc(title)}</span>${
    opts.aside ? `<em>${esc(opts.aside)}</em>` : ""
  }</h3>${body}</section>`;
}

function kvGrid(rows: readonly ArchiveKv[], cols: 1 | 2 = 2): string {
  if (rows.length === 0) return "";
  return `<dl class="aa-kv aa-kv--${cols}">${rows
    .map((r) => `<div class="aa-kv__row"><dt>${esc(r.k)}</dt><dd${r.missing || r.alert ? ' class="aa-red"' : ""}>${esc(r.v)}</dd></div>`)
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

/** Bojājumu kartīte: shēma + saraksts. Bez bojājumiem un atzīmēm - tukšs (stāvokli rāda stāvokļa kartīte). */
export function auctionArchiveDamageCardHtml(
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
  const aside = damages.length ? lvCount(damages.length, "bojājums", "bojājumi") : "";
  return card("Bojājumi", `<div class="aa-dmg">${svg}<ul class="aa-dmg__list">${rows}</ul></div>`, { cls: "aa-card--alert", aside });
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

function descriptionCard(texts: readonly string[], translations: ReadonlyMap<string, string>): string {
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
  return card("Izsoles apraksts", items);
}

/* ---------- Galerija ---------- */

/** 3 kolonnas × 5 rindas - viena A4 lapa bez pārgriešanas. */
export const AUCTION_ARCHIVE_PHOTOS_PER_PAGE = 15;

/** Paraksts bez dublikātiem: avota paraksts tikai, ja tas nav «portāls · datums». */
function photoNote(p: AuctionArchivePhoto, platform: string): string {
  const c = (p.caption ?? "").replace(/^TheCarApi\s*·\s*/i, "").trim();
  if (!c) return "";
  return c
    .split(/\s*·\s*/)
    .filter((x) => x && x.toLowerCase() !== platform.toLowerCase() && !/^\d{4}-\d{2}-\d{2}$/.test(x) && !/^\d{2}\.\d{2}\.\d{4}$/.test(x))
    .join(" · ");
}

function galleryHtml(title: string, platform: string, photos: readonly AuctionArchivePhoto[], dataUrls: ReadonlyMap<string, string>): string {
  const list = photos.filter((p) => dataUrls.get(p.id));
  if (list.length === 0) return "";
  const pages: string[] = [];
  const pageCount = Math.ceil(list.length / AUCTION_ARCHIVE_PHOTOS_PER_PAGE);
  for (let i = 0; i < list.length; i += AUCTION_ARCHIVE_PHOTOS_PER_PAGE) {
    const chunk = list.slice(i, i + AUCTION_ARCHIVE_PHOTOS_PER_PAGE);
    const pageNo = i / AUCTION_ARCHIVE_PHOTOS_PER_PAGE + 1;
    const figs = chunk
      .map((p, j) => {
        const date = formatIsoDayLv(p.date) || p.date;
        const note = photoNote(p, platform);
        return `<figure class="aa-fig"><img src="${dataUrls.get(p.id)!}" alt=""/><figcaption><b>${i + j + 1}/${list.length}</b><span>${esc(
          [note, date, platform].filter(Boolean).join(" · "),
        )}</span></figcaption></figure>`;
      })
      .join("");
    pages.push(
      `<section class="aa-gallery"><div class="aa-gallery__head"><h3>${esc(title)}</h3><span>${esc(lvCount(list.length, "bilde", "bildes"))}${
        pageCount > 1 ? ` · ${pageNo}/${pageCount}. lapa` : ""
      }</span></div><div class="aa-grid">${figs}</div></section>`,
    );
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

const ARCHIVE_CSS = `
.provin-report-doc{--aa-blue:#0061D2;--aa-ink:#0f172a;--aa-mute:#64748b;--aa-line:#E9EDF3;--aa-red:#B91C1C}
.aa-card{border:1px solid var(--aa-line);border-radius:12px;background:#fff;padding:12px 14px;margin:0 0 9px;break-inside:avoid;page-break-inside:avoid}
.aa-card__title{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 9px;font:700 9px/1.2 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#475569}
.aa-card__title span{display:flex;align-items:center;gap:7px}
.aa-card__title span::before{content:"";display:inline-block;width:3px;height:10px;border-radius:2px;background:var(--aa-blue)}
.aa-card__title em{font-style:normal;font-weight:600;letter-spacing:.02em;text-transform:none;color:var(--aa-mute);font-size:9.5px}
.aa-card--alert .aa-card__title span::before{background:var(--aa-red)}
.aa-red{color:var(--aa-red)!important;font-weight:650}
.aa-hero{border:1px solid var(--aa-line);border-radius:12px;padding:16px 18px;margin:0 0 9px;background:linear-gradient(180deg,#EEF5FF 0%,#fff 78%);break-inside:avoid}
.aa-hero__kicker{margin:0;font:700 9px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--aa-blue)}
.aa-hero__model{margin:4px 0 0;font:800 21px/1.15 Inter,sans-serif;color:var(--aa-ink)}
.aa-hero__ver{margin:3px 0 0;font:500 11.5px Inter,sans-serif;color:#334155}
.aa-hero__vin{margin:8px 0 0;font:600 10.5px Inter,sans-serif;color:var(--aa-mute);letter-spacing:.04em}
.aa-hero__vin b{color:var(--aa-ink)}
.aa-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 0 9px}
.aa-stat{border:1px solid var(--aa-line);border-radius:10px;background:#fff;padding:9px 11px}
.aa-stat span{display:block;font:600 8.5px Inter,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--aa-mute)}
.aa-stat b{display:block;margin-top:3px;font:750 15px Inter,sans-serif;color:var(--aa-ink);font-variant-numeric:tabular-nums}
.aa-timeline{display:grid;gap:7px}
.aa-timeline--1{grid-template-columns:1fr}.aa-timeline--2{grid-template-columns:1fr 1fr}.aa-timeline--3{grid-template-columns:1fr 1fr 1fr}
.aa-tl{position:relative;border:1px solid var(--aa-line);border-top:3px solid var(--aa-blue);border-radius:10px;padding:9px 11px 10px;background:#FAFCFF;break-inside:avoid}
.aa-tl__n{position:absolute;top:8px;right:10px;font:700 8.5px Inter,sans-serif;color:var(--aa-mute)}
.aa-tl__date{margin:0;font:750 13px Inter,sans-serif;color:var(--aa-ink)}
.aa-tl__where{margin:1px 0 7px;font:600 10.5px Inter,sans-serif;color:var(--aa-blue)}
.aa-tl__facts{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;font:500 9.5px Inter,sans-serif}
.aa-tl__facts dt{color:var(--aa-mute)}.aa-tl__facts dd{margin:0;color:var(--aa-ink);font-weight:650;font-variant-numeric:tabular-nums}
.aa-findings{margin:0;padding:0;list-style:none}
.aa-findings li{position:relative;padding:0 0 5px 14px;font:500 10.5px/1.45 Inter,sans-serif;color:#1e293b}
.aa-findings li::before{content:"";position:absolute;left:2px;top:6px;width:5px;height:5px;border-radius:50%;background:var(--aa-blue)}
.aa-findings li.aa-red::before{background:var(--aa-red)}
.aa-kv{display:grid;gap:0 18px;margin:0}
.aa-kv--2{grid-template-columns:1fr 1fr}.aa-kv--1{grid-template-columns:1fr}
.aa-kv__row{display:grid;grid-template-columns:42% 1fr;gap:8px;padding:5px 0;border-bottom:1px solid #F1F5F9;break-inside:avoid}
.aa-kv__row dt{font:500 9.5px/1.35 Inter,sans-serif;color:var(--aa-mute)}
.aa-kv__row dd{margin:0;font:600 10.5px/1.35 Inter,sans-serif;color:var(--aa-ink)}
.aa-equip{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
.aa-equip__g h4{margin:0 0 4px;font:650 9.5px Inter,sans-serif;color:#334155}
.aa-chips{display:flex;flex-wrap:wrap;gap:4px}
.aa-chip{display:inline-block;padding:3px 8px;border:1px solid #E2E8F0;border-radius:999px;background:#F8FAFC;font:500 9.5px Inter,sans-serif;color:#1e293b}
.aa-lot{margin-top:4px}
.aa-lot__head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:6px 0 8px;padding:0 0 6px;border-bottom:2px solid var(--aa-blue);break-after:avoid}
.aa-lot__head h2{margin:0;font:800 15px Inter,sans-serif;color:var(--aa-ink)}
.aa-lot__head h2 small{font-weight:600;color:var(--aa-blue);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:8px}
.aa-lot__head span{font:500 10px Inter,sans-serif;color:var(--aa-mute)}
.aa-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 9px;align-items:start}
.aa-dmg{display:grid;grid-template-columns:44% 1fr;gap:12px;align-items:center}
.aa-scheme svg{display:block;width:100%;height:auto}
.aa-dmg__list{margin:0;padding:0;list-style:none}
.aa-dmg__list li{display:grid;gap:1px;padding:5px 0;border-bottom:1px solid #F1F5F9;font:500 9.5px/1.35 Inter,sans-serif}
.aa-dmg__list b{color:var(--aa-red);font-weight:650}.aa-dmg__list span{color:#334155}
.aa-dmg__list .aa-dmg--seen b{color:#B45309}
.aa-desc{margin:0 0 6px}.aa-desc__lv{margin:0;font:500 10.5px/1.5 Inter,sans-serif;color:var(--aa-ink)}
.aa-desc__orig{margin:3px 0 0;font:400 8.5px/1.45 Inter,sans-serif;color:#94a3b8}.aa-desc__orig span{font-weight:600}
.aa-gallery{break-before:page;page-break-before:always}
.aa-gallery__head{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 7px;padding:0 0 5px;border-bottom:2px solid var(--aa-blue)}
.aa-gallery__head h3{margin:0;font:800 13px Inter,sans-serif;color:var(--aa-ink)}
.aa-gallery__head span{font:500 9.5px Inter,sans-serif;color:var(--aa-mute)}
.aa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px 7px}
.aa-fig{margin:0;border:1px solid var(--aa-line);border-radius:9px;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.aa-fig img{display:block;width:100%;height:40mm;object-fit:cover;background:#F1F5F9}
.aa-fig figcaption{display:flex;gap:6px;align-items:baseline;padding:4px 7px 5px;font:500 8px Inter,sans-serif;color:#475569;border-top:1px solid #F1F5F9}
.aa-fig figcaption b{color:var(--aa-ink);font-weight:700;font-variant-numeric:tabular-nums}
.aa-sources{margin:0;padding:0 0 0 14px;font:500 10px Inter,sans-serif;color:#334155}
.aa-foot{font:500 8.5px/1.5 Inter,sans-serif;color:var(--aa-mute);margin:10px 0 0}
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
      photos: input.photos.filter((p) => p.auctionKey === key),
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
  )}</h1><p class="pdf-v1-meta">Ģenerēts: ${esc(fmtDateTime(now))}</p></div></div></header>
<div class="aa-hero"><p class="aa-hero__kicker">Eiropas izsoļu arhīvs</p><h2 class="aa-hero__model">${esc(title)}</h2>${
    version ? `<p class="aa-hero__ver">${esc(version)}</p>` : ""
  }<p class="aa-hero__vin">VIN <b class="pdf-vin">${esc(s.vin)}</b></p></div>`;
  const stats = [
    { k: "Izsoles", v: String(s.auctions.length) },
    { k: "Bildes", v: String(photoTotal) },
    { k: "Pēdējā izsole", v: formatIsoDayLv(lastDate) || "-" },
    { k: "Nobraukums", v: km != null ? formatKm(km) : "-" },
  ];
  const statsHtml = `<div class="aa-stats">${stats.map((x) => `<div class="aa-stat"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join("")}</div>`;

  const tlCards = lots
    .map((l) => {
      const facts: [string, string][] = [
        ["Valsts", l.facts.country || l.auction?.country || ""],
        ["Nobraukums", formatKm(l.km)],
        ["Bildes", l.photos.length ? String(l.photos.length) : "nav"],
      ];
      if (showPrices && l.auction?.priceEur != null) facts.push(["Cena", formatEurWhole(l.auction.priceEur)]);
      return `<article class="aa-tl"><span class="aa-tl__n">${l.n}.</span><p class="aa-tl__date">${esc(
        formatIsoDayLv(l.date) || "Datums nav zināms",
      )}</p><p class="aa-tl__where">${esc(l.platform)}</p><dl class="aa-tl__facts">${facts
        .filter(([, v]) => v)
        .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
        .join("")}</dl></article>`;
    })
    .join("");
  const timeline = lots.length
    ? card("Izsoļu hronoloģija", `<div class="aa-timeline aa-timeline--${Math.min(lots.length, 3)}">${tlCards}</div>`, {
        aside: lvCount(lots.length, "izsole", "izsoles"),
      })
    : "";
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
    ? card("Galvenie fakti", `<ul class="aa-findings">${findings.map((f) => `<li${f.alert ? ' class="aa-red"' : ""}>${esc(f.text)}</li>`).join("")}</ul>`)
    : "";

  /* --- 2. Transportlīdzeklis --- */
  const vehicle = records.length ? card("Transportlīdzekļa dati", kvGrid(auctionArchiveVehicleRows(records))) : "";
  const equipment = auctionArchiveEquipment(records, translations);
  const equipHtml = equipment.groups.length
    ? card(
        "Aprīkojums",
        `<div class="aa-equip">${equipment.groups
          .map(
            (g) =>
              `<div class="aa-equip__g"><h4>${esc(g.group)}</h4><div class="aa-chips">${g.items.map((i) => `<span class="aa-chip">${esc(i)}</span>`).join("")}</div></div>`,
          )
          .join("")}</div>`,
        { aside: "pēc izsoļu datiem" },
      )
    : "";
  const sources = s.manualSources.length
    ? card("Citi avoti", `<ul class="aa-sources">${s.manualSources.map((m) => `<li>${esc(m.label)}${m.kind === "pdf" ? " (PDF)" : ""}</li>`).join("")}</ul>`)
    : "";

  /* --- 3. Izsoles --- */
  const lotHtml = lots.map((l) => {
    const sub = [formatIsoDayLv(l.date), l.facts.country].filter(Boolean).join(" · ");
    const head = `<div class="aa-lot__head"><h2><small>${l.n}. izsole</small>${esc(l.platform)}</h2><span>${esc(sub)}</span></div>`;
    const saleCard = card("Izsoles dati", kvGrid(l.facts.sale, 1));
    const condCard = card("Stāvoklis un dokumenti", kvGrid(l.facts.condition, 1));
    const priceCard = showPrices ? card("Cenas", kvGrid(l.facts.prices, 1), { aside: "avota dati" }) : "";
    const left = [saleCard, priceCard].filter(Boolean).join("");
    const cols = left && condCard ? `<div class="aa-cols"><div>${left}</div><div>${condCard}</div></div>` : left + condCard;
    const dmg = auctionArchiveDamageCardHtml(l.damages, marks.filter((m) => m.auctionKey === l.key));
    const desc = descriptionCard(auctionArchiveDescriptions(l.record), translations);
    return `<section class="aa-lot">${head}${cols}${dmg}${desc}</section>`;
  });

  /* --- 4. Galerijas --- */
  const galleries = lots
    .map((l) => galleryHtml(`Bildes · ${l.n}. izsole · ${l.platform} · ${formatIsoDayLv(l.date)}`, l.platform, l.photos, input.dataUrls))
    .join("\n");
  const knownKeys = new Set(lots.map((l) => l.key));
  const manualPhotos = input.photos.filter((p) => !knownKeys.has(p.auctionKey));
  const manual = galleryHtml("Bildes · citi izsoļu avoti", "", manualPhotos, input.dataUrls);

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
  )}</title><style>${css}</style></head><body class="provin-report-doc"><div class="sheet">${hero}${statsHtml}${timeline}${findingsHtml}${vehicle}${equipHtml}${sources}${lotHtml.join(
    "\n",
  )}${galleries}${manual}${foot}</div>${FONT_READY_SCRIPT}</body></html>`;
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
