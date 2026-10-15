/**
 * JoJ Copart/IAAI `/search-vin/{vin}?prices_history=1` JSON → VIN SCAN + AUCTION (cc_vin) fakti.
 * Laukumi no OpenAPI (https://carstat-copart-iaai.jojapi.net). Bez tīkla.
 */

import {
  EMPTY_JOJ_NAME_DICT,
  JOJ_LV,
  JOJ_NONE_SUMMARY,
  jojDictName,
  jojValueLv,
  jojYesNo,
  type JojCcVinFacts,
  type JojNameDict,
} from "@/lib/vin-scan/joj-labels";
import {
  AUCTION_LOT_MAX,
  AUCTION_PHOTO_BLOCK_MAX,
  AUCTION_PHOTO_PER_LOT_MAX,
  collectBestAuctionPhotoUrls,
} from "@/lib/vin-scan/auction-photo-urls";
import type { VinScanAuction, VinScanMileage, VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";

export const JOJ_NOT_CONFIGURED = "nav konfigurēts";
export { JOJ_NONE_SUMMARY };
export type { JojCcVinFacts };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "jā" : "nē";
  return "";
}

function named(v: unknown): string {
  const rec = asRecord(v);
  return str(rec.name);
}

function namedId(v: unknown): { id: string; name: string } {
  const rec = asRecord(v);
  return { id: str(rec.id), name: str(rec.name) || str(rec.code) };
}

function countryIso(location: unknown): string {
  const loc = asRecord(location);
  const country = asRecord(loc.country);
  return str(country.iso || country.code || country.name).toLowerCase();
}

function isFinlandLot(domainName: string, location: unknown): boolean {
  if (domainName.includes("copart_fi") || domainName.includes("copart.fi")) return true;
  const iso = countryIso(location);
  return iso === "fi" || iso === "fin" || iso.includes("finland") || iso.includes("suomi");
}

export function venueFromDomain(domain: unknown, location?: unknown): "Copart FI" | "Copart" | "IAAI" | "" {
  const rec = asRecord(domain);
  const name = str(rec.name).toLowerCase();
  const id = rec.id;
  if (name.includes("iaai") || name.includes("iaa") || id === 1) return "IAAI";
  if (name.includes("copart") || id === 3) {
    return isFinlandLot(name, location) ? "Copart FI" : "Copart";
  }
  if (isFinlandLot(name, location)) return "Copart FI";
  return "";
}

export function saleDate(raw: unknown): string {
  const s = str(raw);
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso?.[1] ?? s.slice(0, 32);
}

export function dateLv(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return raw.trim().slice(0, 32);
}

function formatMoney(n: unknown, currency: "USD" | "EUR"): string {
  const v = typeof n === "number" ? n : Number(str(n).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(v) || v <= 0) return "";
  return `${Math.round(v).toLocaleString("lv-LV")} ${currency}`;
}

function moneyWithTs(n: unknown, ts: unknown, currency: "USD" | "EUR"): string {
  const amount = formatMoney(n, currency);
  const when = saleDate(ts);
  if (!amount) return when ? dateLv(when) : "";
  return when ? `${amount} (${dateLv(when)})` : amount;
}

function kmLv(km: unknown, mi: unknown): string {
  const k = typeof km === "number" ? km : Number(str(km).replace(/[^\d.]/g, ""));
  if (Number.isFinite(k) && k > 0) return `${Math.round(k).toLocaleString("lv-LV")} km`;
  const m = typeof mi === "number" ? mi : Number(str(mi).replace(/[^\d.]/g, ""));
  if (Number.isFinite(m) && m > 0) return `${Math.round(m * 1.60934).toLocaleString("lv-LV")} km`;
  return "";
}

function odometerLine(odometer: unknown): { km: string; mi: string; status: string; line: string } {
  const odo = asRecord(odometer);
  const km = kmLv(odo.km, undefined);
  const mi =
    typeof odo.mi === "number" && odo.mi > 0 ? `${Math.round(odo.mi).toLocaleString("lv-LV")} mi` : "";
  const status = jojValueLv(named(odo.status));
  const line = [km, mi, status].filter(Boolean).join(" · ");
  return { km: km || kmLv(odo.km, odo.mi), mi, status, line };
}

function lookupNamed(v: unknown, dict: Record<string, string>): string {
  const { id, name } = namedId(v);
  return jojDictName(dict, id, name);
}

export function photoList(images: unknown): { photos: string[]; video: string } {
  return collectBestAuctionPhotoUrls(images, AUCTION_PHOTO_PER_LOT_MAX);
}

export function lotOpenUrl(venue: string, lot: string, vin: string): string {
  if (venue === "Copart FI") {
    return lot
      ? `https://www.copart.fi/lot/${encodeURIComponent(lot)}`
      : `https://www.copart.fi/lotSearchResults/?free=true&query=${encodeURIComponent(vin)}`;
  }
  if (venue === "Copart" && lot) return `https://www.copart.com/lot/${encodeURIComponent(lot)}`;
  if (venue === "IAAI" && lot) return `https://www.iaai.com/Search?Keyword=${encodeURIComponent(lot)}`;
  return `https://www.copart.com/lotSearchResults/?free=true&query=${encodeURIComponent(vin)}`;
}

export function jojSearchVinUrl(vin: string, baseUrl: string, pricesHistory = true): string {
  const base = baseUrl.replace(/\/+$/, "");
  const path = `${base}/search-vin/${encodeURIComponent(vin.trim().toUpperCase())}`;
  return pricesHistory ? `${path}?prices_history=1` : path;
}

export function jojUsaDamagesUrl(baseUrl: string, page = 1): string {
  return `${baseUrl.replace(/\/+$/, "")}/usa/damages?page=${Math.max(1, page)}`;
}

export function jojUsaTitlesUrl(baseUrl: string, page = 1): string {
  return `${baseUrl.replace(/\/+$/, "")}/usa/titles?page=${Math.max(1, page)}`;
}

export function parseJojDictPage(
  json: unknown,
  kind: "damages" | "titles",
): { entries: Record<string, string>; nextPageUrl: string } {
  const root = asRecord(json);
  const entries: Record<string, string> = {};
  for (const raw of asArray(root.data)) {
    const row = asRecord(raw);
    const id = str(row.id);
    if (!id) continue;
    const name = kind === "titles" ? str(row.name) || str(row.code) : str(row.name);
    if (name) entries[id] = name;
  }
  return { entries, nextPageUrl: str(root.next_page_url) };
}

export function jojSearchLotUrl(
  lot: string,
  domain: "copart_com" | "iaai_com",
  baseUrl: string,
  pricesHistory = true,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const path = `${base}/search-lot/${encodeURIComponent(lot.trim())}/${domain}`;
  return pricesHistory ? `${path}?prices_history=1` : path;
}

export function knownJojLotFromUrl(raw: string): { lot: string; domain: "copart_com" | "iaai_com" } | null {
  const text = raw.trim();
  if (!text) return null;
  const copart = /copart\.com\/lot\/(\d+[A-Za-z]?)/i.exec(text);
  if (copart?.[1]) return { lot: copart[1], domain: "copart_com" };
  const iaai = /iaai\.com\/.*?(?:vehicledetail|search).*?[/=](\d{5,})/i.exec(text);
  if (iaai?.[1]) return { lot: iaai[1], domain: "iaai_com" };
  return null;
}

function kv(lines: string[], label: string, value: string) {
  if (!value) return;
  lines.push(`${label}: ${value}`);
}

function locationLine(location: unknown): string {
  const loc = asRecord(location);
  const country = asRecord(loc.country);
  const state = asRecord(loc.state);
  const city = asRecord(loc.city);
  const yard = asRecord(loc.location);
  return [named(city) || str(city.name), named(state) || str(state.code) || str(state.name), str(country.name) || str(country.iso), named(yard) || str(loc.raw)]
    .filter(Boolean)
    .join(", ");
}

function sellerLine(seller: unknown): { line: string; insurance: boolean; name: string } {
  const s = asRecord(seller);
  const name = str(s.name);
  const flags = [
    s.is_insurance === true ? JOJ_LV.sellerInsurance : "",
    s.is_rental === true ? JOJ_LV.sellerRental : "",
    s.is_credit_company === true ? JOJ_LV.sellerCredit : "",
  ].filter(Boolean);
  return { line: [name, flags.join(", ")].filter(Boolean).join(" · "), insurance: s.is_insurance === true, name };
}

function priceHistoryLines(prices: unknown, currency: "USD" | "EUR"): string[] {
  const out: string[] = [];
  for (const raw of asArray(prices)) {
    const row = asRecord(raw);
    const bits = [
      saleDate(row.sale_date) ? dateLv(saleDate(row.sale_date)) : "",
      formatMoney(row.bid, currency),
      formatMoney(row.final_bid, currency) ? `gala ${formatMoney(row.final_bid, currency)}` : "",
      formatMoney(row.buy_now_price, currency) ? `Buy Now ${formatMoney(row.buy_now_price, currency)}` : "",
      jojValueLv(named(row.status)),
      saleDate(row.final_bid_updated_at) ? `gala ${dateLv(saleDate(row.final_bid_updated_at))}` : "",
    ].filter(Boolean);
    if (bits.length) out.push(bits.join(" · "));
  }
  return out;
}

function detailsLine(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  try {
    const text = JSON.stringify(details);
    return text === "{}" || text === "null" ? "" : text.slice(0, 800);
  } catch {
    return "";
  }
}

export function parseJojSearchVin(input: {
  status: number;
  json: unknown;
  vin: string;
  dict?: JojNameDict;
}): VinScanParse {
  return parseJojSearchVinFull(input).parse;
}

export function parseJojSearchVinFull(input: {
  status: number;
  json: unknown;
  vin: string;
  dict?: JojNameDict;
}): { parse: VinScanParse; facts: JojCcVinFacts } {
  const vin = input.vin.trim().toUpperCase();
  const dict = input.dict ?? EMPTY_JOJ_NAME_DICT;
  const emptyFacts = (): JojCcVinFacts => ({
    vehicleLine: "",
    reportDate: "",
    sales: [],
    damages: [],
    titles: [],
    insurance: [],
    mileage: [],
    notes: [],
  });

  if (input.status === 404) {
    return { parse: { status: "none", summary: JOJ_NONE_SUMMARY }, facts: emptyFacts() };
  }
  if (input.status === 423) {
    return { parse: { status: "unknown", summary: "Copart/IAAI ieraksts ir ierobežots" }, facts: emptyFacts() };
  }
  if (input.status === 401 || input.status === 403) {
    return { parse: { status: "unknown", summary: "JoJ API atslēga nederīga vai nav pieejas" }, facts: emptyFacts() };
  }
  if (input.status === 429) {
    return { parse: { status: "unknown", summary: "JoJ API limits (1 req/s)" }, facts: emptyFacts() };
  }
  if (input.status >= 400) {
    return { parse: { status: "unknown", summary: `JoJ API HTTP ${input.status}` }, facts: emptyFacts() };
  }

  const root = asRecord(input.json);
  const data = asRecord(root.data && typeof root.data === "object" ? root.data : root);
  const lots = asArray(data.lots);
  const year = str(data.year);
  const make = named(data.manufacturer) || str(data.make);
  const model = named(data.model) || str(data.model);
  const vehicle: VinScanVehicle | undefined = year || make || model ? { make, model, year } : undefined;
  const specLines: string[] = [];
  kv(specLines, JOJ_LV.hp, str(data.hp) ? `${str(data.hp)} ZS` : "");
  kv(specLines, JOJ_LV.engine, named(data.engine));
  kv(specLines, JOJ_LV.transmission, named(data.transmission));
  kv(specLines, JOJ_LV.drive, named(data.drive_wheel));
  kv(specLines, JOJ_LV.fuel, named(data.fuel));
  kv(specLines, JOJ_LV.color, named(data.color));
  kv(specLines, JOJ_LV.body, named(data.body_type));
  kv(specLines, JOJ_LV.cylinders, str(data.cylinders));
  kv(specLines, JOJ_LV.generation, named(data.generation));
  kv(specLines, JOJ_LV.vehicleType, named(data.vehicle_type));

  const auctions: VinScanAuction[] = [];
  const mileage: Omit<VinScanMileage, "source">[] = [];
  const photos: string[] = [];
  const seenPhoto = new Set<string>();
  const facts = emptyFacts();
  facts.vehicleLine = [year, make, model].filter(Boolean).join(" ");
  const detail: string[] = [];
  if (facts.vehicleLine) detail.push(facts.vehicleLine);
  if (specLines.length) {
    detail.push(JOJ_LV.specs);
    detail.push(...specLines);
    facts.notes.push([JOJ_LV.specs, ...specLines].join("\n"));
  }
  let openUrl = "";

  for (const raw of lots) {
    const lot = asRecord(raw);
    const venue = venueFromDomain(lot.domain, lot.location);
    const lotNo = str(lot.lot);
    const date = saleDate(lot.sale_date);
    const odo = odometerLine(lot.odometer);
    const damageMain = lookupNamed(asRecord(lot.damage).main, dict.damages);
    const damageSecond = lookupNamed(asRecord(lot.damage).second, dict.damages);
    const damage = [damageMain, damageSecond].filter(Boolean).join(" / ");
    const currency = venue === "Copart FI" ? "EUR" : "USD";
    const price = formatMoney(lot.final_bid, currency) || formatMoney(lot.bid, currency);
    const { photos: lotPhotos, video } = photoList(lot.images);
    for (const url of lotPhotos) {
      if (seenPhoto.has(url) || photos.length >= AUCTION_PHOTO_BLOCK_MAX) continue;
      seenPhoto.add(url);
      photos.push(url);
    }
    const status = jojValueLv(named(lot.status));
    const auctionType = jojValueLv(named(lot.auction_type));
    const titleName = lookupNamed(lot.title, dict.titles);
    const detailedTitle = lookupNamed(lot.detailed_title, dict.titles);
    const seller = sellerLine(lot.seller);
    const loc = locationLine(lot.location);
    const branch = [named(lot.selling_branch), str(asRecord(lot.selling_branch).number)].filter(Boolean).join(" · ");
    const reserve = asRecord(lot.seller_reserve);
    const history = priceHistoryLines(lot.prices, currency);
    const title = [venue || "Izsole", lotNo ? `lots ${lotNo}` : "", damage, odo.km].filter(Boolean).join(" · ");
    const lotLines: string[] = [];
    kv(lotLines, JOJ_LV.domain, venue || named(lot.domain));
    kv(lotLines, JOJ_LV.lot, lotNo);
    kv(lotLines, JOJ_LV.status, status);
    kv(lotLines, JOJ_LV.auctionType, auctionType);
    kv(lotLines, JOJ_LV.saleDate, date ? dateLv(date) : "");
    kv(lotLines, JOJ_LV.saleDateUpdated, saleDate(lot.sale_date_updated_at) ? dateLv(saleDate(lot.sale_date_updated_at)) : "");
    kv(lotLines, JOJ_LV.bid, moneyWithTs(lot.bid, lot.bid_updated_at, currency));
    kv(lotLines, JOJ_LV.finalBid, moneyWithTs(lot.final_bid, lot.final_bid_updated_at, currency));
    kv(lotLines, JOJ_LV.buyNow, moneyWithTs(lot.buy_now, lot.buy_now_updated_at, currency));
    kv(lotLines, JOJ_LV.sellerReserve, moneyWithTs(reserve.price, reserve.updated_at, currency));
    kv(lotLines, JOJ_LV.estimateRepair, formatMoney(lot.estimate_repair_price, currency));
    kv(lotLines, JOJ_LV.preAccident, formatMoney(lot.pre_accident_price, currency));
    kv(lotLines, JOJ_LV.cleanWholesale, formatMoney(lot.clean_wholesale_price, currency));
    kv(lotLines, JOJ_LV.actualCash, formatMoney(lot.actual_cash_value, currency));
    kv(lotLines, JOJ_LV.odometer, odo.line);
    kv(lotLines, JOJ_LV.damageMain, damageMain);
    kv(lotLines, JOJ_LV.damageSecond, damageSecond);
    kv(lotLines, JOJ_LV.condition, jojValueLv(named(lot.condition)));
    kv(lotLines, JOJ_LV.airbags, named(lot.airbags));
    kv(lotLines, JOJ_LV.keys, jojYesNo(lot.keys_available));
    kv(lotLines, JOJ_LV.gradeIaai, str(lot.grade_iaai));
    kv(lotLines, JOJ_LV.title, titleName);
    kv(lotLines, JOJ_LV.detailedTitle, detailedTitle);
    kv(lotLines, JOJ_LV.note, str(lot.note));
    kv(lotLines, JOJ_LV.tags, asArray(lot.tags).map(str).filter(Boolean).join(", "));
    kv(lotLines, JOJ_LV.seller, seller.line);
    kv(lotLines, JOJ_LV.sellerType, named(lot.seller_type));
    kv(lotLines, JOJ_LV.location, loc);
    kv(lotLines, JOJ_LV.postal, str(asRecord(lot.location).postal_code));
    kv(
      lotLines,
      JOJ_LV.coords,
      [str(asRecord(lot.location).latitude), str(asRecord(lot.location).longitude)].filter(Boolean).join(", "),
    );
    kv(lotLines, JOJ_LV.offsite, jojYesNo(asRecord(lot.location).is_offsite));
    kv(lotLines, JOJ_LV.sellingBranch, branch);
    kv(lotLines, JOJ_LV.branchLink, str(asRecord(lot.selling_branch).link));
    kv(lotLines, JOJ_LV.line, str(lot.line));
    kv(lotLines, JOJ_LV.archived, lot.archived === true ? "jā" : lot.archived === false ? "nē" : "");
    kv(lotLines, JOJ_LV.createdAt, saleDate(lot.created_at) ? dateLv(saleDate(lot.created_at)) : "");
    kv(lotLines, JOJ_LV.updatedAt, saleDate(lot.updated_at) ? dateLv(saleDate(lot.updated_at)) : "");
    kv(lotLines, JOJ_LV.archivedAt, saleDate(lot.archived_at) ? dateLv(saleDate(lot.archived_at)) : "");
    kv(lotLines, JOJ_LV.timedAuction, jojYesNo(lot.is_timed_auction));
    kv(lotLines, JOJ_LV.timedStartBid, formatMoney(lot.timed_start_bid, currency));
    kv(lotLines, JOJ_LV.externalId, str(lot.external_id));
    kv(lotLines, JOJ_LV.video, video);
    kv(lotLines, JOJ_LV.youtube, str(asRecord(lot.images).video_youtube_id));
    kv(lotLines, JOJ_LV.details, detailsLine(lot.details));
    if (history.length) {
      lotLines.push(`${JOJ_LV.priceHistory}:`);
      for (const row of history) lotLines.push(`- ${row}`);
    }
    detail.push("");
    detail.push(title.slice(0, 180) || "Izsoles ieraksts");
    detail.push(...lotLines);

    auctions.push({
      title: title.slice(0, 180) || "Izsoles ieraksts",
      date: date || undefined,
      price: price || undefined,
      venue: venue || undefined,
      lot: lotNo || undefined,
      photoUrl: lotPhotos[0],
      photoCount: lotPhotos.length || undefined,
      photoUrls: lotPhotos.length ? lotPhotos : undefined,
    });
    const saleDateLv = date ? dateLv(date) : "";
    facts.sales.push({
      date: saleDateLv,
      venue: venue || named(lot.domain) || "Izsole",
      odometer: odo.km,
      price,
      status: [status, auctionType, lotNo ? `lots ${lotNo}` : ""].filter(Boolean).join(" · ") || "Izsole",
    });
    if (damage) {
      facts.damages.push({
        date: saleDateLv,
        region: loc || venue,
        amount: formatMoney(lot.estimate_repair_price, currency),
        description: damage,
      });
    }
    if (titleName || detailedTitle) {
      facts.titles.push({
        date: saleDateLv,
        region: loc || venue,
        odometer: odo.km,
        note: [titleName, detailedTitle].filter(Boolean).join(" · "),
      });
    }
    if (seller.insurance || seller.name) {
      facts.insurance.push({
        date: saleDateLv,
        label: seller.insurance ? "Apdrošinātājs" : "Pārdevējs",
        detail: seller.line || seller.name,
      });
    }
    if (odo.km && date) {
      mileage.push({ date, odometer: odo.km });
      facts.mileage.push({ date: saleDateLv, odometer: odo.km, country: str(asRecord(asRecord(lot.location).country).name) || venue });
    }
    facts.notes.push(lotLines.join("\n"));
    facts.reportDate = facts.reportDate || saleDateLv;
    if (!openUrl) openUrl = lotOpenUrl(venue, lotNo, vin);
  }

  if (!auctions.length) {
    return {
      parse: { status: "none", summary: JOJ_NONE_SUMMARY, vehicle },
      facts,
    };
  }

  const first = auctions[0];
  const bits = [
    first?.venue || "",
    first?.date?.slice(0, 4) || vehicle?.year || "",
    photos.length ? `${photos.length} foto` : auctions.length > 1 ? `${auctions.length} lots` : "",
  ].filter(Boolean);

  return {
    parse: {
      status: "found",
      summary: bits.join(", ") || "Ir izsoles ieraksts",
      detail: detail.join("\n").slice(0, 12_000),
      vehicle,
      auctions: auctions.slice(0, AUCTION_LOT_MAX),
      mileage: mileage.slice(0, AUCTION_LOT_MAX),
      media: {
        photoUrl: photos[0],
        photoCount: photos.length,
        photoUrls: photos,
      },
      flags: { photoCount: photos.length },
      openUrl: openUrl || undefined,
      jojFacts: facts,
    },
    facts,
  };
}
