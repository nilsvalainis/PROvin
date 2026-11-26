import "server-only";

import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { fetchVinSource } from "@/lib/vin-sources";
import { fetchTjekbilDmrRaw, fetchTjekbilExtras } from "@/lib/vin-sources/tjekbil";
import type { TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";
import { tjekbilScanWithExtras } from "@/lib/vin-scan/tjekbil-scan";
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
  probeBidCars,
  probeBidfax,
  probeBiluppgifter,
  probeCarfaxEu,
  probeCheckcarVin,
  probeListingHistory,
  probeNicb,
  probeNhtsaRecalls,
  probeOemRecall,
  probePlcAuction,
  probePoctra,
  probeRdw,
  probeRegitra,
  probeJojCopartIaai,
  probeStatVin,
  probeThecarapi,
  probeTraficom,
  probeVegvesen,
  probeVinDecode,
} from "@/lib/vin-scan/probes-extra";
import { probeCzRsv, probeDvsaMot } from "@/lib/vin-scan/probes-cz-uk";
import { probeEuSafetyGate } from "@/lib/vin-scan/probes-eu-recalls";
import { probeAutodnaPrecheck } from "@/lib/vin-scan/probe-autodna-precheck";
import { isPlausibleListingUrl } from "@/lib/order-field-validation";
import { fetchCarinfoPage, type CarinfoFetchTrace } from "@/lib/vin-scan/carinfo-fetch";
import { runCarinfoLookup } from "@/lib/vin-scan/carinfo-lookup";
import { isValidScanPlate, vinScanPlateLabel, type VinScanPlates } from "@/lib/vin-scan/plates";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";
import { vinScanCatalogItem } from "@/lib/vin-scan/catalog";
import { probeKfzAt } from "@/lib/vin-scan/probe-kfz-at";
import { probeCzPolice, probeLinkOnly, probeNhtsaComplaints } from "@/lib/vin-scan/probes-new-sources";

function done(id: VinScanSourceId, ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, ctx.vin, parsed, ctx.plates);
}

function failed(id: VinScanSourceId, ctx: VinScanContext, e: unknown): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, ctx, {
    status: timedOut ? "timeout" : "unknown",
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
    const res = await fetchTjekbilDmrRaw(ctx.vin);
    const base = parseTjekbilProbe(res.status, res.text);
    if (base.status !== "found") return done("tjekbil", ctx, base);
    // Nobraukums, meklēšana, RAPEX (kods jau bija pasūtījumu sēklā); ja daļa nenāk laikā, paliek DMR pamatdati.
    try {
      const dmr = JSON.parse(res.text) as TjekbilDmrResponse;
      return done("tjekbil", ctx, tjekbilScanWithExtras(base, dmr, await fetchTjekbilExtras(dmr)));
    } catch {
      return done("tjekbil", ctx, base);
    }
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
    // Captcha lapā var būt VIN un vārds "nummerplade", tāpēc to neparsējam kā rezultātu.
    const htmlParsed = page.captchaReason
      ? { status: "unknown" as const, summary: `nummerplade.net: ${page.captchaReason}` }
      : parseNummerpladeHtml(page.status, page.text, ctx.vin);
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
    const inlineCount = parseDsbEntryCount(page.text);
    if (inlineCount != null) return done("dsb", ctx, dsbScanFromParts(search, inlineCount));
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
    if (!csrf) {
      const summary = page.captchaReason ? `Car-Pass: ${page.captchaReason}` : "Car-Pass neatgrieza drošības žetonu";
      return done("carpass", ctx, { status: "unknown", summary });
    }
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
    const parsed = parseCarpassRecalls(res.status, res.text);
    if (parsed.status === "unknown" && page.captchaReason) {
      return done("carpass", ctx, { status: "unknown", summary: `Car-Pass: ${page.captchaReason}` });
    }
    return done("carpass", ctx, parsed);
  } catch (e) {
    return failed("carpass", ctx, e);
  }
}

export async function probeCsdd(ctx: VinScanContext): Promise<VinScanIndicator> {
  const nr1 = ctx.vin || ctx.plates.lv;
  try {
    const res = await fetchCsddTechData(nr1);
    ctx.reportFirstReg?.(res.found ? res.data.firstRegistrationIso : "");
    return done("csdd", ctx, parseCsddTechScan(res));
  } catch (e) {
    ctx.reportFirstReg?.("");
    return failed("csdd", ctx, e);
  }
}

export async function probeMntEe(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    // mnt.ee `regMark` ir Igaunijas numurs. LV numurs tur nav derīgs un var sabojāt meklējumu, tāpēc tikai VIN.
    return done("mnt_ee", ctx, parseVinSourceScan(await fetchVinSource("mnt_ee", ctx.vin)));
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
    // Tiešais fetch no Vercel bieži ir 403, tad lapa iet caur Hetzner releju (sk. carinfo-fetch.ts).
    // Releja īstais iemesls (dienas limits, rinda pilna, tokens), lai operators neredz tikai „bloķē”.
    const trace: CarinfoFetchTrace = { relayReason: "" };
    const parsed = await runCarinfoLookup(ctx.vin, ctx.plates.se, (url) => fetchCarinfoPage(url, trace));
    if (parsed.status === "blocked" && trace.relayReason) {
      return done("carinfo", ctx, { ...parsed, summary: `car.info: ${trace.relayReason}`.slice(0, 240) });
    }
    return done("carinfo", ctx, parsed);
  } catch (e) {
    return failed("carinfo", ctx, e);
  }
}

const PROBES: Record<VinScanSourceId, (ctx: VinScanContext) => Promise<VinScanIndicator> | VinScanIndicator> = {
  vin_decode: probeVinDecode,
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
  stat_vin: probeStatVin,
  joj_copart_iaai: probeJojCopartIaai,
  thecarapi_eu: probeThecarapi,
  bid_cars: probeBidCars,
  carfax_eu: probeCarfaxEu,
  checkcar_vin: probeCheckcarVin,
  autodna_precheck: probeAutodnaPrecheck,
  plc_auction: probePlcAuction,
  bidfax: probeBidfax,
  poctra: probePoctra,
  cz_rsv: probeCzRsv,
  dvsa_mot: probeDvsaMot,
  eu_safety_gate: probeEuSafetyGate,
  kfz_at: probeKfzAt,
  cz_patrani: probeCzPolice,
  nhtsa_complaints: probeNhtsaComplaints,
  recall_kia: (ctx) => probeLinkOnly("recall_kia", ctx),
  recall_skoda: (ctx) => probeLinkOnly("recall_skoda", ctx),
  recall_audi: (ctx) => probeLinkOnly("recall_audi", ctx),
  recall_seat: (ctx) => probeLinkOnly("recall_seat", ctx),
  recall_stellantis: (ctx) => probeLinkOnly("recall_stellantis", ctx),
  recall_ford: (ctx) => probeLinkOnly("recall_ford", ctx),
  ca_cpic: (ctx) => probeLinkOnly("ca_cpic", ctx),
  ca_ibc: (ctx) => probeLinkOnly("ca_ibc", ctx),
};

export function vinScanProbeFor(id: string): ((ctx: VinScanContext) => Promise<VinScanIndicator> | VinScanIndicator) | null {
  if (!isVinScanSourceId(id)) return null;
  return PROBES[id];
}
