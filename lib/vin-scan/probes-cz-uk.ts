import "server-only";

import { scanFetch } from "@/lib/vin-scan/http";
import { parseCzRsv, parseDvsaMot } from "@/lib/vin-scan/parse-cz-uk";
import { isValidScanPlate, normalizeScanPlate } from "@/lib/vin-scan/plates";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";
import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

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

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/* ---------------- CZ: Datová kostka RSV (MD ČR) ---------------- */

const CZ_RSV_API = "https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2";

export async function probeCzRsv(ctx: VinScanContext): Promise<VinScanIndicator> {
  const key = env("CZ_RSV_API_KEY");
  if (!key) {
    return done("cz_rsv", ctx, {
      status: "config_missing",
      summary: "Čehijas reģistrs: nav CZ_RSV_API_KEY (bezmaksas atslēga dataovozidlech.cz/registraceapi)",
    });
  }
  try {
    const res = await scanFetch(`${CZ_RSV_API}?vin=${encodeURIComponent(ctx.vin.trim().toUpperCase())}`, {
      headers: { accept: "application/json", API_KEY: key },
    });
    return done("cz_rsv", ctx, parseCzRsv(res.status, res.text));
  } catch (e) {
    return failed("cz_rsv", ctx, e);
  }
}

/* ---------------- UK: DVSA MOT History API ---------------- */

const DVSA_MOT_API = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";
const DVSA_DEFAULT_SCOPE = "https://tapi.dvsa.gov.uk/.default";
/** Tokenu atjaunojam minūti pirms derīguma beigām. */
const TOKEN_SKEW_MS = 60_000;

type DvsaConfig = { clientId: string; clientSecret: string; apiKey: string; tokenUrl: string; scope: string };

export function dvsaMotConfig(): DvsaConfig | null {
  const cfg = {
    clientId: env("DVSA_MOT_CLIENT_ID"),
    clientSecret: env("DVSA_MOT_CLIENT_SECRET"),
    apiKey: env("DVSA_MOT_API_KEY"),
    tokenUrl: env("DVSA_MOT_TOKEN_URL"),
    scope: env("DVSA_MOT_SCOPE") || DVSA_DEFAULT_SCOPE,
  };
  return cfg.clientId && cfg.clientSecret && cfg.apiKey && cfg.tokenUrl ? cfg : null;
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

/** Tikai testiem. */
export function resetDvsaMotTokenCache(): void {
  tokenCache = null;
}

async function dvsaAccessToken(cfg: DvsaConfig, now = Date.now()): Promise<string | null> {
  const cacheKey = `${cfg.tokenUrl}|${cfg.clientId}|${cfg.scope}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt - TOKEN_SKEW_MS > now) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: cfg.scope,
  }).toString();
  const res = await scanFetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (res.status !== 200) return null;
  let data: { access_token?: unknown; expires_in?: unknown } = {};
  try {
    data = JSON.parse(res.text) as typeof data;
  } catch {
    return null;
  }
  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!token) return null;
  const ttlSec = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in) || 3600;
  tokenCache = { key: cacheKey, token, expiresAt: now + ttlSec * 1000 };
  return token;
}

export async function probeDvsaMot(ctx: VinScanContext): Promise<VinScanIndicator> {
  const cfg = dvsaMotConfig();
  if (!cfg) {
    return done("dvsa_mot", ctx, {
      status: "config_missing",
      summary: "UK MOT: nav DVSA API atslēgu (DVSA_MOT_CLIENT_ID, _CLIENT_SECRET, _API_KEY, _TOKEN_URL)",
    });
  }
  const reg = normalizeScanPlate(ctx.plates.uk ?? "");
  if (!isValidScanPlate("uk", reg)) return done("dvsa_mot", ctx, { status: "needs_input", summary: "Vajag UK reģ. nr." });
  try {
    const token = await dvsaAccessToken(cfg);
    if (!token) {
      return done("dvsa_mot", ctx, { status: "config_missing", summary: "UK MOT: DVSA tokenu neizdevās saņemt" });
    }
    const res = await scanFetch(`${DVSA_MOT_API}/${encodeURIComponent(reg)}`, {
      headers: { accept: "application/json", authorization: `Bearer ${token}`, "X-API-Key": cfg.apiKey },
    });
    if (res.status === 401) resetDvsaMotTokenCache();
    return done("dvsa_mot", ctx, parseDvsaMot(res.status, res.text));
  } catch (e) {
    return failed("dvsa_mot", ctx, e);
  }
}
