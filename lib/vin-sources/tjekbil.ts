/**
 * tjekbil.dk — Dānijas Motorregister (DMR) + Færdselsstyrelsen synsrapport.
 * Publisks JSON bez autorizācijas. Nummerplade.net tiek pievienots, ja ir NUMMERPLADE_API_KEY.
 */
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

async function getJson<T>(url: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return { status: res.status, data: null };
  const text = await res.text();
  if (!text.trim()) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) as T };
  } catch {
    return { status: res.status, data: null };
  }
}

export async function fetchTjekbil(vin: string): Promise<VinSourceFetchResult> {
  const main = await getJson<TjekbilDmrResponse>(`${BASE}/dmr/vin/${encodeURIComponent(vin)}`);
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
