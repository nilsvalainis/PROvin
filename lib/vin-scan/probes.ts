import "server-only";

import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { fetchVinSource } from "@/lib/vin-sources";
import { mapNummerpladePayload, nummerpladeApiKey } from "@/lib/vin-sources/nummerplade";
import { isVinScanSourceId, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { scanChallengeReason, scanFetch, scanFetchSmart } from "@/lib/vin-scan/http";
import {
  dsbScanFromParts,
  esynVehicleSummary,
  parseCarpassCsrf,
  parseCarpassRecalls,
  parseCsddTechScan,
  parseDsbEntryCount,
  parseDsbSearchHtml,
  parseEsynChassis,
  parseEsynInspections,
  parseNummerpladeHtml,
  parseNummerpladeProbe,
  parseTjekbilProbe,
  parseVinSourceScan,
} from "@/lib/vin-scan/parse";
import {
  probeAuchistory,
  probeBidCars,
  probeBidfax,
  probeBiluppgifter,
  probeCarfaxEu,
  probeCheckcarVin,
  probeListingHistory,
  probeLtPolice,
  probeNicb,
  probeNhtsaRecalls,
  probeOemRecall,
  probePlcAuction,
  probePoctra,
  probeRdw,
  probeRegitra,
  probeJojCopartIaai,
  probeStatVin,
  probeTraficom,
  probeVegvesen,
  probeSpeckr,
  probeVinDecode,
} from "@/lib/vin-scan/probes-extra";
import { isPlausibleListingUrl } from "@/lib/order-field-validation";
import { isValidScanPlate, vinScanPlateLabel, type VinScanPlates } from "@/lib/vin-scan/plates";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";
import { vinScanCatalogItem } from "@/lib/vin-scan/catalog";

function done(id: VinScanSourceId, ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, ctx.vin, parsed, ctx.plates);
}

function failed(id: VinScanSourceId, ctx: VinScanContext, e: unknown): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, ctx, {
    status: "unknown",
    summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt",
  });
}

function needsInput(id: VinScanSourceId, ctx: VinScanContext, kind: "vin" | keyof VinScanPlates): VinScanIndicator {
  const summary = kind === "vin" ? "Vajag VIN" : `Vajag ${vinScanPlateLabel(kind)}`;
  return done(id, ctx, { status: "needs_input", summary });
}

export function sourceNeedsInput(id: VinScanSourceId, ctx: VinScanContext): VinScanIndicator | null {
  const item = vinScanCatalogItem(id);
  const vinOk = ctx.vin.length >= 11;
  const missing = item.needs.filter((need) => {
    if (need === "vin") return !vinOk;
    if (need === "listing") return !isPlausibleListingUrl(ctx.listingUrl);
    return !isValidScanPlate(need, ctx.plates[need]);
  });
  if (missing.length === 0) return null;
  if (item.needsAny && missing.length < item.needs.length) return null;
  const first = missing[0]!;
  if (first === "listing") return done(id, ctx, { status: "needs_input", summary: "Vajag sludinājumu" });
  return needsInput(id, ctx, first === "vin" ? "vin" : first);
}

export async function probeTjekbil(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const res = await scanFetch(`https://www.tjekbil.dk/api/v3/dmr/vin/${encodeURIComponent(ctx.vin)}`, {
      headers: { accept: "application/json", referer: "https://www.tjekbil.dk/" },
    });
    return done("tjekbil", ctx, parseTjekbilProbe(res.status, res.text));
  } catch (e) {
    return failed("tjekbil", ctx, e);
  }
}

function nummerpladeFromJson(status: number, text: string): VinScanParse | null {
  if (status !== 200 || !text.trim()) return null;
  try {
    const mapped = mapNummerpladePayload(JSON.parse(text) as unknown);
    const parsed = parseNummerpladeProbe(status, text, mapped.found, mapped.message);
    return {
      ...parsed,
      mileage: mapped.mileage.map((row) => ({ date: row.date, odometer: row.odometer })),
    };
  } catch {
    return null;
  }
}

export async function probeNummerplade(ctx: VinScanContext): Promise<VinScanIndicator> {
  const key = nummerpladeApiKey();
  if (key) {
    try {
      const res = await scanFetch(`https://www.nummerplade.net/api/v1/koeretoej/${encodeURIComponent(ctx.vin)}`, {
        headers: { accept: "application/json", "X-Api-Noegle": key, referer: "https://www.nummerplade.net/" },
      });
      const fromKey = nummerpladeFromJson(res.status, res.text);
      if (fromKey && fromKey.status !== "unknown") return done("nummerplade", ctx, fromKey);
    } catch {
      /* publiskā lapa zemāk */
    }
  }
  try {
    const resultUrl = `https://www.nummerplade.net/stelnummer/${ctx.vin.toLowerCase()}.html`;
    const page = await scanFetchSmart(resultUrl, {
      timeoutMs: 45_000,
      solveUrl: "https://www.nummerplade.net/",
      sourceLabel: "nummerplade.net",
    });
    const challenge = scanChallengeReason(page);
    if (challenge) return done("nummerplade", ctx, { status: "unknown", summary: `nummerplade.net: ${challenge}` });
    const htmlParsed = parseNummerpladeHtml(page.status, page.text, ctx.vin);
    if (htmlParsed.status === "found" || htmlParsed.status === "none") {
      return done("nummerplade", ctx, { ...htmlParsed, openUrl: resultUrl });
    }
    const api = await scanFetch(`https://www.nummerplade.net/api/v1/koeretoej/${encodeURIComponent(ctx.vin)}`, {
      headers: {
        accept: "application/json",
        referer: resultUrl,
        "user-agent": page.ua || "",
      },
      cookie: page.cookie,
      proxyUrl: page.proxyUrl,
      timeoutMs: 20_000,
    });
    const fromApi = nummerpladeFromJson(api.status, api.text);
    if (fromApi && (fromApi.status === "found" || fromApi.status === "none")) {
      return done("nummerplade", ctx, { ...fromApi, openUrl: resultUrl });
    }
    return done("nummerplade", ctx, htmlParsed);
  } catch (e) {
    return failed("nummerplade", ctx, e);
  }
}

export async function probeEsyn(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const chassis = await scanFetch(`https://findsynsrapport.esyn.dk/webapi/v1/chassis/${encodeURIComponent(ctx.vin)}`, {
      headers: { accept: "application/json" },
    });
    const parsed = parseEsynChassis(chassis.status, chassis.text, ctx.vin);
    if (!parsed.ok) return done("esyn", ctx, parsed);
    const make = parsed.vehicle.make || "-";
    const list = await scanFetch(
      `https://findsynsrapport.esyn.dk/webapi/v1/chassismake/${encodeURIComponent(ctx.vin)}/${encodeURIComponent(make)}`,
      { headers: { accept: "application/json" } },
    );
    const inspections =
      list.status === 200 ? parseEsynInspections(list.text) : { status: "unknown" as const, summary: "Apskates sarakstu neizdevās nolasīt" };
    return done("esyn", ctx, esynVehicleSummary(parsed.vehicle, inspections));
  } catch (e) {
    return failed("esyn", ctx, e);
  }
}

export async function probeDsb(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const page = await scanFetch(
      `https://app.digitalservicebog.dk/search?vin=${encodeURIComponent(ctx.vin)}&country=eu`,
      { headers: { accept: "text/html" } },
    );
    if (page.status !== 200) {
      return done("dsb", ctx, { status: "unknown", summary: `Digital Servicebook atbildēja ar HTTP ${page.status}` });
    }
    const search = parseDsbSearchHtml(page.text);
    if (!search.vehicle) return done("dsb", ctx, dsbScanFromParts(search, 0));
    if (!search.servicesPath) return done("dsb", ctx, dsbScanFromParts(search, null));
    const services = await scanFetch(`https://app.digitalservicebog.dk${search.servicesPath}`, {
      headers: {
        accept: "text/html",
        "x-requested-with": "XMLHttpRequest",
        referer: `https://app.digitalservicebog.dk/search?vin=${encodeURIComponent(ctx.vin)}&country=eu`,
      },
      cookie: page.cookie,
    });
    const count = services.status === 200 ? parseDsbEntryCount(services.text) : null;
    return done("dsb", ctx, dsbScanFromParts(search, count));
  } catch (e) {
    return failed("dsb", ctx, e);
  }
}

export async function probeCarpass(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const page = await scanFetchSmart("https://public.car-pass.be/recalls", {
      headers: { accept: "text/html" },
      timeoutMs: 45_000,
      sourceLabel: "Car-Pass",
    });
    const challenge = scanChallengeReason(page);
    if (challenge) return done("carpass", ctx, { status: "unknown", summary: `Car-Pass: ${challenge}` });
    const csrf = parseCarpassCsrf(page.text);
    if (!csrf) return done("carpass", ctx, { status: "unknown", summary: "Car-Pass neatgrieza drošības žetonu" });
    const body = new URLSearchParams({ vin: ctx.vin, _csrf: csrf }).toString();
    const res = await scanFetch("https://public.car-pass.be/recalls", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": csrf,
        origin: "https://public.car-pass.be",
        referer: "https://public.car-pass.be/recalls",
        ...(page.ua ? { "user-agent": page.ua } : {}),
      },
      body,
      cookie: page.cookie,
      proxyUrl: page.proxyUrl,
    });
    const postChallenge = scanChallengeReason(res);
    if (postChallenge) return done("carpass", ctx, { status: "unknown", summary: `Car-Pass: ${postChallenge}` });
    return done("carpass", ctx, parseCarpassRecalls(res.status, res.text));
  } catch (e) {
    return failed("carpass", ctx, e);
  }
}

export async function probeCsdd(ctx: VinScanContext): Promise<VinScanIndicator> {
  const nr1 = ctx.vin || ctx.plates.lv;
  try {
    return done("csdd", ctx, parseCsddTechScan(await fetchCsddTechData(nr1)));
  } catch (e) {
    return failed("csdd", ctx, e);
  }
}

export async function probeMntEe(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    return done("mnt_ee", ctx, parseVinSourceScan(await fetchVinSource("mnt_ee", ctx.vin, ctx.plates.lv)));
  } catch (e) {
    return failed("mnt_ee", ctx, e);
  }
}

export async function probeLkfEe(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    return done("lkf_ee", ctx, parseVinSourceScan(await fetchVinSource("lkf_ee", ctx.vin)));
  } catch (e) {
    return failed("lkf_ee", ctx, e);
  }
}

export async function probeCarinfo(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    return done("carinfo", ctx, parseVinSourceScan(await fetchVinSource("carinfo", ctx.vin)));
  } catch (e) {
    return failed("carinfo", ctx, e);
  }
}

const PROBES: Record<VinScanSourceId, (ctx: VinScanContext) => Promise<VinScanIndicator> | VinScanIndicator> = {
  vin_decode: probeVinDecode,
  speckr: probeSpeckr,
  tjekbil: probeTjekbil,
  esyn: probeEsyn,
  dsb: probeDsb,
  carpass: probeCarpass,
  mnt_ee: probeMntEe,
  csdd: probeCsdd,
  listing_history: probeListingHistory,
  nummerplade: probeNummerplade,
  carinfo: probeCarinfo,
  lkf_ee: probeLkfEe,
  rdw: probeRdw,
  vegvesen: probeVegvesen,
  nhtsa_recalls: probeNhtsaRecalls,
  nicb: probeNicb,
  recall_vw: (ctx) => probeOemRecall(ctx, "vw"),
  recall_bmw: (ctx) => probeOemRecall(ctx, "bmw"),
  recall_mercedes: (ctx) => probeOemRecall(ctx, "mercedes"),
  recall_volvo: (ctx) => probeOemRecall(ctx, "volvo"),
  recall_toyota: (ctx) => probeOemRecall(ctx, "toyota"),
  biluppgifter: probeBiluppgifter,
  regitra: probeRegitra,
  traficom: probeTraficom,
  lt_itpr: probeLtPolice,
  stat_vin: probeStatVin,
  joj_copart_iaai: probeJojCopartIaai,
  bid_cars: probeBidCars,
  auchistory: probeAuchistory,
  carfax_eu: probeCarfaxEu,
  checkcar_vin: probeCheckcarVin,
  plc_auction: probePlcAuction,
  bidfax: probeBidfax,
  poctra: probePoctra,
};

export function vinScanProbeFor(id: string): ((ctx: VinScanContext) => Promise<VinScanIndicator> | VinScanIndicator) | null {
  if (!isVinScanSourceId(id)) return null;
  return PROBES[id];
}
