/**
 * bid.cars lota lapa (relejs: meklēšanas API -> lota HTML).
 * Lota HTML jau satur pārdošanas vēsturi (`.sales-history-table`), bojājumus, nobraukumu un bildes.
 * „Similar archival offers” ir citi auto - tos neskaitām (bildes tikai ar šo VIN nosaukumā).
 */
import { auctionDamageLv } from "@/lib/vin-scan/damage-labels-lv";
import type { VinScanAuction, VinScanParse } from "@/lib/vin-scan/types";
import { decodeHtmlEntities } from "@/lib/vin-sources/html-extract";

export type BidCarsSale = {
  venue: string;
  date: string;
  lot: string;
  finalBid: string;
  odometer: string;
  status: string;
  seller: string;
};

export type BidCarsLot = {
  title: string;
  year: string;
  make: string;
  model: string;
  lot: string;
  venue: string;
  location: string;
  seller: string;
  saleDocument: string;
  loss: string;
  primaryDamage: string;
  secondaryDamage: string;
  odometer: string;
  startCode: string;
  key: string;
  acv: string;
  engine: string;
  fuel: string;
  transmission: string;
  auctionDate: string;
  sales: BidCarsSale[];
  photoUrls: string[];
  photoCount: number;
};

const MI_TO_KM = 1.609344;

function text(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** `<div class="option">Label <span ...>Vērtība</span>` pāri; pirmā vērtība uzvar (lapā ir divi bloki). */
function optionPairs(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<div class="option[^"]*">\s*([^<]{1,40}?)\s*<span[^>]*>([\s\S]*?)<\/span>/g;
  for (const m of html.matchAll(re)) {
    const label = text(m[1]).toLowerCase();
    const value = text(m[2]).replace(/^(\d)-\s+(\d)/, "$1-$2");
    if (!label || !value || value === "-") continue;
    if (!out.has(label)) out.set(label, value);
  }
  return out;
}

/** Vērtība pēc etiķetes redzamajā tekstā (rindu robežas no HTML blokiem). */
function textAfterLabel(html: string, label: string): string {
  const re = new RegExp(`>\\s*${label}\\s*<[\\s\\S]{0,400}?>\\s*([^<\\s][^<]{0,80}?)\\s*<`, "i");
  const m = re.exec(html);
  return m ? text(m[1]) : "";
}

function parseSales(html: string): BidCarsSale[] {
  const table = /<table[^>]*class="[^"]*sales-history-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? "";
  const body = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(table)?.[1] ?? "";
  const rows: BidCarsSale[] = [];
  for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1]));
    if (cells.length < 7) continue;
    const [venue, date, lot, finalBid, odometer, status, seller] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rows.push({
      venue,
      date,
      lot,
      finalBid: /^\*+$/.test(finalBid) ? "" : finalBid,
      odometer,
      status,
      seller,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function photoUrls(html: string, vin: string): string[] {
  const v = vin.toUpperCase();
  const seen = new Map<string, number>();
  const re = /https:\/\/(?:images|mercury)\.bid\.cars\/[^"'\s?<>]+?-(\d{1,3})\.(?:jpe?g|webp)/gi;
  for (const m of html.matchAll(re)) {
    const url = m[0];
    if (!url.toUpperCase().includes(v)) continue;
    // Viena bilde var būt vairākos izmēros/hostos - atslēga ir kārtas numurs.
    const n = Number(m[1]);
    if (![...seen.values()].includes(n) && !seen.has(url)) seen.set(url, n);
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([url]) => url);
}

/** „126 991 mi (204 372 km)” vai „126 991 mi” -> „204 372 km”. */
export function bidCarsOdometerKm(raw: string): string {
  const km = /([\d\s,.]+)\s*km/i.exec(raw)?.[1];
  if (km) return `${km.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
  const mi = /([\d\s,.]+)\s*mi\b/i.exec(raw)?.[1];
  if (!mi) return "";
  const n = Number(mi.replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${String(Math.round(n * MI_TO_KM)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

/** null: lapa nav šī VIN lota lapa. */
export function parseBidCarsLotHtml(html: string, vin: string): BidCarsLot | null {
  const v = vin.trim().toUpperCase();
  const raw = String(html ?? "");
  const pageTitle = text(/<title>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? "");
  const opts = optionPairs(raw);
  const pageVin = (opts.get("vin") ?? "").toUpperCase();
  if (pageVin !== v && !pageTitle.toUpperCase().includes(v)) return null;
  const title = pageTitle.split("|")[0]?.trim() ?? "";
  const head = /^((?:19|20)\d{2})\s+(\S+)\s+([^,]+)/.exec(title);
  const sales = parseSales(raw);
  const photos = photoUrls(raw, v);
  const viewPhotos = Number(/View\s+(\d+)\s+Photos/i.exec(raw)?.[1] ?? NaN);
  const venue = /<span class="seo-label[^"]*">\s*([^<]+?)\s*<\/span>/i.exec(raw)?.[1]?.trim() || sales[sales.length - 1]?.venue || "";
  const auctionDate =
    /Auction date[\s\S]{0,200}?<span>\s*([A-Za-z]+,\s*[A-Za-z]+ \d{1,2}, \d{4})/i.exec(raw)?.[1]?.trim() ||
    /Sale date:\s*(\d{4}-\d{2}-\d{2})/i.exec(raw)?.[1] ||
    "";
  return {
    title,
    year: head?.[1] ?? "",
    make: head?.[2] ?? "",
    model: head?.[3]?.trim() ?? "",
    lot: opts.get("lot") ?? "",
    venue,
    location: opts.get("location") ?? "",
    seller: opts.get("seller") ?? "",
    saleDocument: opts.get("sale document") ?? "",
    loss: opts.get("loss") ?? "",
    primaryDamage: opts.get("primary damage") ?? "",
    secondaryDamage: /^none$/i.test(opts.get("secondary damage") ?? "") ? "" : (opts.get("secondary damage") ?? ""),
    odometer: opts.get("odometer") ?? "",
    startCode: opts.get("start code") || textAfterLabel(raw, "Start code"),
    key: opts.get("key") ?? "",
    acv: opts.get("acv / erc") ?? "",
    engine: opts.get("engine") ?? "",
    fuel: opts.get("fuel type") ?? "",
    transmission: opts.get("transmission") ?? "",
    auctionDate,
    sales,
    photoUrls: photos,
    photoCount: Number.isFinite(viewPhotos) && viewPhotos > 0 ? viewPhotos : photos.length,
  };
}

function izsoleWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "izsole" : "izsoles";
}

export function vinScanParseFromBidCarsLot(lot: BidCarsLot, lotUrl: string): VinScanParse {
  const km = bidCarsOdometerKm(lot.odometer);
  const damage = [lot.primaryDamage, lot.secondaryDamage].filter(Boolean).join(" + ");
  const saleCount = Math.max(1, lot.sales.length);
  const last = lot.sales[lot.sales.length - 1];
  const rows = lot.sales.length ? lot.sales : [null];
  const lotKey = lot.lot.replace(/\s+/g, "");
  // Bildes pie vienas (jaunākās) šī lota rindas, lai skaits nedubultojas atkārtotās izsolēs.
  let photoRow = -1;
  rows.forEach((s, i) => {
    if (!s || s.lot.replace(/\s+/g, "") === lotKey) photoRow = i;
  });
  const auctions: VinScanAuction[] = rows.map((s, i) => {
    const sameLot = !s || s.lot.replace(/\s+/g, "") === lotKey;
    const withPhotos = i === photoRow;
    const rowKm = s ? bidCarsOdometerKm(s.odometer) : km;
    return {
      title: [lot.title, s?.status].filter(Boolean).join(" · "),
      date: s?.date ?? lot.auctionDate,
      price: s?.finalBid || undefined,
      venue: s?.venue || lot.venue,
      lot: s?.lot || lot.lot,
      odometer: rowKm || undefined,
      damage: sameLot && damage ? damage : undefined,
      photoUrl: withPhotos ? lot.photoUrls[0] : undefined,
      photoCount: withPhotos && lot.photoCount ? lot.photoCount : undefined,
      photoUrls: withPhotos && lot.photoUrls.length ? lot.photoUrls : undefined,
    };
  });
  const summary = [
    `${saleCount} ${izsoleWord(saleCount)}`,
    last?.date || lot.auctionDate,
    lot.venue,
    km,
    damage ? auctionDamageLv(damage) : "",
    lot.photoCount ? `${lot.photoCount} foto` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const detail = [
    lot.title && `Auto: ${lot.title}`,
    lot.lot && `Lots: ${[lot.venue, lot.lot].filter(Boolean).join(" ")}`,
    lot.location && `Vieta: ${lot.location}`,
    lot.seller && `Pārdevējs: ${lot.seller}`,
    lot.saleDocument && `Dokuments: ${lot.saleDocument}`,
    lot.loss && `Zaudējuma veids: ${lot.loss}`,
    damage && `Bojājums: ${auctionDamageLv(damage)}`,
    lot.odometer && `Nobraukums: ${lot.odometer}`,
    lot.startCode && `Starts: ${lot.startCode}`,
    lot.key && `Atslēga: ${lot.key}`,
    lot.acv && `ACV / ERC: ${lot.acv}`,
    lot.engine && `Dzinējs: ${lot.engine}`,
    lot.photoCount && `Bildes: ${lot.photoCount}`,
    ...(lot.sales.length
      ? [
          "Pārdošanas vēsture:",
          ...lot.sales.map((s) => `${[s.date, s.venue, s.lot, s.finalBid, s.odometer, s.status, s.seller].filter(Boolean).join(" · ")}`),
        ]
      : []),
  ]
    .filter(Boolean)
    .join("\n");
  const mileage = (lot.sales.length ? lot.sales : [])
    .map((s) => ({ date: s.date, odometer: bidCarsOdometerKm(s.odometer) }))
    .filter((m) => m.date && m.odometer);
  return {
    status: "found",
    summary,
    detail,
    openUrl: lotUrl,
    vehicle: lot.make ? { make: lot.make, model: lot.model, year: lot.year } : undefined,
    mileage: mileage.length ? mileage : undefined,
    media: lot.photoUrls.length ? { photoUrl: lot.photoUrls[0], photoCount: lot.photoCount, photoUrls: lot.photoUrls } : undefined,
    auctions,
  };
}
