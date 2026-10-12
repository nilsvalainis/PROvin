import "server-only";

import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import { scanCaptchaTokenPlaceholder, scanFetch, scanFetchSmart, solveScanRecaptcha } from "@/lib/vin-scan/http";
import {
  oemBrandForVin,
  parseAuctionArchive,
  parseBiluppgifter,
  parseNicbHtml,
  parseNhtsaRecalls,
  parseVpicMakeModelYear,
  parseOemRecallHtml,
  parseRdwOpenData,
  parseRegitra,
  parseTraficom,
  parseUkMot,
  parseVegvesen,
  type OemRecallBrand,
} from "@/lib/vin-scan/parse-extra";
import { classifyCheckcarVinText, classifyPlcAuction } from "@/lib/vin-scan/parse";
import { extractInputValue, extractPageFromHtml, mergeCookieHeader } from "@/lib/vin-sources/html-extract";
import { classifyPoliceWanted } from "@/lib/vin-scan/wanted";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

function done(id: VinScanIndicator["id"], ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, ctx.vin, parsed, ctx.plates);
}

function failed(id: VinScanIndicator["id"], ctx: VinScanContext, e: unknown): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, ctx, {
    status: "unknown",
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
    const plate = ctx.plates.nl;
    const vin = ctx.vin;
    const vehicleUrl = plate
      ? jsonUrl("https://opendata.rdw.nl/resource/m9d7-ebf2.json", { kenteken: plate })
      : `https://opendata.rdw.nl/resource/m9d7-ebf2.json?$where=${encodeURIComponent(`upper(vin)='${vin}'`)}`;
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

export async function probeVegvesen(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    let last: VinScanParse | null = null;
    for (const url of VEGVESEN_URLS(ctx.vin)) {
      const res = await scanFetch(url, { headers: { accept: "application/json" }, timeoutMs: 15_000 });
      last = parseVegvesen(res.status, res.text);
      if (last.status === "found" || last.status === "none") return done("vegvesen", ctx, last);
    }
    const page = await scanFetchSmart(
      `https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/?understellsnummer=${encodeURIComponent(ctx.vin)}`,
      { timeoutMs: 20_000, sourceLabel: "vegvesen" },
    );
    last = parseVegvesen(page.status, page.text);
    return done("vegvesen", ctx, last.status === "unknown" ? { status: "unknown", summary: "vegvesen.no API prasa pilnvaru; publiskā lapa paliek cilnē" } : last);
  } catch (e) {
    return failed("vegvesen", ctx, e);
  }
}

function motApiKey(): string {
  return (
    process.env.DVSA_MOT_API_KEY?.trim() ||
    process.env.MOT_HISTORY_API_KEY?.trim() ||
    process.env.MOT_API_KEY?.trim() ||
    ""
  );
}

export async function probeUkMot(ctx: VinScanContext): Promise<VinScanIndicator> {
  const key = motApiKey();
  const plate = ctx.plates.uk;
  if (!key && !plate) {
    return done("uk_mot", ctx, {
      status: "needs_input",
      summary: "Vajag UK reģ. nr. (publiskā MOT lapa). VIN vaicājums ir DVSA API ar atslēgu",
    });
  }
  if (!key) {
    return done("uk_mot", ctx, {
      status: "skipped",
      summary: "UK MOT pēc VIN vajag DVSA_MOT_API_KEY. Publiskā lapa ir pēc numura un paliek cilnē",
    });
  }
  try {
    const query = plate
      ? `registration=${encodeURIComponent(plate)}`
      : `vin=${encodeURIComponent(ctx.vin)}`;
    const res = await scanFetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/mot-tests?${query}`, {
      headers: { accept: "application/json", "x-api-key": key },
      timeoutMs: 15_000,
    });
    const parsed = parseUkMot(res.status, res.text);
    if (parsed.status === "skipped" && plate && ctx.vin) {
      const vinRes = await scanFetch(
        `https://history.mot.api.gov.uk/v1/trade/vehicles/mot-tests?vin=${encodeURIComponent(ctx.vin)}`,
        { headers: { accept: "application/json", "x-api-key": key }, timeoutMs: 15_000 },
      );
      return done("uk_mot", ctx, parseUkMot(vinRes.status, vinRes.text));
    }
    return done("uk_mot", ctx, parsed);
  } catch (e) {
    return failed("uk_mot", ctx, e);
  }
}

async function nhtsaRecallsForVin(vin: string): Promise<VinScanParse> {
  const decoded = await scanFetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
    { headers: { accept: "application/json" } },
  );
  const ids = parseVpicMakeModelYear(decoded.status, decoded.text);
  if (!ids) return { status: "unknown", summary: "NHTSA vPIC VIN dekodēšana neizdevās" };
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
  try {
    const plate = ctx.plates.lt;
    const url = `https://www.regitra.lt/lt/e-paslaugos/transporto-priemones-duomenu-patikra?plate=${encodeURIComponent(plate)}&vin=${encodeURIComponent(ctx.vin)}`;
    const page = await scanFetchSmart(url, { timeoutMs: 25_000, sourceLabel: "Regitra" });
    return done("regitra", ctx, parseRegitra(page.status, page.text));
  } catch (e) {
    return failed("regitra", ctx, e);
  }
}

export async function probeTraficom(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const plate = ctx.plates.fi;
    const url = `https://www.traficom.fi/en/transport/road/vehicle-information?plate=${encodeURIComponent(plate)}&vin=${encodeURIComponent(ctx.vin)}`;
    const page = await scanFetchSmart(url, { timeoutMs: 25_000, sourceLabel: "Traficom" });
    return done("traficom", ctx, parseTraficom(page.status, page.text));
  } catch (e) {
    return failed("traficom", ctx, e);
  }
}

async function probeWanted(
  id: "vp_wanted" | "lt_itpr",
  ctx: VinScanContext,
  url: string,
): Promise<VinScanIndicator> {
  try {
    const page = await scanFetchSmart(url, { timeoutMs: 20_000, sourceLabel: id });
    const text = extractPageFromHtml(page.text).text || page.text.replace(/<[^>]+>/g, " ");
    const parsed = classifyPoliceWanted(id, text, ctx.vin);
    if (parsed) return done(id, ctx, parsed);
    const classified = classifyBrowserProbe(id, text, ctx.vin);
    if (classified) return done(id, ctx, classified);
    return done(id, ctx, { status: "unknown", summary: "Policijas lapa nav atpazīta" });
  } catch (e) {
    return failed(id, ctx, e);
  }
}

export async function probeVpWanted(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeWanted("vp_wanted", ctx, `https://www.vp.gov.lv/lv/mekletie-transportlidzekli?vin=${encodeURIComponent(ctx.vin)}`);
}

export async function probeLtPolice(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeWanted(
    "lt_itpr",
    ctx,
    `https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=${encodeURIComponent(ctx.vin)}`,
  );
}

async function probeHtmlSource(
  id: VinScanIndicator["id"],
  ctx: VinScanContext,
  url: string,
  classify: (text: string) => VinScanParse | null,
): Promise<VinScanIndicator> {
  try {
    const page = await scanFetchSmart(url, { timeoutMs: 20_000, sourceLabel: id });
    const text = extractPageFromHtml(page.text).text || page.text.replace(/<[^>]+>/g, " ");
    const parsed = classify(text);
    if (parsed) return done(id, ctx, { ...parsed, openUrl: page.status === 200 ? url : parsed.openUrl });
    return done(id, ctx, { status: "unknown", summary: "Lapa nav atpazīta" });
  } catch (e) {
    return failed(id, ctx, e);
  }
}

export async function probeStatVin(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource("stat_vin", ctx, `https://stat.vin/cars/${encodeURIComponent(ctx.vin)}`, (text) => {
    const r = classifyBrowserProbe("stat_vin", text, ctx.vin);
    return r ? { status: r.status, summary: r.summary } : null;
  });
}

export async function probeBidCars(ctx: VinScanContext): Promise<VinScanIndicator> {
  return probeHtmlSource("bid_cars", ctx, `https://bid.cars/en/search?q=${encodeURIComponent(ctx.vin)}`, (text) => {
    const r = classifyBrowserProbe("bid_cars", text, ctx.vin);
    return r ? { status: r.status, summary: r.summary } : null;
  });
}

export async function probeAuchistory(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = `https://auchistory.com/?vin=${encodeURIComponent(ctx.vin)}`;
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
  try {
    const page = await scanFetchSmart(`https://bidfax.info/?s=${encodeURIComponent(ctx.vin)}`, {
      timeoutMs: 20_000,
      sourceLabel: "BidFax",
    });
    return done("bidfax", ctx, parseAuctionArchive(page.status, page.text, ctx.vin, "BidFax"));
  } catch (e) {
    return failed("bidfax", ctx, e);
  }
}

export async function probePoctra(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const page = await scanFetchSmart(`https://poctra.com/search/${encodeURIComponent(ctx.vin)}`, {
      timeoutMs: 20_000,
      sourceLabel: "Poctra",
    });
    return done("poctra", ctx, parseAuctionArchive(page.status, page.text, ctx.vin, "Poctra"));
  } catch (e) {
    return failed("poctra", ctx, e);
  }
}
