/**
 * `/lot-vins` tīrā loģika: lotes URL validācija un VIN izvilkšana no ielogotas lotes lapas.
 * Autobid: `__NUXT_DATA__` (devalue masīvs) atribūts «Chassis number» / «Vehicle Identification No.».
 * Openlane: lotes JSON ar `ChassisNumber` (meklēšanā tas ir null, lotes lapā ir).
 * Rezerves ceļš abiem: lapas teksts pēc etiķetes.
 */
import { openlaneEnglishUrl } from "./platforms/openlane-logic.mjs";

export const LOT_VIN_PLATFORMS = ["openlane", "autobid"];
export const LOT_VIN_MAX_URLS = 12;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_LABEL_RE = /chassis|vehicle identification|fahrgestell|\bFIN\b|\bVIN\b/i;
const VIN_SHORT_LABEL_RE = /short|kurz|сокращ/i;
const MILEAGE_LABEL_RE = /mileage|kilometerstand|laufleistung/i;
const FIRST_REG_LABEL_RE = /first registration|erstzulassung/i;

/** Tīrs 17 zīmju VIN lielajiem burtiem vai "". */
export function cleanVin(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const v = String(raw).replace(/[\s-]/g, "").toUpperCase();
  return VIN_RE.test(v) ? v : "";
}

/** Derīgs lotes URL platformai (normalizēts) vai "". */
export function validLotUrl(platform, raw) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (platform === "openlane") {
      if (!/(^|\.)openlane\.(eu|com)$/.test(host)) return "";
      const q = (u.searchParams.get("auctionId") ?? u.searchParams.get("auctionid") ?? "").trim();
      const byQuery = /\/car\/info\/?$/i.test(u.pathname) && /^\d{4,}$/.test(q);
      const byPath = /\/car\/\d{4,}\/?$/i.test(u.pathname);
      if (!byQuery && !byPath) return "";
      return openlaneEnglishUrl(u.toString());
    }
    if (platform === "autobid") {
      if (!/(^|\.)autobid\.(de|eu)$/.test(host)) return "";
      if (!/\/item\/[a-z0-9][a-z0-9-]*(?:\/details)?\/?$/i.test(u.pathname)) return "";
      u.hash = "";
      return u.toString();
    }
    return "";
  } catch {
    return "";
  }
}

function kmFromText(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw > 0 && raw < 2_000_000 ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  const m = raw.match(/\d[\d.,\s ]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 2_000_000 ? n : null;
}

function shortText(raw, max = 160) {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function emptyLot() {
  return { vin: "", mileageKm: null, firstRegistration: "", title: "" };
}

/** Autobid `__NUXT_DATA__` teksts -> {vin, mileageKm, firstRegistration, title}. */
export function autobidLotFromNuxt(nuxtText) {
  const out = emptyLot();
  let arr;
  try {
    arr = JSON.parse(nuxtText);
  } catch {
    return out;
  }
  if (!Array.isArray(arr)) return out;
  const deref = (v) => (Number.isInteger(v) && v >= 0 && v < arr.length ? arr[v] : v);
  for (const node of arr) {
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    if (!("name" in node) || !("value" in node || "rawValue" in node)) continue;
    const name = deref(node.name);
    if (typeof name !== "string") continue;
    const values = [deref(node.value), deref(node.rawValue)];
    if (!out.vin && VIN_LABEL_RE.test(name) && !VIN_SHORT_LABEL_RE.test(name)) {
      for (const v of values) {
        const vin = cleanVin(v);
        if (vin) {
          out.vin = vin;
          break;
        }
      }
    } else if (out.mileageKm == null && MILEAGE_LABEL_RE.test(name)) {
      for (const v of values) {
        const km = kmFromText(v);
        if (km != null) {
          out.mileageKm = km;
          break;
        }
      }
    } else if (!out.firstRegistration && FIRST_REG_LABEL_RE.test(name)) {
      const v = values.find((x) => typeof x === "string" && /\d{4}/.test(x));
      if (v) out.firstRegistration = shortText(v, 20);
    }
  }
  return out;
}

/** Openlane lotes JSON (jebkurā dziļumā) -> {vin, mileageKm, firstRegistration, title}. */
export function openlaneLotFromJson(json) {
  const out = emptyLot();
  const seen = new Set();
  const walk = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 8 || seen.has(node) || out.vin) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 200)) walk(item, depth + 1);
      return;
    }
    const vin = cleanVin(node.ChassisNumber ?? node.chassisNumber ?? node.Vin ?? node.VIN);
    if (vin) {
      out.vin = vin;
      out.mileageKm = kmFromText(node.Mileage ?? node.mileage);
      const reg = node.DateFirstRegistration ?? node.dateFirstRegistration;
      out.firstRegistration = typeof reg === "string" ? reg.slice(0, 10) : "";
      out.title = shortText(node.CarName ?? node.carName);
      return;
    }
    for (const value of Object.values(node)) walk(value, depth + 1);
  };
  walk(json, 0);
  return out;
}

/**
 * VIN no redzamā lapas teksta: etiķete, tad 17 zīmes. «VIN (short) 329770» netiek ņemts,
 * jo aiz etiķetes nav pilna VIN.
 */
export function vinFromPageText(text) {
  if (typeof text !== "string" || !text) return "";
  const re =
    /(?:vehicle identification no\.?|chassis number|chassis no\.?|fahrgestellnummer|номер шасси|\bFIN\b|\bVIN\b)\s*:?\s*([A-Za-z0-9]{17})(?![A-Za-z0-9])/gi;
  for (const m of text.matchAll(re)) {
    const vin = cleanVin(m[1]);
    if (vin) return vin;
  }
  return "";
}

/** Lapa vairs nav šī lote: pāradresēts prom vai «not found». */
export function lotLooksGone(platform, askedUrl, finalUrl, text, httpStatus) {
  if (httpStatus === 404 || httpStatus === 410) return true;
  try {
    const asked = new URL(askedUrl);
    const final = new URL(finalUrl || askedUrl);
    if (platform === "openlane") {
      const id = asked.searchParams.get("auctionId") ?? asked.pathname.match(/\/car\/(\d{4,})/)?.[1] ?? "";
      const stillLot = /\/car\//i.test(final.pathname) && (!id || final.href.includes(id));
      if (!stillLot) return true;
    }
    if (platform === "autobid" && !/\/item\//i.test(final.pathname)) return true;
  } catch {
    /* URL nederīgs - spriežam pēc teksta */
  }
  return /page not found|car (?:is )?no longer available|auction (?:has )?ended and|item not found|artikel nicht gefunden|404 not found/i.test(
    String(text ?? "").slice(0, 4_000),
  );
}

/** Viens rezultāta ieraksts pēc līguma. */
export function lotVinResult(url, lot, opts = {}) {
  const vin = cleanVin(lot?.vin ?? "");
  const status = opts.status ?? (vin ? "ok" : "no_vin");
  return {
    url,
    status,
    vin: status === "ok" ? vin : "",
    mileageKm: typeof lot?.mileageKm === "number" ? lot.mileageKm : null,
    firstRegistration: typeof lot?.firstRegistration === "string" ? lot.firstRegistration : "",
    title: typeof lot?.title === "string" ? lot.title : "",
  };
}

/** Žurnālam: tikai pēdējās 6 zīmes. */
export function vinTail(vin) {
  return vin ? `…${String(vin).slice(-6)}` : "-";
}

/**
 * Partijas secība. `slots`: ievades secībā `{ raw, url }`, kur `url` ir normalizēta saite vai "" (nederīga).
 * Rezultāti ir tādā pašā secībā un skaitā; `url` atkārto ievades virkni burtiski.
 * `deps.readOne(url)` -> `{ result }` vai `{ stop: "blocked" | "login_required", note }`.
 * `deps.countOpen()` atgriež true, ja dienas limits pilns (skaita tikai reāli atvērtās lapas).
 * Pēc pārtraukuma vai limita atlikušās saites saņem status "error".
 */
export async function runLotVinBatch(platform, slots, deps) {
  const log = deps.log ?? (() => undefined);
  const results = [];
  let opened = 0;
  let stop = null;
  for (const slot of slots) {
    if (stop || !slot.url) {
      results.push(lotVinResult(slot.raw, null, { status: "error" }));
      continue;
    }
    if (deps.countOpen && deps.countOpen()) {
      stop = { status: "ok", note: deps.limitNote ?? "dienas limits" };
      results.push(lotVinResult(slot.raw, null, { status: "error" }));
      continue;
    }
    if (opened > 0 && deps.pause) await deps.pause(2_000, 5_000);
    opened += 1;
    const r = await deps.readOne(slot.url);
    if (r.stop) {
      log(`${platform} lot-vins pārtraukts pie ${results.length + 1}/${slots.length}: ${r.stop} ${r.note}`);
      stop = { status: r.stop, note: `${r.stop}: ${r.note}` };
      results.push(lotVinResult(slot.raw, null, { status: "error" }));
      continue;
    }
    results.push({ ...r.result, url: slot.raw });
    log(`${platform} lot-vins ${results.length}/${slots.length} ${r.result.status} ${vinTail(r.result.vin)}${r.note ? ` ${r.note}` : ""}`);
  }
  return { status: stop ? stop.status : "ok", note: stop ? stop.note : "", results, opened };
}
