import "server-only";
/**
 * bid.cars, CARFAX.eu un kfzgutachten.at (VIN + 1. reģ. datums) caur Hetzner releja Chrome (`POST /listings/vinsource`).
 * Lapas saturu veido JS (Tampermonkey saņēma tukšu lapu), tāpēc relejs pats veic meklēšanu.
 * Relejs: viens Chrome vienlaikus šiem avotiem, ≤40 s, kešs 24 h. Neizdošanās -> pārlūka josla paliek rezervē.
 */
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { parseBidCarsLotHtml, vinScanParseFromBidCarsLot } from "@/lib/vin-scan/parse-bidcars";
import { vinScanParseFromCarfax } from "@/lib/vin-scan/parse-carfax-eu";
import type { VinScanParse } from "@/lib/vin-scan/types";

export type VinSourceRelayId = "bid_cars" | "carfax_eu" | "kfz_at";

/** kfzgutachten.at saraksta rinda no releja (Gutachtendatum DD.MM.YYYY). */
export type KfzRelayRow = { date: string; model: string; plate: string; vin: string; km?: string };

export type VinSourceRelayResult =
  | {
      ok: true;
      kind: "found" | "none";
      html?: string;
      json?: unknown;
      finalUrl?: string;
      lotUrl?: string;
      rows?: KfzRelayRow[];
      cached: boolean;
    }
  | { ok: false; reason: string; kind?: string };

function asKfzRows(raw: unknown): KfzRelayRow[] {
  if (!Array.isArray(raw)) return [];
  const out: KfzRelayRow[] = [];
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const date = typeof o.date === "string" && /^\d{2}\.\d{2}\.\d{4}$/.test(o.date) ? o.date : "";
    if (!date) continue;
    const km = typeof o.km === "string" && /^\d{1,7}$/.test(o.km) ? o.km : "";
    out.push({
      date,
      model: typeof o.model === "string" ? o.model.slice(0, 80) : "",
      plate: typeof o.plate === "string" ? o.plate.slice(0, 20) : "",
      vin: typeof o.vin === "string" ? o.vin.slice(0, 17) : "",
      ...(km ? { km } : {}),
    });
  }
  return out;
}

/** Relejs pats beidz pēc ~40 s; te rezerve tīklam un rindai. */
export const VINSOURCE_RELAY_TIMEOUT_MS = 47_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function vinSourceRelayConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readIrissRelayConfig(env) != null;
}

export async function fetchVinSourceViaRelay(
  source: VinSourceRelayId,
  vin: string,
  deps: {
    fetchImpl?: FetchLike;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
    /** kfz_at: precīzs 1. reģ. datums DD.MM.YYYY. */
    date?: string;
  } = {},
): Promise<VinSourceRelayResult> {
  const cfg = readIrissRelayConfig(deps.env ?? process.env);
  if (!cfg) return { ok: false, reason: "Relejs nav konfigurēts" };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? VINSOURCE_RELAY_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/vinsource`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(source === "kfz_at" ? { source, vin, date: deps.date ?? "" } : { source, vin }),
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await res.text();
    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!res.ok || body.ok !== true) {
      const err = String(body.error ?? "").trim();
      if (res.status === 404) return { ok: false, reason: "Relejā vēl nav /vinsource (vajag releja deploy)" };
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "Relejs noraidīja tokenu" };
      return { ok: false, reason: err || `Relejs atbildēja HTTP ${res.status}` };
    }
    const kind = String(body.kind ?? "");
    if (kind !== "found" && kind !== "none") {
      return { ok: false, kind, reason: String(body.note ?? "").trim() || `Relejs: ${kind || "nav rezultāta"}` };
    }
    const search = body.search && typeof body.search === "object" ? (body.search as Record<string, unknown>) : {};
    return {
      ok: true,
      kind,
      html: typeof body.html === "string" ? body.html : undefined,
      json: body.json,
      finalUrl: typeof body.finalUrl === "string" ? body.finalUrl : undefined,
      lotUrl: typeof search.lotUrl === "string" ? search.lotUrl : undefined,
      ...(source === "kfz_at" ? { rows: asKfzRows(body.rows) } : {}),
      cached: body.cached === true,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    if (aborted) return { ok: false, reason: `Relejs neatbildēja ${Math.round(timeoutMs / 1000)} s laikā` };
    return { ok: false, reason: `Releja savienojums neizdevās: ${formatFetchError(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Releja rezultāts -> VIN SCAN rinda. null: rezultātu nevar izmantot (tad paliek pārlūka josla). */
export function vinScanParseFromVinSource(
  source: VinSourceRelayId,
  vin: string,
  got: Extract<VinSourceRelayResult, { ok: true }>,
  openUrl: string,
): VinScanParse | null {
  if (source === "carfax_eu") return vinScanParseFromCarfax(got.kind, got.json, openUrl);
  if (source === "kfz_at") return null;
  if (got.kind === "none") return { status: "none", summary: "Nav izsoles arhīvā", openUrl };
  const lot = parseBidCarsLotHtml(got.html ?? "", vin);
  if (!lot) return null;
  return vinScanParseFromBidCarsLot(lot, got.finalUrl || got.lotUrl || openUrl);
}
