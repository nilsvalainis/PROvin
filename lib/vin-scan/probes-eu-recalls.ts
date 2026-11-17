import "server-only";

import { scanFetch } from "@/lib/vin-scan/http";
import {
  buildSafetyGateResult,
  parseSafetyGateDetail,
  parseSafetyGateSearch,
  safetyGateBrandKey,
  safetyGateSearchBody,
  selectSafetyGateAlerts,
  SAFETY_GATE_DETAIL_URL,
  SAFETY_GATE_MAX_ALERTS,
  SAFETY_GATE_SEARCH_URL,
  type SafetyGateDetail,
} from "@/lib/vin-scan/parse-eu-safety-gate";
import { parseVpicMakeModelYear } from "@/lib/vin-scan/parse-extra";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";
import { decodeVinLocal, preferVinModelYear } from "@/lib/vin-scan/vin-decode";

const ID = "eu_safety_gate" as const;

/** Avota kopējais limits ir 14 s: meklēšana + detaļas kopā paliek zem tā. */
const SEARCH_TIMEOUT_MS = 9_500;
const DETAIL_TIMEOUT_MS = 3_000;
const VPIC_TIMEOUT_MS = 5_000;

function done(ctx: VinScanContext, parsed: VinScanParse): VinScanIndicator {
  return buildVinScanIndicator(ID, ctx.vin, parsed, ctx.plates);
}

type VpicIds = { make: string; model: string; year: string } | null;

/** vPIC modelis ir tikai papildinājums: kļūda vai noildze nedrīkst apturēt Safety Gate vaicājumu. */
async function vpicIds(vin: string): Promise<VpicIds> {
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

async function alertDetail(id: number): Promise<SafetyGateDetail | null> {
  try {
    const res = await scanFetch(`${SAFETY_GATE_DETAIL_URL}/${id}?language=lv`, {
      headers: { accept: "application/json" },
      timeoutMs: DETAIL_TIMEOUT_MS,
    });
    return parseSafetyGateDetail(res.status, res.text);
  } catch {
    return null;
  }
}

/**
 * ES Safety Gate brīdinājumi pēc markas (un modeļa/gada, ja zināmi). Skenē visiem VIN, arī ASV:
 * tie ir ES tirgus dati par marku/modeli, nevis par konkrēto VIN.
 */
export async function probeEuSafetyGate(ctx: VinScanContext): Promise<VinScanIndicator> {
  const vin = ctx.vin.trim().toUpperCase();
  const local = decodeVinLocal(vin);
  const vpicPromise = vpicIds(vin);
  const make = local.make || (await vpicPromise)?.make || "";
  if (!make) return done(ctx, { status: "skipped", summary: "ES Safety Gate: marka no VIN nav nosakāma" });
  try {
    const nowYear = new Date().getFullYear();
    const [res, vpic] = await Promise.all([
      scanFetch(SAFETY_GATE_SEARCH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: safetyGateSearchBody(make, nowYear),
        timeoutMs: SEARCH_TIMEOUT_MS,
      }),
      vpicPromise,
    ]);
    const search = parseSafetyGateSearch(res.status, res.text);
    if (!search.ok) return done(ctx, { status: "unknown", summary: search.summary });
    // vPIC modeli ņemam tikai tad, ja tas runā par to pašu marku, ko WMI.
    const sameMake = vpic && safetyGateBrandKey(vpic.make) === safetyGateBrandKey(make);
    const model = sameMake ? vpic.model : "";
    const year = preferVinModelYear(local.year, sameMake ? vpic.year : "");
    const top = selectSafetyGateAlerts(search.alerts, { make, model }).candidates.slice(0, SAFETY_GATE_MAX_ALERTS);
    const details = new Map(await Promise.all(top.map(async (alert) => [alert.id, await alertDetail(alert.id)] as const)));
    return done(ctx, buildSafetyGateResult({ make, model, year, search, details, nowYear }));
  } catch (e) {
    const timedOut = e instanceof Error && e.message === "timeout";
    return done(ctx, {
      status: timedOut ? "timeout" : "unknown",
      summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt",
    });
  }
}
