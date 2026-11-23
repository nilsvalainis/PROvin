/**
 * «Izsoļu arhīvs» PDF (makets 4. solis) - sūta tikai pēc klienta «Jā». Esošā PROVIN PDF valoda
 * (tās pašas klases kā dīlera atskaitē: `getClientReportPrintCss`, galvene/kājene, kv tabulas), jauns
 * dokumenta veids: vāks, hronoloģija ar cenām (Nila 4A), 9 pamatdati, katra izsole (strukturētais
 * TheCarApi bloks), bojājumi uz virsbūves shēmas + operatora «Redzams bildē», apraksts oriģinālā +
 * tulkojums, galerija pa izsolēm ar datumiem - VISAS bildes (Nila 2A), 2 kolonnas, līdz 6 lapā.
 * Numurzīmes PDF NEizplūdina (klientam viss). Tīrs modulis - bildes nāk kā data: URI no servera.
 */
import {
  auctionArchiveMaxKm,
  formatEurWhole,
  formatIsoDayLv,
  formatKm,
  type AuctionArchiveAuction,
  type AuctionArchiveOperatorMark,
  type AuctionArchivePhoto,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildPaintMapSvg, type PaintMapReading, type PaintMapSlot } from "@/lib/paint-map-svg";
import { buildPdfKvPairHtml } from "@/lib/pdf-fact-card";
import { buildPdfRunningFooterLine, buildPdfRunningHeaderLine, clientReportRunningPageCss } from "@/lib/pdf-running-page";
import { renderThecarapiPdfModelHtml } from "@/lib/thecarapi-pdf";
import { buildThecarapiPdfModel, type ThecarapiPdfDamage } from "@/lib/thecarapi-pdf-model";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const NAV = '<span class="aa-missing">Nav datu</span>';

/* ---------- 9 pamatdati ---------- */

const BASIC_ROWS: { label: string; re: RegExp }[] = [
  { label: "Pirmā reģistrācija", re: /pirm\S* reģistr|first.?reg|registration.?date|date_first/i },
  { label: "Virsbūve", re: /virsbūv|body.?(type|style)|^body$/i },
  { label: "Dzinējs", re: /dzinēj|tilpum|kubatūr|engine.?(size|capacity|displacement)|cubic|ccm|displacement/i },
  { label: "Degviela", re: /degviel|^fuel|fuel.?type/i },
  { label: "Krāsa", re: /^krāsa$|^krāsa\b(?!.*biez)|^colou?r|exterior.?colou?r|paint.?colou?r/i },
  { label: "Jauda", re: /jauda|power|kw\b|horse/i },
  { label: "Atslēgas", re: /atslēg|keys?\b|number.?of.?keys/i },
  { label: "Ātrumkārba", re: /ātrumkārb|transmis|gear.?box/i },
  { label: "CO₂", re: /co2|co₂|emisij|emission/i },
  { label: "Servisa grāmata", re: /servisa grāmat|service.?book|maintenance.?book/i },
];

type KvSource = { label: string; value: string };

function rowsOfRecord(r: ThecarapiAdminRecord): KvSource[] {
  let model: ReturnType<typeof buildThecarapiPdfModel> | null = null;
  try {
    model = buildThecarapiPdfModel(r);
  } catch {
    model = null;
  }
  const fromModel: KvSource[] = model
    ? [...model.basics, ...model.other, ...model.prices, ...model.mileage, ...model.service.rows].map((x) => ({ label: x.label, value: x.value }))
    : [];
  const fromFields: KvSource[] = r.fields.flatMap((f) => [
    { label: f.label, value: f.value },
    { label: f.key, value: f.value },
  ]);
  return [...fromModel, ...fromFields].filter((x) => x.value.trim() && !/^https?:\/\//.test(x.value.trim()));
}

/** Jaunākā izsole ar vērtību uzvar. «Dzinējs» = tilpums + degviela (kā maketā «1968 cm³, dīzelis»). */
export function auctionArchiveBasicRows(records: readonly ThecarapiAdminRecord[]): { k: string; v: string; vHtml?: string }[] {
  const newestFirst = [...records].reverse().map(rowsOfRecord);
  const pick = (re: RegExp): string => {
    for (const rows of newestFirst) {
      const hit = rows.find((x) => re.test(x.label) && x.value.trim().length <= 80);
      if (hit) return hit.value.trim();
    }
    return "";
  };
  const out: { k: string; v: string; vHtml?: string }[] = [];
  for (const row of BASIC_ROWS) {
    if (row.label === "Degviela") continue;
    let v = pick(row.re);
    if (row.label === "Dzinējs") {
      const fuel = pick(BASIC_ROWS.find((x) => x.label === "Degviela")!.re);
      const cc = v && /^\d{3,4}$/.test(v) ? `${v} cm³` : v;
      v = [cc, fuel && !cc.toLowerCase().includes(fuel.toLowerCase()) ? fuel.toLowerCase() : ""].filter(Boolean).join(", ");
    }
    if (row.label === "Pirmā reģistrācija") {
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (iso) v = `${iso[3]}.${iso[2]}.${iso[1]}`;
    }
    out.push(v ? { k: row.label, v } : { k: row.label, v: "Nav datu", vHtml: NAV });
  }
  return out;
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

export function auctionArchiveDamageSchemeHtml(
  damages: readonly ThecarapiPdfDamage[],
  marks: readonly AuctionArchiveOperatorMark[],
): string {
  const counts = new Map<string, { slot: PaintMapSlot; n: number; seen: boolean }>();
  for (const d of damages) {
    const slot = damageSlotLv(d.zone, d.part);
    if (!slot) continue;
    const key = `${slot.zone}:${slot.slot}`;
    const n = Number.parseInt(d.quantity, 10);
    const cur = counts.get(key) ?? { slot, n: 0, seen: false };
    cur.n += Number.isFinite(n) && n > 0 ? n : 1;
    counts.set(key, cur);
  }
  for (const m of marks) {
    const slot = damageSlotLv(ZONE_LABEL[m.zone] ?? m.zone, m.part ?? "");
    if (!slot) continue;
    const key = `${slot.zone}:${slot.slot}`;
    const cur = counts.get(key) ?? { slot, n: 0, seen: false };
    cur.seen = true;
    counts.set(key, cur);
  }
  if (counts.size === 0 && damages.length === 0 && marks.length === 0) return "";
  const readings: PaintMapReading[] = [...counts.values()].map((c) => ({
    slot: c.slot,
    text: c.n > 0 ? `${c.n} bojāj.` : "Redzams bildē",
    tone: c.n > 0 ? "alert" : "warn",
  }));
  const svg = readings.length ? `<div class="pdf-tc-paint-map aa-scheme">${buildPaintMapSvg(readings)}</div>` : "";
  const legend = `<p class="pdf-dealer-cover-note pdf-tc-legend"><span class="pdf-tc-tone pdf-tc-tone--alert">Izsoles norādītie bojājumi</span>${
    marks.length ? ` · <span class="pdf-tc-tone pdf-tc-tone--warn">Redzams bildē (atzīmēja PROVIN)</span>` : ""
  }</p>`;
  const notes = marks.length
    ? `<ul class="pdf-dealer-eq">${marks
        .map((m) => `<li><b>Redzams bildē</b> - ${esc(ZONE_LABEL[m.zone] ?? m.zone)}${m.part ? `, ${esc(m.part)}` : ""}${m.note ? `: ${esc(m.note)}` : ""}</li>`)
        .join("")}</ul>`
    : "";
  const none = damages.length === 0 ? `<p class="aa-note">Izsole bojājumus nenorādīja.</p>` : "";
  return `<div class="pdf-keep-head aa-damage"><p class="pdf-subhead">Bojājumi pa zonām</p>${svg}${legend}${none}${notes}</div>`;
}

/* ---------- Apraksts ---------- */

const DESC_KEY = /(^|[._])(description|comments?|remarks?|condition(_text|_report)?|notes?|seller_?comment|damage_?description|headline|title)$/i;

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

function descriptionHtml(texts: readonly string[], translations: ReadonlyMap<string, string>): string {
  if (texts.length === 0) return "";
  const items = texts
    .map((t) => {
      const lv = translations.get(t)?.trim() ?? "";
      const tr = lv && lv.toLowerCase() !== t.toLowerCase() ? `<p class="aa-desc__lv">${esc(lv)}</p>` : "";
      return `<div class="aa-desc"><p class="aa-desc__orig">${esc(t)} <span class="aa-desc__tag">(oriģināls)</span></p>${tr}</div>`;
    })
    .join("");
  return `<div class="pdf-keep-head"><p class="pdf-subhead">Izsoles apraksts</p>${items}</div>`;
}

/* ---------- Galerija ---------- */

const PHOTOS_PER_PAGE = 6;

function galleryHtml(title: string, photos: readonly AuctionArchivePhoto[], dataUrls: ReadonlyMap<string, string>): string {
  const list = photos.filter((p) => dataUrls.get(p.id));
  if (list.length === 0) return "";
  const pages: string[] = [];
  for (let i = 0; i < list.length; i += PHOTOS_PER_PAGE) {
    const chunk = list.slice(i, i + PHOTOS_PER_PAGE);
    const n = Math.floor(i / PHOTOS_PER_PAGE) + 1;
    const figs = chunk
      .map((p, j) => {
        const date = formatIsoDayLv(p.date) || p.date;
        const cap = [date, p.caption && !p.caption.includes(date) ? p.caption : ""].filter(Boolean).join(" · ");
        return `<figure class="aa-fig"><img src="${dataUrls.get(p.id)!}" alt=""/><figcaption>${esc(cap || `Bilde ${i + j + 1}`)}</figcaption></figure>`;
      })
      .join("");
    pages.push(
      `<section class="aa-gallery${i > 0 ? " aa-gallery--cont" : ""}"><p class="aa-gallery__head"><b>${esc(title)}</b><span>${list.length} bildes · ${n}. lapa</span></p><div class="aa-grid">${figs}</div></section>`,
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
  translations?: ReadonlyMap<string, string>;
  marks?: readonly AuctionArchiveOperatorMark[];
  generatedAt?: Date;
  /** «Sagatavots klientam: …» kājenē (vārds, ja ir). */
  preparedFor?: string;
};

function recordKey(r: ThecarapiAdminRecord): string {
  return `${(r.site || "thecarapi").toLowerCase()}:${r.id}`.slice(0, 120);
}

function auctionTitle(a: AuctionArchiveAuction | undefined, fallback: string): string {
  if (!a) return fallback;
  return [a.platform, formatIsoDayLv(a.date), a.country].filter(Boolean).join(" · ");
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

const ARCHIVE_CSS = `
.aa-cover{padding:2mm 0 4mm;border-bottom:1px solid #E9EDF3;margin-bottom:5mm}
.aa-brand{font:800 18pt Inter,sans-serif;letter-spacing:-.4px;margin:0}.aa-brand b{color:#0066ff}
.aa-kicker{font:700 8pt Inter,sans-serif;letter-spacing:.12em;color:#0061D2;margin:3mm 0 0;text-transform:uppercase}
.aa-meta{font:500 8pt Inter,sans-serif;color:#64748b;margin:1mm 0 0}
.aa-h1{font:800 20pt Inter,sans-serif;letter-spacing:-.4px;margin:5mm 0 0;color:#0f172a}
.aa-model{font:700 12pt Inter,sans-serif;margin:1.5mm 0 0;text-transform:uppercase;color:#0f172a}
.aa-vin{font:600 9pt Menlo,Consolas,monospace;margin:1mm 0 0;color:#334155;letter-spacing:.3px}
.aa-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin:5mm 0 0}
.aa-stat{background:#F6F7F9;border-radius:8px;padding:3mm}.aa-stat span{display:block;font:500 7.5pt Inter,sans-serif;color:#64748b}.aa-stat b{display:block;font:700 12pt Inter,sans-serif;color:#0f172a;margin-top:1mm}
.aa-table{width:100%;border-collapse:collapse;font:500 8.5pt Inter,sans-serif;margin:2mm 0 5mm}
.aa-table th{text-align:left;font-weight:600;color:#64748b;border-bottom:1px solid #E9EDF3;padding:2mm 1.5mm}
.aa-table td{border-bottom:1px solid #F1F5F9;padding:2mm 1.5mm;color:#0f172a}
.aa-missing{color:#B91C1C;font-weight:600}
.aa-lot{break-before:page;page-break-before:always}
.aa-lot__head{font:800 13pt Inter,sans-serif;margin:0 0 3mm;color:#0f172a}
.aa-note{font:500 8.5pt Inter,sans-serif;color:#64748b;margin:1mm 0 2mm}
.aa-desc{margin:0 0 3mm}.aa-desc__orig{font:500 8.5pt Inter,sans-serif;color:#334155;margin:0}.aa-desc__tag{color:#94a3b8}
.aa-desc__lv{font:600 9pt Inter,sans-serif;color:#0f172a;margin:1mm 0 0}
.aa-gallery{break-before:page;page-break-before:always}
.aa-gallery__head{display:flex;justify-content:space-between;font:500 8.5pt Inter,sans-serif;color:#64748b;margin:0 0 3mm}.aa-gallery__head b{color:#0f172a;font-weight:700}
.aa-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.aa-fig{margin:0;break-inside:avoid;page-break-inside:avoid}
.aa-fig img{display:block;width:100%;height:72mm;object-fit:cover;border-radius:6px;background:#F1F5F9}
.aa-fig figcaption{font:500 7.5pt Inter,sans-serif;color:#475569;margin-top:1.2mm}
.aa-sources{font:500 8.5pt Inter,sans-serif;color:#334155}
.aa-foot{font:500 7.5pt Inter,sans-serif;color:#64748b;margin-top:6mm;border-top:1px solid #E9EDF3;padding-top:3mm}
`;

export function buildAuctionArchivePdfHtml(input: AuctionArchivePdfInput): string {
  const s = input.summary;
  const now = input.generatedAt ?? new Date();
  const translations = input.translations ?? new Map<string, string>();
  const marks = input.marks ?? [];
  const byKey = new Map(s.auctions.map((a) => [a.key, a]));
  const lastDate = [...s.auctions].reverse().find((a) => a.date)?.date ?? "";
  const km = auctionArchiveMaxKm(s);

  const stats = [
    { k: "Izsoles", v: String(s.auctions.length) },
    { k: "Bildes", v: String(input.photos.length || s.photoCount) },
    { k: "Pēdējā izsole", v: formatIsoDayLv(lastDate) || "-" },
    { k: "Nobraukums", v: km != null ? formatKm(km) : "-" },
  ];
  const chrono = s.auctions.length
    ? `<p class="pdf-subhead">Izsoles hronoloģiski</p><table class="aa-table"><thead><tr><th>Datums</th><th>Portāls</th><th>Valsts</th><th>Nobraukums</th><th>Cena</th><th>Bildes</th></tr></thead><tbody>${s.auctions
        .map((a) => {
          const photos = input.photos.filter((p) => p.auctionKey === a.key).length;
          return `<tr><td>${esc(formatIsoDayLv(a.date) || "-")}</td><td>${esc(a.platform || "-")}</td><td>${esc(a.country || "-")}</td><td>${esc(formatKm(a.km) || "-")}</td><td>${esc(formatEurWhole(a.priceEur) || "-")}</td><td>${photos || "-"}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : "";
  const basics = input.records.length
    ? `<div class="pdf-keep-head"><p class="pdf-subhead">Transportlīdzekļa informācija</p><div class="pdf-dealer-vehicle-kv">${buildPdfKvPairHtml(auctionArchiveBasicRows(input.records))}</div></div>`
    : "";
  const cover = `<header class="aa-cover"><p class="aa-brand">PRO<b>VIN</b>.LV</p><p class="aa-kicker">Izsoļu arhīvs</p><p class="aa-meta">Ģenerēts: ${esc(fmtDateTime(now))} · VIN ${esc(s.vin)}</p>
<h1 class="aa-h1">Eiropas izsoļu arhīvs</h1>${s.title ? `<p class="aa-model">${esc(s.title)}</p>` : ""}<p class="aa-vin">${esc(s.vin)}</p>
<div class="aa-stats">${stats.map((x) => `<div class="aa-stat"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join("")}</div></header>`;

  const ordered = [...input.records].sort((a, b) => (byKey.get(recordKey(a))?.date || "9999").localeCompare(byKey.get(recordKey(b))?.date || "9999"));
  const lots = ordered.map((r) => {
    const key = recordKey(r);
    const a = byKey.get(key);
    let model: ReturnType<typeof buildThecarapiPdfModel> | null = null;
    try {
      model = buildThecarapiPdfModel(r);
    } catch {
      model = null;
    }
    const title = auctionTitle(a, r.venue || r.site || "Izsole");
    const body = model ? renderThecarapiPdfModelHtml(model) : "";
    const scheme = auctionArchiveDamageSchemeHtml(model?.damages ?? [], marks.filter((m) => m.auctionKey === key));
    const desc = descriptionHtml(auctionArchiveDescriptions(r), translations);
    const gallery = galleryHtml(title, input.photos.filter((p) => p.auctionKey === key), input.dataUrls);
    return `<section class="aa-lot"><p class="aa-lot__head">${esc(title)}</p>${body}${scheme}${desc}</section>${gallery}`;
  });
  const manualPhotos = input.photos.filter((p) => p.auctionKey === "manual" || !byKey.has(p.auctionKey));
  const manual = galleryHtml("Citi izsoļu avoti", manualPhotos, input.dataUrls);
  const sources = s.manualSources.length
    ? `<div class="pdf-keep-head"><p class="pdf-subhead">Citi avoti</p><ul class="pdf-dealer-eq aa-sources">${s.manualSources
        .map((m) => `<li>${esc(m.label)}${m.kind === "pdf" ? " (PDF)" : ""}</li>`)
        .join("")}</ul></div>`
    : "";

  const header = buildPdfRunningHeaderLine(s.title, s.vin, "PROVIN.LV");
  const footer = buildPdfRunningFooterLine({ vin: s.vin, dateLabel: fmtDateTime(now), preparedBy: input.preparedFor ?? "" });
  const css = `${getClientReportPrintCss()}${clientReportRunningPageCss({ header, footer, lang: "lv" })}${ARCHIVE_CSS}`;
  const foot = `<p class="aa-foot">Dati no Eiropas izsoļu portālu arhīva izsoles dienā. Bildes, cenas, nobraukums un apraksti ir avota dati; tulkojums - PROVIN. Bojājumi «Redzams bildē» - PROVIN atzīme pēc bildes.</p>`;
  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><meta name="color-scheme" content="light"/><title>${esc(
    `Izsolu_arhivs_${s.vin}.pdf`,
  )}</title><style>${css}</style></head><body class="provin-report-doc"><div class="sheet">${cover}${chrono}${basics}${sources}${lots.join("\n")}${manual}${foot}</div>${FONT_READY_SCRIPT}</body></html>`;
}

/** Servera renderis gaida `data-provin-fonts="ready"` (kā klienta atskaitē). */
const FONT_READY_SCRIPT = `<script>(function(){function done(){document.documentElement.setAttribute("data-provin-fonts","ready")}if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load("400 12px Inter"),document.fonts.load("700 12px Inter")]).then(done,done)}else done()})();</script>`;

export function auctionArchivePdfFilename(vin: string): string {
  const v = vin.replace(/[^A-Za-z0-9]/g, "").slice(0, 17) || "VIN";
  return `PROVIN_izsolu_arhivs_${v}.pdf`;
}

