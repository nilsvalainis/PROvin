import "server-only";

/**
 * 26.11 jaunie VIN SCAN avoti: Čehijas policijas zagto auto meklēšana (automātiski, bez captcha),
 * NHTSA sūdzības (oficiāls API bez atslēgas) un saišu avoti (ražotāju atsaukumi, Kanādas CPIC / IBC).
 */
import { vinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import {
  CZ_POLICE_BASE_URL,
  czPoliceSearchUrl,
  parseCzPoliceDetail,
  parseCzPoliceHits,
  parseCzPoliceSearch,
  type CzPoliceDetail,
} from "@/lib/vin-scan/cz-police";
import { scanFetch } from "@/lib/vin-scan/http";
import { nhtsaComplaintsApiUrl, parseNhtsaComplaints } from "@/lib/vin-scan/nhtsa-complaints";
import { parseVpicMakeModelYear } from "@/lib/vin-scan/parse-extra";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse, type VinScanVehicle } from "@/lib/vin-scan/types";
import { decodeVinLocal, isUsWmiVin } from "@/lib/vin-scan/vin-decode";

function done(id: VinScanSourceId, ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(id, ctx.vin, parsed, ctx.plates);
}

function failed(id: VinScanSourceId, ctx: VinScanContext, e: unknown, openUrl?: string): VinScanIndicator {
  const timedOut = e instanceof Error && e.message === "timeout";
  return done(id, ctx, {
    status: timedOut ? "timeout" : "unknown",
    summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt",
    ...(openUrl ? { openUrl } : {}),
  });
}

const CZ_SEARCH_TIMEOUT_MS = 9_000;
const CZ_DETAIL_TIMEOUT_MS = 4_000;

/** Viens GET `?Vin=`; tikai trāpījuma gadījumā vēl viens GET uz detaļu lapu (krāsa, gads, datums). */
export async function probeCzPolice(ctx: VinScanContext): Promise<VinScanIndicator> {
  const url = czPoliceSearchUrl(ctx.vin);
  try {
    const res = await scanFetch(url, { headers: { accept: "text/html", "accept-language": "cs,en;q=0.8" }, timeoutMs: CZ_SEARCH_TIMEOUT_MS });
    let detail: CzPoliceDetail | null = null;
    const hit = res.status === 200 ? parseCzPoliceHits(res.text, ctx.vin)[0] : undefined;
    if (hit?.detailUrl && hit.detailUrl.startsWith(CZ_POLICE_BASE_URL)) {
      try {
        const page = await scanFetch(hit.detailUrl, { headers: { accept: "text/html" }, timeoutMs: CZ_DETAIL_TIMEOUT_MS });
        if (page.status === 200) detail = parseCzPoliceDetail(page.text);
      } catch {
        detail = null;
      }
    }
    return done("cz_patrani", ctx, parseCzPoliceSearch(res.status, res.text, ctx.vin, detail));
  } catch (e) {
    return failed("cz_patrani", ctx, e, url);
  }
}

const VPIC_TIMEOUT_MS = 6_000;
const COMPLAINTS_TIMEOUT_MS = 8_000;

async function vpicVehicle(vin: string): Promise<VinScanVehicle | null> {
  try {
    const res = await scanFetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      headers: { accept: "application/json" },
      timeoutMs: VPIC_TIMEOUT_MS,
    });
    return parseVpicMakeModelYear(res.status, res.text);
  } catch {
    return null;
  }
}

async function hintedVehicle(ctx: VinScanContext): Promise<VinScanVehicle | null> {
  if (!ctx.vehicleHint) return null;
  try {
    return await ctx.vehicleHint();
  } catch {
    return null;
  }
}

/**
 * ASV/CA/MX VIN: marka/modelis/gads no NHTSA vPIC. Citiem VIN: modelis no tā paša skenējuma reģistriem
 * (CSDD, tjekbil u.c.), jo vPIC ne-ASV modeli bieži sajauc; ja NHTSA šo modeli nezina - `skipped`.
 */
export async function nhtsaComplaintsVehicleFor(
  ctx: VinScanContext,
): Promise<{ vehicle: VinScanVehicle; usMarket: boolean } | null> {
  const local = decodeVinLocal(ctx.vin);
  if (isUsWmiVin(ctx.vin)) {
    const vpic = await vpicVehicle(ctx.vin);
    const make = vpic?.make || local.make || "";
    const model = vpic?.model || "";
    const year = vpic?.year || local.year || "";
    return make && model && year ? { vehicle: { make, model, year }, usMarket: true } : null;
  }
  const hinted = await hintedVehicle(ctx);
  const make = hinted?.make || local.make || "";
  const model = hinted?.model || "";
  const year = hinted?.year || local.year || "";
  return make && model && year ? { vehicle: { make, model, year }, usMarket: false } : null;
}

export async function probeNhtsaComplaints(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const target = await nhtsaComplaintsVehicleFor(ctx);
    if (!target) {
      return done("nhtsa_complaints", ctx, {
        status: "skipped",
        summary: isUsWmiVin(ctx.vin)
          ? "NHTSA sūdzības: marka/modelis/gads no VIN nav nosakāms"
          : "NHTSA sūdzības: nav ASV auto un reģistri modeli nenosauca",
      });
    }
    const { vehicle, usMarket } = target;
    const res = await scanFetch(nhtsaComplaintsApiUrl(vehicle.make, vehicle.model, vehicle.year), {
      headers: { accept: "application/json" },
      timeoutMs: COMPLAINTS_TIMEOUT_MS,
    });
    return done("nhtsa_complaints", ctx, parseNhtsaComplaints(res.status, res.text, vehicle, { usMarket }));
  } catch (e) {
    return failed("nhtsa_complaints", ctx, e);
  }
}

/** Saišu avoti: serveris lapu nelasa, rinda ir tikai «Atvērt pārlūkā». */
export function probeLinkOnly(id: VinScanSourceId, ctx: VinScanContext): VinScanIndicator {
  const item = vinScanCatalogItem(id);
  return done(id, ctx, {
    status: "browser_only",
    summary: `${item.label}: pārbaude pārlūkā`,
    openUrl: item.openUrl(ctx.vin, ctx.plates, ctx.listingUrl),
  });
}
