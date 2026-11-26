import "server-only";

import { scanFetch } from "@/lib/vin-scan/http";
import {
  buildSafetyGateResult,
  mergeSafetyGatePages,
  parseSafetyGateDetail,
  parseSafetyGateSearch,
  safetyGateBrandKey,
  safetyGateSearchBody,
  selectSafetyGateAlerts,
  SAFETY_GATE_CHUNKS,
  SAFETY_GATE_DETAIL_URL,
  SAFETY_GATE_MAX_ALERTS,
  SAFETY_GATE_SEARCH_URL,
  type SafetyGateDetail,
} from "@/lib/vin-scan/parse-eu-safety-gate";
import { parseVpicMakeModelYear } from "@/lib/vin-scan/parse-extra";
import {
  buildVinScanIndicator,
  type VinScanContext,
  type VinScanIndicator,
  type VinScanParse,
  type VinScanVehicle,
} from "@/lib/vin-scan/types";
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

async function vehicleHintBestEffort(ctx: VinScanContext): Promise<VinScanVehicle | null> {
  if (!ctx.vehicleHint) return null;
  try {
    return await ctx.vehicleHint();
  } catch {
    return null;
  }
}

/**
 * Modelis Safety Gate atlasei: vispirms tā paša skenējuma reģistri (CSDD, tjekbil, car.info...),
 * vPIC tikai, ja neviens cits modeli nenosauca. Abos gadījumos tikai tad, ja marka sakrīt ar WMI.
 */
export function safetyGateModelFor(
  make: string,
  hinted: VinScanVehicle | null,
  vpic: { make: string; model: string; year: string } | null,
): { model: string; year: string; from: "hint" | "vpic" | "" } {
  const brand = safetyGateBrandKey(make);
  if (hinted?.model && (!hinted.make || safetyGateBrandKey(hinted.make) === brand)) {
    return { model: hinted.model, year: hinted.year || "", from: "hint" };
  }
  if (vpic?.model && safetyGateBrandKey(vpic.make) === brand) return { model: vpic.model, year: vpic.year, from: "vpic" };
  return { model: "", year: "", from: "" };
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
    // Lapas prasām paralēli: viena liela lapa markām ar daudz brīdinājumiem pārsniedz noildzi.
    const [pages, vpic, hinted] = await Promise.all([
      Promise.allSettled(
        Array.from({ length: SAFETY_GATE_CHUNKS }, (_, page) =>
          scanFetch(SAFETY_GATE_SEARCH_URL, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: safetyGateSearchBody(make, nowYear, page),
            timeoutMs: SEARCH_TIMEOUT_MS,
          }),
        ),
      ),
      vpicPromise,
      vehicleHintBestEffort(ctx),
    ]);
    const first = pages[0];
    if (!first || first.status === "rejected") throw first?.reason ?? new Error("no_page");
    const search = mergeSafetyGatePages(
      pages.map((page) => (page.status === "fulfilled" ? parseSafetyGateSearch(page.value.status, page.value.text) : null)),
    );
    if (!search.ok) return done(ctx, { status: "unknown", summary: search.summary });
    const { model, year: modelYear } = safetyGateModelFor(make, hinted, vpic);
    const year = preferVinModelYear(local.year, modelYear);
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
