import "server-only";

import { canonicalizeListingUrl } from "@/lib/order-field-validation";
import { fetchListingPriceHistory } from "@/lib/listing-price-history";
import { vinScanParseFromListingHistory } from "@/lib/vin-scan/listing-history";
import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import { poctraSearchUrl } from "@/lib/vin-scan/catalog";
import { fetchAuctionVinLots } from "@/lib/vin-scan/auction-vin-providers";
import { statVinBrowserLane } from "@/lib/vin-scan/stat-vin-browser";
import { scanCaptchaTokenPlaceholder, scanChallengeReason, scanFetch, scanFetchSmart, solveScanRecaptcha } from "@/lib/vin-scan/http";
import { fetchVinScanAuctionPage, isVinScanRelayUrl } from "@/lib/vin-scan/listings-page-relay";
import { fetchBiluppgifterApi } from "@/lib/vin-scan/biluppgifter-api";
import {
  oemBrandForVin,
  parseAuctionArchive,
  parseBiluppgifter,
  parseNicbHtml,
  parseNhtsaRecalls,
  parseVpicMakeModelYear,
  parseOemRecallHtml,
  parseRdwOpenData,
  parseVegvesen,
  type OemRecallBrand,
} from "@/lib/vin-scan/parse-extra";
import { parseNhtsaDecode } from "@/lib/vin-scan/parse";
import { decodeVinLocal, mergeVinDecodeWithVpic, vinDecodeParseFromLocal } from "@/lib/vin-scan/vin-decode";
import { classifyCheckcarVinText, classifyPlcAuction } from "@/lib/vin-scan/parse";
import { extractHtmlInputFields, extractInputValue, extractPageFromHtml, mergeCookieHeader } from "@/lib/vin-sources/html-extract";
import { classifyPoliceWanted } from "@/lib/vin-scan/wanted";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

function done(id: VinScanIndicator["id"], ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, ctx.vin, parsed, ctx.plates);
}

function failed(id: VinScanIndicator["id"], ctx: VinScanContext, e: unknown): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, ctx, {
    status: timedOut ? "timeout" : "unknown",
    summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt",
  });
}

function jsonUrl(base: string, params: Record<string, string>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function getJson(url: string, timeoutMs = 12_000): Promise<{ status: number; data: unknown; text: string }> {
  const res = await scanFetch(url, { headers: { accept: "application/json" }, timeoutMs });
  let data: unknown = null;
  try {
    data = JSON.parse(res.text) as unknown;
  } catch {
    data = null;
  }
  return { status: res.status, data, text: res.text };
}

export async function probeRdw(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const plate = ctx.plates.nl.replace(/[\s-]/g, "").toUpperCase();
    if (!plate) return done("rdw", ctx, { status: "needs_input", summary: "Vajag NL numuru" });
    const vehicleUrl = jsonUrl("https://opendata.rdw.nl/resource/m9d7-ebf2.json", { kenteken: plate });
    const kentekenAfter = async (rows: unknown): Promise<string> => {
      const first = Array.isArray(rows) && rows[0] && typeof rows[0] === "object" ? (rows[0] as { kenteken?: string }) : null;
      return String(first?.kenteken || plate || "").replace(/[\s-]/g, "").toUpperCase();
    };
    const vehicle = await getJson(vehicleUrl);
    if (vehicle.status !== 200) return done("rdw", ctx, { status: "unknown", summary: `RDW HTTP ${vehicle.status}` });
    const kenteken = await kentekenAfter(vehicle.data);
    const keuringP = kenteken
      ? getJson(jsonUrl("https://opendata.rdw.nl/resource/aiee-iswj.json", { kenteken }))
      : Promise.resolve({ status: 200, data: [], text: "[]" });
    const recallP = kenteken
      ? getJson(jsonUrl("https://opendata.rdw.nl/resource/t49b-isb7.json", { kenteken }))
      : Promise.resolve({ status: 200, data: [], text: "[]" });
    const [keuring, recalls] = await Promise.all([keuringP, recallP]);
    return done(
      "rdw",
      ctx,
      parseRdwOpenData({
        vehicle: vehicle.data,
        keuring: keuring.status === 200 ? keuring.data : [],
        recalls: recalls.status === 200 ? recalls.data : [],
      }),
    );
  } catch (e) {
    return failed("rdw", ctx, e);
  }
}

const VEGVESEN_URLS = (vin: string) => [
  `https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?understellsnummer=${encodeURIComponent(vin)}`,
  `https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata?understellsnummer=${encodeURIComponent(vin)}`,
];

function vegvesenApiKey(): string {
  return process.env.VEGVESEN_API_KEY?.trim() ?? "";
}

export async function probeVegvesen(ctx: VinScanContext): Promise<VinScanIndicator> {
  const key = vegvesenApiKey();
  if (!key) {
    return done("vegvesen", ctx, { status: "config_missing", summary: "vegvesen.no: nav VEGVESEN_API_KEY" });
  }
  try {
    let last: VinScanParse | null = null;
    for (const url of VEGVESEN_URLS(ctx.vin)) {
      const res = await scanFetch(url, {
        headers: { accept: "application/json", "SVV-Authorization": key },
        timeoutMs: 15_000,
      });
      last = parseVegvesen(res.status, res.text);
      if (last.status === "found" || last.status === "none") return done("vegvesen", ctx, last);
    }
    return done("vegvesen", ctx, last ?? { status: "unknown", summary: "vegvesen.no: tukša atbilde" });
  } catch (e) {
    return failed("vegvesen", ctx, e);
  }
}

async function nhtsaRecallsForVin(vin: string): Promise<VinScanParse> {
  const decoded = await scanFetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
    { headers: { accept: "application/json" } },
  );
  const local = decodeVinLocal(vin);
  const ids =
    parseVpicMakeModelYear(decoded.status, decoded.text) ??
    (local.ok && local.make && local.year ? { make: local.make, model: local.model, year: local.year } : null);
  if (!ids) return { status: "unknown", summary: "NHTSA vPIC VIN dekodēšana neizdevās" };
  if (!ids.model) {
    return {
      status: "none",
      summary: `NHTSA atsaukumu nav (${[ids.year, ids.make].filter(Boolean).join(" ")})`.trim(),
      vehicle: { make: ids.make, model: "", year: ids.year },
    };
  }
  const rec = await scanFetch(
    `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(ids.make)}&model=${encodeURIComponent(ids.model)}&modelYear=${encodeURIComponent(ids.year)}`,
    { headers: { accept: "application/json" } },
  );
  const parsed = parseNhtsaRecalls(rec.status, rec.text);
  if (parsed.status === "none") {
    return {
      ...parsed,
      summary: `NHTSA atsaukumu nav (${ids.year} ${ids.make} ${ids.model})`.trim(),
      vehicle: { make: ids.make, model: ids.model, year: ids.year },
    };
  }
  if (parsed.status === "found") {
    return { ...parsed, vehicle: { make: ids.make, model: ids.model, year: ids.year } };
  }
  return parsed;
}

export async function probeNhtsaRecalls(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    return done("nhtsa_recalls", ctx, await nhtsaRecallsForVin(ctx.vin));
  } catch (e) {
    return failed("nhtsa_recalls", ctx, e);
  }
}

export async function probeVinDecode(ctx: VinScanContext): Promise<VinScanIndicator> {
  const local = decodeVinLocal(ctx.vin);
  const fallback = vinDecodeParseFromLocal(local);
  try {
    const res = await scanFetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(ctx.vin)}?format=json`,
      { headers: { accept: "application/json" }, timeoutMs: 10_000 },
    );
    const vpic = parseNhtsaDecode(res.status, res.text);
    return done("vin_decode", ctx, mergeVinDecodeWithVpic(local, vpic));
  } catch {
    return done("vin_decode", ctx, fallback);
  }
}

const OEM_META: Record<OemRecallBrand, { id: VinScanIndicator["id"]; label: string; url: (vin: string) => string }> = {
  vw: {
    id: "recall_vw",
    label: "VW Group",
    url: (vin) => `https://www.volkswagen.co.uk/en/owners-and-services/recalls.html?vin=${encodeURIComponent(vin)}`,
  },
  bmw: {
    id: "recall_bmw",
    label: "BMW",
    url: (vin) => `https://www.bmwusa.com/recall.html?vin=${encodeURIComponent(vin)}`,
  },
  mercedes: {
    id: "recall_mercedes",
    label: "Mercedes",
    url: (vin) => `https://www.mbusa.com/en/recall?vin=${encodeURIComponent(vin)}`,
  },
  volvo: {
    id: "recall_volvo",
    label: "Volvo",
    url: (vin) => `https://www.volvocars.com/intl/support/car/recalls?vin=${encodeURIComponent(vin)}`,
  },
  toyota: {
    id: "recall_toyota",
    label: "Toyota",
    url: (vin) => `https://www.toyota.com/recall/?vin=${encodeURIComponent(vin)}`,
  },
};

export async function probeOemRecall(ctx: VinScanContext, brand: OemRecallBrand): Promise<VinScanIndicator> {
  const meta = OEM_META[brand];
  const match = oemBrandForVin(ctx.vin);
  if (match !== brand) {
    return done(meta.id, ctx, { status: "skipped", summary: "Cits ražotājs" });
  }
  try {
    const fromNhtsa = await nhtsaRecallsForVin(ctx.vin);
    if (fromNhtsa.status === "found" || fromNhtsa.status === "none") {
      return done(meta.id, ctx, {
        ...fromNhtsa,
        summary: fromNhtsa.status === "found" ? `${meta.label}: ${fromNhtsa.summary}` : `${meta.label}: NHTSA atsaukumu nav`,
      });
    }
    const page = await scanFetchSmart(meta.url(ctx.vin), { timeoutMs: 20_000, sourceLabel: meta.label });
    return done(meta.id, ctx, parseOemRecallHtml(page.status, page.text, ctx.vin, meta.label));
  } catch (e) {
    return failed(meta.id, ctx, e);
  }
}

export async function probeNicb(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = "https://www.nicb.org/vincheck";
  try {
    const page = await scanFetchSmart(`${url}?vin=${encodeURIComponent(ctx.vin)}`, {
      timeoutMs: 25_000,
      solveUrl: url,
      sourceLabel: "NICB",
    });
    const key = scanCaptchaTokenPlaceholder(page.text);
    if (key?.kind === "recaptcha_v2") {
      const solved = await solveScanRecaptcha(url, key.siteKey, "NICB");
      if (!solved.ok) return done("nicb", ctx, { status: "unknown", summary: solved.reason });
      const formKey = extractInputValue(page.text, "form_build_id") || extractInputValue(page.text, "form_id");
      const body = new URLSearchParams({
        vin: ctx.vin,
        "g-recaptcha-response": solved.token,
        ...(formKey ? { form_build_id: extractInputValue(page.text, "form_build_id") } : {}),
      }).toString();
      const posted = await scanFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://www.nicb.org",
          referer: url,
          "user-agent": solved.ua,
        },
        body,
        cookie: mergeCookieHeader(page.cookie, solved.cookie),
        timeoutMs: 25_000,
      });
      return done("nicb", ctx, parseNicbHtml(posted.text, ctx.vin));
    }
    return done("nicb", ctx, parseNicbHtml(page.text, ctx.vin));
  } catch (e) {
    return failed("nicb", ctx, e);
  }
}

export async function probeBiluppgifter(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const api = await fetchBiluppgifterApi(ctx.vin);
    if (api) {
      if (!api.found) return done("biluppgifter", ctx, { status: "none", summary: api.message || "biluppgifter API: nav" });
      return done("biluppgifter", ctx, {
        status: "found",
        summary: api.message,
        vehicle: api.vehicle,
        mileage: api.odometer ? [{ date: "", odometer: api.odometer }] : undefined,
        flags: { registrationCountry: "SE" },
      });
    }
    const page = await scanFetchSmart(`https://biluppgifter.se/${encodeURIComponent(ctx.vin)}`, {
      timeoutMs: 20_000,
      sourceLabel: "biluppgifter.se",
    });
    return done("biluppgifter", ctx, parseBiluppgifter(page.status, page.text, ctx.vin));
  } catch (e) {
    return failed("biluppgifter", ctx, e);
  }
}

export async function probeRegitra(ctx: VinScanContext): Promise<VinScanIndicator> {
  return done("regitra", ctx, {
    status: "browser_only",
    summary: "Regitra: pārbaude ir forma pārlūkā, serveris POST nesaņem",
  });
}

export async function probeTraficom(ctx: VinScanContext): Promise<VinScanIndicator> {
  return done("traficom", ctx, {
    status: "browser_only",
    summary: "Traficom: Suomi.fi forma pārlūkā, serveris POST nesaņem",
  });
}

const LT_POLICE_URL = "https://www.epolicija.lt/itpr_paieska/transportas_lt.php";

function readPolicePage(html: string, vin: string): VinScanParse {
  const text = extractPageFromHtml(html).text || html.replace(/<[^>]+>/g, " ");
  const parsed = classifyPoliceWanted("lt_itpr", text, vin);
  if (parsed) return parsed;
  const classified = classifyBrowserProbe("lt_itpr", text, vin);
  if (classified) return classified;
  return { status: "unknown", summary: "Policijas lapa nav atpazīta" };
}

export async function probeLtPolice(ctx: VinScanContext): Promise<VinScanIndicator> {
  const getUrl = `${LT_POLICE_URL}?knr=${encodeURIComponent(ctx.vin)}`;
  try {
    const page = await scanFetchSmart(getUrl, {
      timeoutMs: 45_000,
      solveUrl: LT_POLICE_URL,
      sourceLabel: "LT policija",
    });
    const challenge = scanChallengeReason(page);
    if (challenge) return done("lt_itpr", ctx, { status: "unknown", summary: `epolicija.lt: ${challenge}` });
    const first = readPolicePage(page.text, ctx.vin);
    if (first.status === "found" || first.status === "none") return done("lt_itpr", ctx, first);
    const fields = extractHtmlInputFields(page.text);
    fields.knr = ctx.vin;
    if (!fields.vnr) fields.vnr = "";
    const body = new URLSearchParams(fields).toString();
    const posted = await scanFetch(LT_POLICE_URL, {
      method: "POST",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://www.epolicija.lt",
        referer: getUrl,
        ...(page.ua ? { "user-agent": page.ua } : {}),
      },
      body,
      cookie: page.cookie,
      proxyUrl: page.proxyUrl,
      timeoutMs: 25_000,
    });
    const postChallenge = scanChallengeReason(posted);
    if (postChallenge) return done("lt_itpr", ctx, { status: "unknown", summary: `epolicija.lt: ${postChallenge}` });
    return done("lt_itpr", ctx, readPolicePage(posted.text, ctx.vin));
  } catch (e) {
    return failed("lt_itpr", ctx, e);
  }
}

async function fetchAuctionHtml(url: string, sourceLabel: string) {
  if (isVinScanRelayUrl(url)) {
    return fetchVinScanAuctionPage(url, () => scanFetch(url, { timeoutMs: 20_000 }));
  }
  return scanFetchSmart(url, { timeoutMs: 20_000, sourceLabel });
}

async function probeHtmlSource(
  id: VinScanIndicator["id"],
  ctx: VinScanContext,
  url: string,
  classify: (text: string) => VinScanParse | null,
): Promise<VinScanIndicator> {
  try {
    const page = await fetchAuctionHtml(url, id);
    // Cloudflare / bloķēts: skaidrs iemesls, nevis „Lapa nav atpazīta” (agrāk parsēja izaicinājuma lapu).
    const challenge = scanChallengeReason(page);
    if (challenge) {
      return done(id, ctx, {
        status: "unknown",
        summary: `Avots bloķē serveri - atver pārlūkā (${challenge})`,
        openUrl: url,
      });
    }
    if (page.status === 403 || page.status === 429) {
      return done(id, ctx, {
        status: "unknown",
        summary: `Avots bloķē serveri - atver pārlūkā (HTTP ${page.status})`,
        openUrl: url,
      });
    }
    const text = extractPageFromHtml(page.text).text || page.text.replace(/<[^>]+>/g, " ");
    const parsed = classify(text);
    if (parsed) return done(id, ctx, { ...parsed, openUrl: page.status === 200 ? url : parsed.openUrl });
    return done(id, ctx, { status: "unknown", summary: "Avots prasa pārlūku - atver saiti", openUrl: url });
  } catch (e) {
    return failed(id, ctx, e);
  }
}

export async function probeJojCopartIaai(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    return done("joj_copart_iaai", ctx, await fetchAuctionVinLots(ctx.vin, { listingUrl: ctx.listingUrl }));
  } catch (e) {
    return failed("joj_copart_iaai", ctx, e);
  }
}

export async function probeStatVin(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = `https://stat.vin/cars/${encodeURIComponent(ctx.vin)}`;
  // Datucentra IP (relejs, Fixie, Vercel) saņem HTTP 403 Code 007. Dati nāk no pārlūka.
  return done("stat_vin", ctx, { ...statVinBrowserLane(), openUrl: url });
}

export async function probeBidCars(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource("bid_cars", ctx, `https://bid.cars/en/search?q=${encodeURIComponent(ctx.vin)}`, (text) => {
    const r = classifyBrowserProbe("bid_cars", text, ctx.vin);
    return r ? { status: r.status, summary: r.summary } : null;
  });
}

export async function probeAuchistory(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = `https://auchistory.com/?s=${encodeURIComponent(ctx.vin)}`;
  try {
    const page = await scanFetchSmart(url, { timeoutMs: 25_000, solveUrl: "https://auchistory.com/", sourceLabel: "AucHistory" });
    const key = scanCaptchaTokenPlaceholder(page.text);
    let html = page.text;
    if (key?.kind === "recaptcha_v2") {
      const solved = await solveScanRecaptcha("https://auchistory.com/", key.siteKey, "AucHistory");
      if (solved.ok) {
        const posted = await scanFetch("https://auchistory.com/", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            origin: "https://auchistory.com",
            referer: url,
            "user-agent": solved.ua,
          },
          body: new URLSearchParams({ vin: ctx.vin, "g-recaptcha-response": solved.token }).toString(),
          cookie: mergeCookieHeader(page.cookie, solved.cookie),
          timeoutMs: 25_000,
        });
        html = posted.text;
      }
    }
    const text = extractPageFromHtml(html).text;
    const r = classifyBrowserProbe("auchistory", text, ctx.vin);
    if (r) return done("auchistory", ctx, r);
    return done("auchistory", ctx, parseAuctionArchive(page.status, html, ctx.vin, "AucHistory"));
  } catch (e) {
    return failed("auchistory", ctx, e);
  }
}

export async function probeCarfaxEu(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource(
    "carfax_eu",
    ctx,
    `https://www.carfax.eu/preview-page?vin=${encodeURIComponent(ctx.vin)}`,
    (text) => {
      const r = classifyBrowserProbe("carfax_eu", text, ctx.vin);
      return r ? { status: r.status, summary: r.summary } : null;
    },
  );
}

export async function probeCheckcarVin(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource(
    "checkcar_vin",
    ctx,
    `https://checkcar.vin/report/check/${encodeURIComponent(ctx.vin)}`,
    (text) => classifyCheckcarVinText(text, ctx.vin),
  );
}

export async function probePlcAuction(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource("plc_auction", ctx, `https://plc.auction/?vin=${encodeURIComponent(ctx.vin)}`, classifyPlcAuction);
}

export async function probeBidfax(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = `https://bidfax.info/?s=${encodeURIComponent(ctx.vin)}`;
  try {
    const page = await fetchAuctionHtml(url, "BidFax");
    const challenge = scanChallengeReason(page);
    if (challenge) {
      return done("bidfax", ctx, {
        status: "unknown",
        summary: `BidFax: avots bloķē serveri - atver pārlūkā (${challenge})`,
        openUrl: url,
      });
    }
    return done("bidfax", ctx, { ...parseAuctionArchive(page.status, page.text, ctx.vin, "BidFax"), openUrl: url });
  } catch (e) {
    return failed("bidfax", ctx, e);
  }
}

export async function probePoctra(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = poctraSearchUrl(ctx.vin);
  try {
    const page = await fetchAuctionHtml(url, "Poctra");
    const challenge = scanChallengeReason(page);
    if (challenge) {
      return done("poctra", ctx, {
        status: "unknown",
        summary: `Poctra: avots bloķē serveri - atver pārlūkā (${challenge})`,
        openUrl: url,
      });
    }
    return done("poctra", ctx, { ...parseAuctionArchive(page.status, page.text, ctx.vin, "Poctra"), openUrl: url });
  } catch (e) {
    return failed("poctra", ctx, e);
  }
}

export async function probeListingHistory(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const snap = await fetchListingPriceHistory(canonicalizeListingUrl(ctx.listingUrl));
    return done("listing_history", ctx, vinScanParseFromListingHistory(snap));
  } catch (e) {
    return failed("listing_history", ctx, e);
  }
}
