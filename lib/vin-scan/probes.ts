import "server-only";

import { getOneautoApiConfig } from "@/lib/oneauto-api";
import { getOutvinConfig } from "@/lib/outvin-api";
import { mapNummerpladePayload, nummerpladeApiKey } from "@/lib/vin-sources/nummerplade";
import { scanFetch } from "@/lib/vin-scan/http";
import {
  dsbScanFromParts,
  esynVehicleSummary,
  oneautoScanCopy,
  outvinScanCopy,
  parseCarpassCsrf,
  parseCarpassRecalls,
  parseDsbEntryCount,
  parseDsbSearchHtml,
  parseEsynChassis,
  parseEsynInspections,
  parseNhtsaDecode,
  parseNummerpladeProbe,
  parseTjekbilProbe,
} from "@/lib/vin-scan/parse";
import { buildVinScanIndicator, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

function done(id: VinScanIndicator["id"], vin: string, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, vin, parsed);
}

function failed(id: VinScanIndicator["id"], vin: string, e: unknown): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, vin, {
    status: "unknown",
    summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt",
  });
}

export async function probeTjekbil(vin: string): Promise<VinScanIndicator> {
  try {
    const res = await scanFetch(`https://www.tjekbil.dk/api/v3/dmr/vin/${encodeURIComponent(vin)}`, {
      headers: { accept: "application/json", referer: "https://www.tjekbil.dk/" },
    });
    return done("tjekbil", vin, parseTjekbilProbe(res.status, res.text));
  } catch (e) {
    return failed("tjekbil", vin, e);
  }
}

export async function probeNummerplade(vin: string): Promise<VinScanIndicator> {
  const key = nummerpladeApiKey();
  if (!key) return done("nummerplade", vin, { status: "skipped", summary: "Nav NUMMERPLADE_API_KEY" });
  try {
    const res = await scanFetch(`https://www.nummerplade.net/api/v1/koeretoej/${encodeURIComponent(vin)}`, {
      headers: { accept: "application/json", "X-Api-Noegle": key, referer: "https://www.nummerplade.net/" },
    });
    let mappedFound = false;
    let mappedMessage = "";
    if (res.status === 200 && res.text.trim()) {
      try {
        const mapped = mapNummerpladePayload(JSON.parse(res.text) as unknown);
        mappedFound = mapped.found;
        mappedMessage = mapped.message;
      } catch {
        mappedFound = false;
      }
    }
    return done("nummerplade", vin, parseNummerpladeProbe(res.status, res.text, mappedFound, mappedMessage));
  } catch (e) {
    return failed("nummerplade", vin, e);
  }
}

export async function probeEsyn(vin: string): Promise<VinScanIndicator> {
  try {
    const chassis = await scanFetch(`https://findsynsrapport.esyn.dk/webapi/v1/chassis/${encodeURIComponent(vin)}`, {
      headers: { accept: "application/json" },
    });
    const parsed = parseEsynChassis(chassis.status, chassis.text, vin);
    if (!("vehicle" in parsed)) return done("esyn", vin, parsed);
    const make = parsed.vehicle.make || "-";
    const list = await scanFetch(
      `https://findsynsrapport.esyn.dk/webapi/v1/chassismake/${encodeURIComponent(vin)}/${encodeURIComponent(make)}`,
      { headers: { accept: "application/json" } },
    );
    const inspections =
      list.status === 200 ? parseEsynInspections(list.text) : { status: "unknown" as const, summary: "Apskates sarakstu neizdevās nolasīt" };
    return done("esyn", vin, esynVehicleSummary(parsed.vehicle, inspections));
  } catch (e) {
    return failed("esyn", vin, e);
  }
}

export async function probeDsb(vin: string): Promise<VinScanIndicator> {
  try {
    const page = await scanFetch(
      `https://app.digitalservicebog.dk/search?vin=${encodeURIComponent(vin)}&country=eu`,
      { headers: { accept: "text/html" } },
    );
    if (page.status !== 200) {
      return done("dsb", vin, { status: "unknown", summary: `Digital Servicebook atbildēja ar HTTP ${page.status}` });
    }
    const search = parseDsbSearchHtml(page.text);
    if (!search.vehicle) return done("dsb", vin, dsbScanFromParts(search, 0));
    if (!search.servicesPath) return done("dsb", vin, dsbScanFromParts(search, null));
    const services = await scanFetch(`https://app.digitalservicebog.dk${search.servicesPath}`, {
      headers: {
        accept: "text/html",
        "x-requested-with": "XMLHttpRequest",
        referer: `https://app.digitalservicebog.dk/search?vin=${encodeURIComponent(vin)}&country=eu`,
      },
      cookie: page.cookie,
    });
    const count = services.status === 200 ? parseDsbEntryCount(services.text) : null;
    return done("dsb", vin, dsbScanFromParts(search, count));
  } catch (e) {
    return failed("dsb", vin, e);
  }
}

export async function probeCarpass(vin: string): Promise<VinScanIndicator> {
  try {
    const page = await scanFetch("https://public.car-pass.be/recalls", { headers: { accept: "text/html" } });
    const csrf = parseCarpassCsrf(page.text);
    if (!csrf) return done("carpass", vin, { status: "unknown", summary: "Car-Pass neatgrieza drošības žetonu" });
    const body = new URLSearchParams({ vin, _csrf: csrf }).toString();
    const res = await scanFetch("https://public.car-pass.be/recalls", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": csrf,
        origin: "https://public.car-pass.be",
        referer: "https://public.car-pass.be/recalls",
      },
      body,
      cookie: page.cookie,
    });
    return done("carpass", vin, parseCarpassRecalls(res.status, res.text));
  } catch (e) {
    return failed("carpass", vin, e);
  }
}

export async function probeNhtsa(vin: string): Promise<VinScanIndicator> {
  try {
    const res = await scanFetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { headers: { accept: "application/json" } },
    );
    return done("nhtsa", vin, parseNhtsaDecode(res.status, res.text));
  } catch (e) {
    return failed("nhtsa", vin, e);
  }
}

export function probeOneauto(vin: string): VinScanIndicator {
  return done("oneauto", vin, oneautoScanCopy(Boolean(getOneautoApiConfig())));
}

export function probeOutvin(vin: string): VinScanIndicator {
  return done("outvin", vin, outvinScanCopy(vin, Boolean(getOutvinConfig())));
}
