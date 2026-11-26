/**
 * tjekbil.dk — Dānijas Motorregister (DMR) + Færdselsstyrelsen synsrapport.
 * Publisks JSON bez autorizācijas. Nummerplade.net tiek pievienots, ja ir NUMMERPLADE_API_KEY.
 */
import { dedupeAsync } from "@/lib/vin-fetch-dedupe";
import { mergeDanishVinResults } from "@/lib/vin-sources/dk-merge";
import { fetchNummerplade } from "@/lib/vin-sources/nummerplade";
import { mapTjekbilPayload, tjekbilKid, tjekbilPlate, type TjekbilDmrResponse, type TjekbilMileageLog } from "@/lib/vin-sources/tjekbil-map";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const BASE = "https://www.tjekbil.dk/api/v3";

const HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "da-DK,da;q=0.9,en;q=0.8",
  referer: "https://www.tjekbil.dk/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/** Katram tjekbil.dk pieprasījumam (ieskaitot ķermeņa nolasīšanu) ir 10 s limits. */
export const TJEKBIL_FETCH_TIMEOUT_MS = 10_000;

/**
 * GET ar abort pēc `TJEKBIL_FETCH_TIMEOUT_MS`. Noildzes gadījumā met `Error("timeout")`,
 * ko VIN SCAN `failed()` pārvērš statusā `timeout`.
 */
async function fetchTextWithTimeout(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TJEKBIL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    if (timedOut) throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string): Promise<{ status: number; data: T | null }> {
  let res: { ok: boolean; status: number; text: string };
  try {
    res = await fetchTextWithTimeout(url);
  } catch (e) {
    // Papildu daļas nav obligātas: noildze = kā trūkstoša daļa.
    if (e instanceof Error && e.message === "timeout") return { status: 0, data: null };
    throw e;
  }
  if (!res.ok) return { status: res.status, data: null };
  const text = res.text;
  if (!text.trim()) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) as T };
  } catch {
    return { status: res.status, data: null };
  }
}

export function tjekbilDmrUrl(vin: string): string {
  return `${BASE}/dmr/vin/${encodeURIComponent(vin.trim().toUpperCase())}`;
}

/** Kopīgs ar VIN SCAN zondi, lai sēkla un skenējums neprasa DMR divreiz 60 s logā. */
export function fetchTjekbilDmrRaw(vin: string): Promise<{ status: number; text: string }> {
  const url = tjekbilDmrUrl(vin);
  return dedupeAsync(`tjekbil-dmr:${url}`, async () => {
    const res = await fetchTextWithTimeout(url);
    return { status: res.status, text: res.text };
  });
}

export type TjekbilExtras = {
  mileagelogs: TjekbilMileageLog[] | null;
  wanted: unknown[] | null;
  rapex: unknown;
};

function capped<T>(job: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    job.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * VIN SCAN: nobraukuma žurnāls, meklēto TL vēsture un RAPEX (tie paši galapunkti, ko pasūtījuma sēkla),
 * bez nummerplade.net. Katra daļa nav obligāta: pēc `capMs` paliek tas, kas atnāca.
 */
export async function fetchTjekbilExtras(dmr: TjekbilDmrResponse, capMs = 4_000): Promise<TjekbilExtras> {
  const kid = tjekbilKid(dmr);
  if (!kid) return { mileagelogs: null, wanted: null, rapex: null };
  const empty = { status: 0, data: null };
  const [mileageRes, wantedRes, rapexRes] = await Promise.all([
    capped(getJson<TjekbilMileageLog[]>(`${BASE}/vehicles/mileagelogs?dmrId=${kid}`), capMs, empty),
    capped(getJson<unknown[]>(`${BASE}/wanted-vehicles/getwantedvehiclehistory?dmrId=${kid}`), capMs, empty),
    capped(getJson<unknown>(`${BASE}/rapex/alerts?dmrId=${kid}`), capMs, empty),
  ]);
  return {
    mileagelogs: Array.isArray(mileageRes.data) ? mileageRes.data : null,
    wanted: Array.isArray(wantedRes.data) ? wantedRes.data : null,
    rapex: rapexRes.data,
  };
}

export async function fetchTjekbil(vin: string): Promise<VinSourceFetchResult> {
  const raw = await fetchTjekbilDmrRaw(vin);
  let data: TjekbilDmrResponse | null = null;
  if (raw.status === 200 && raw.text.trim()) {
    try {
      data = JSON.parse(raw.text) as TjekbilDmrResponse;
    } catch {
      data = null;
    }
  }
  const main = { status: raw.status, data };
  if (!main.data) {
    return emptyVinSourceResult(
      "tjekbil",
      vin,
      main.status === 404 ? "VIN nav Dānijas transportlīdzekļu reģistrā (DMR)" : `tjekbil.dk atbildēja ar HTTP ${main.status}`,
    );
  }

  const dmr = main.data;
  const kid = tjekbilKid(dmr);
  const plate = tjekbilPlate(dmr);

  const [mileageRes, wantedRes, rapexRes, pricesRes, nummerplade] = await Promise.all([
    kid ? getJson<TjekbilMileageLog[]>(`${BASE}/vehicles/mileagelogs?dmrId=${kid}`) : Promise.resolve({ status: 0, data: null }),
    kid
      ? getJson<unknown[]>(`${BASE}/wanted-vehicles/getwantedvehiclehistory?dmrId=${kid}`)
      : Promise.resolve({ status: 0, data: null }),
    kid ? getJson<unknown>(`${BASE}/rapex/alerts?dmrId=${kid}`) : Promise.resolve({ status: 0, data: null }),
    getJson<unknown>(`${BASE}/prices/history?vin=${encodeURIComponent(vin)}`),
    fetchNummerplade(vin, plate).catch(() => null),
  ]);

  const mapped = mapTjekbilPayload({
    dmr,
    mileagelogs: mileageRes.data,
    wanted: wantedRes.data,
    rapex: rapexRes.data,
  });

  const tjekbil: VinSourceFetchResult = {
    source: "tjekbil",
    vin,
    found: mapped.found,
    message: mapped.message,
    mileage: mapped.mileage,
    incidents: mapped.incidents,
    timeline: mapped.timeline,
    ownersSummary: mapped.ownersSummary,
    statusRecords: mapped.statusRecords,
    notes: mapped.notes,
    raw: JSON.stringify(
      {
        dmr,
        mileagelogs: mileageRes.data,
        wanted: wantedRes.data,
        rapex: rapexRes.data,
        prices: pricesRes.data,
      },
      null,
      2,
    ),
    fetchedAt: new Date().toISOString(),
  };

  return mergeDanishVinResults(tjekbil, nummerplade);
}
