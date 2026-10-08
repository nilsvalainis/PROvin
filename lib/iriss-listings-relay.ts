/**
 * Hetzner pārlūka releja klients (relay/provin-listings). Tīrs modulis ar injicējamu fetch, lai testi strādā bez tīkla.
 *
 * Releja atbilde: { ok, status: ok|login_required|blocked|error, note, items[], raw?, pagesFetched, pageCount, elapsedMs }.
 * `items[]` ir releja v2 formāts (bez id / orderId); šeit to pārveido par IrissFetchedVehicle.
 * Autobid caur releju: items tukšs, raw.nuxtPages[] parsē ar `parseAutobidNuxtJson`.
 */

import { parseAutobidNuxtJson } from "@/lib/iriss-listings-autobid";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import type { IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { irissListingVehicleId } from "@/lib/iriss-listings-sources";
import type { IrissListingPlatform, IrissListingSourceStatus } from "@/lib/iriss-listings-types";

export type IrissRelayPlatform = "openlane" | "auto1" | "autobid";

export type IrissRelayConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export type IrissRelayFetchResult = {
  status: IrissListingSourceStatus;
  note: string;
  vehicles: IrissFetchedVehicle[];
  rawPages: string[];
  pagesFetched: number;
  pageCount: number;
  elapsedMs: number;
};

export type IrissRelaySessionState = "ok" | "login_required" | "unknown";

export type IrissRelayHealth = {
  reachable: boolean;
  note: string;
  checkedAt: string;
  platforms: Partial<Record<IrissRelayPlatform, { session: IrissRelaySessionState; sessionCheckedAt: string; lastFetchAt: string; lastFetchStatus: string; lastError: string }>>;
  manualLogin: { platform: IrissRelayPlatform; startedAt: string; vncReady: boolean } | null;
};

export type IrissRelayLoginStart = {
  ok: boolean;
  platform: IrissRelayPlatform | "";
  vncToken: string;
  vncUrl: string;
  vncPath: string;
  vncReady: boolean;
  vncError: string;
  minutes: number;
  startedAt: string;
  reused: boolean;
  note: string;
};

export type IrissRelayLoginClose = {
  ok: boolean;
  platform: IrissRelayPlatform | "";
  loggedIn: boolean;
  session: IrissRelaySessionState | "unknown";
  why: string;
  note: string;
};

export type IrissRelaySessionCheck = {
  ok: boolean;
  status: IrissListingSourceStatus;
  note: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Vercel platformas nosaukums "openline" (vēsturisks) -> releja "openlane". */
export function relayPlatformFor(platform: IrissListingPlatform): IrissRelayPlatform {
  return platform === "openline" ? "openlane" : platform;
}

export function listingPlatformFromRelay(platform: IrissRelayPlatform): IrissListingPlatform {
  return platform === "openlane" ? "openline" : platform;
}

export function readIrissRelayConfig(env: Record<string, string | undefined> = process.env): IrissRelayConfig | null {
  const baseUrl = (env.IRISS_LISTINGS_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.IRISS_LISTINGS_RELAY_TOKEN ?? "").trim();
  if (!baseUrl || !token) return null;
  const t = Number.parseInt(env.IRISS_LISTINGS_RELAY_TIMEOUT_MS ?? "", 10);
  return { baseUrl, token, timeoutMs: Number.isFinite(t) ? Math.min(290_000, Math.max(10_000, t)) : 180_000 };
}

export function mapRelayStatus(status: unknown): IrissListingSourceStatus {
  switch (str(status)) {
    case "ok":
      return "ok";
    case "login_required":
      return "login_required";
    case "blocked":
      return "blocked_by_waf";
    default:
      return "fetch_failed";
  }
}

export function mapRelayItem(item: unknown, platform: IrissListingPlatform, orderId: string, orderBrandModel: string): IrissFetchedVehicle | null {
  if (!isObj(item)) return null;
  const externalId = str(item.externalId);
  if (!externalId) return null;
  return {
    id: irissListingVehicleId(platform, externalId),
    platform,
    externalId,
    detailUrl: str(item.detailUrl),
    orderId,
    orderBrandModel,
    title: str(item.title),
    manufacturer: str(item.manufacturer),
    year: str(item.year),
    firstRegistration: str(item.firstRegistration),
    mileageKm: numOrNull(item.mileageKm),
    fuel: str(item.fuel),
    transmission: str(item.transmission),
    powerKw: str(item.powerKw),
    location: str(item.location),
    countryCode: str(item.countryCode),
    imageUrl: str(item.imageUrl),
    currency: str(item.currency) || "EUR",
    priceStart: numOrNull(item.priceStart),
    priceMinimal: numOrNull(item.priceMinimal),
    priceCurrent: numOrNull(item.priceCurrent),
    priceBuyNow: numOrNull(item.priceBuyNow),
    vatNote: str(item.vatNote),
    auctionId: str(item.auctionId),
    auctionStartAt: str(item.auctionStartAt),
    auctionEndAt: str(item.auctionEndAt),
    auctionStage: str(item.auctionStage),
  };
}

function autobidVehiclesFromNuxt(nuxtPages: string[], orderId: string, orderBrandModel: string): { vehicles: IrissFetchedVehicle[]; parsedPages: number } {
  const byId = new Map<string, IrissFetchedVehicle>();
  let parsedPages = 0;
  for (const json of nuxtPages) {
    const page = parseAutobidNuxtJson(json);
    if (!page) continue;
    parsedPages += 1;
    for (const v of page.vehicles) {
      if (byId.has(v.externalId)) continue;
      byId.set(v.externalId, {
        id: irissListingVehicleId("autobid", v.externalId),
        platform: "autobid",
        externalId: v.externalId,
        detailUrl: v.detailUrl,
        orderId,
        orderBrandModel,
        title: v.title,
        manufacturer: v.manufacturer,
        year: v.year,
        firstRegistration: v.firstRegistration,
        mileageKm: v.mileageKm,
        fuel: v.fuel,
        transmission: v.transmission,
        powerKw: v.powerKw,
        location: v.location,
        countryCode: v.countryCode,
        imageUrl: v.imageUrl,
        currency: "EUR",
        priceStart: v.priceStart,
        priceMinimal: v.priceMinimal,
        priceCurrent: v.priceCurrent,
        priceBuyNow: null,
        vatNote: v.vatNote,
        auctionId: v.auctionId,
        auctionStartAt: v.auctionStartAt,
        auctionEndAt: "",
        auctionStage: v.auctionStage,
      });
    }
  }
  return { vehicles: [...byId.values()], parsedPages };
}

/** Releja JSON atbilde -> SourceFetch. Eksportēts testiem. */
export function mapRelayFetchResponse(
  body: unknown,
  src: { platform: IrissListingPlatform; orderId: string; orderBrandModel: string },
): IrissRelayFetchResult {
  if (!isObj(body)) {
    return { status: "fetch_failed", note: "Relejs atgrieza nederīgu JSON.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, elapsedMs: 0 };
  }
  const status = mapRelayStatus(body.status);
  const elapsedMs = numOrNull(body.elapsedMs) ?? 0;
  const noteParts: string[] = [];
  const relayNote = str(body.note);
  if (relayNote) noteParts.push(relayNote);
  if (status !== "ok") {
    return { status, note: noteParts.join(" ") || "Relejs neatgrieza datus.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, elapsedMs };
  }

  const raw = isObj(body.raw) ? body.raw : null;
  let vehicles: IrissFetchedVehicle[] = [];
  let rawPages: string[] = [];
  const pagesFetched = numOrNull(body.pagesFetched) ?? 0;
  const pageCount = numOrNull(body.pageCount) ?? 0;

  if (src.platform === "autobid" && raw && Array.isArray(raw.nuxtPages)) {
    const nuxtPages = raw.nuxtPages.filter((x): x is string => typeof x === "string" && x.length > 0);
    const parsed = autobidVehiclesFromNuxt(nuxtPages, src.orderId, src.orderBrandModel);
    vehicles = parsed.vehicles;
    rawPages = nuxtPages;
    if (nuxtPages.length > 0 && parsed.parsedPages === 0) {
      return { status: "parse_failed", note: "Releja Autobid __NUXT_DATA__ neizdevās parsēt.", vehicles: [], rawPages, pagesFetched, pageCount, elapsedMs };
    }
  } else {
    const items = Array.isArray(body.items) ? body.items : [];
    vehicles = items.map((it) => mapRelayItem(it, src.platform, src.orderId, src.orderBrandModel)).filter((v): v is IrissFetchedVehicle => v !== null);
    if (raw) {
      try {
        rawPages = [JSON.stringify(raw)];
      } catch {
        rawPages = [];
      }
    }
  }
  if (vehicles.length === 0 && !/0 auto/.test(noteParts.join(" "))) noteParts.push("Meklējums šobrīd nedod rezultātus (0 auto).");
  return { status: "ok", note: noteParts.join(" "), vehicles, rawPages, pagesFetched, pageCount, elapsedMs };
}

function httpFailure(status: number, bodyText: string): IrissRelayFetchResult {
  let note: string;
  if (status === 401 || status === 403) note = "Relejs noraidīja tokenu (IRISS_LISTINGS_RELAY_TOKEN).";
  else if (status === 429) note = "Releja dienas limits šai platformai ir sasniegts.";
  else if (status === 503) note = "Relejs aizņemts (rinda pilna); mēģini vēlāk.";
  else note = `Relejs atbildēja HTTP ${status}.`;
  let detail = "";
  try {
    const j = JSON.parse(bodyText) as unknown;
    if (isObj(j)) detail = str(j.error) || str(j.note);
  } catch {
    /* nav JSON */
  }
  return { status: "fetch_failed", note: detail ? `${note} ${detail}` : note, vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, elapsedMs: 0 };
}

export async function fetchViaIrissRelay(
  cfg: IrissRelayConfig,
  src: { platform: IrissListingPlatform; sourceUrl: string; orderId: string; orderBrandModel: string },
  opts: { maxPages?: number; fetchImpl?: FetchLike } = {},
): Promise<IrissRelayFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/fetch`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ platform: relayPlatformFor(src.platform), sourceUrl: src.sourceUrl, orderId: src.orderId, maxPages: opts.maxPages }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) return httpFailure(res.status, text);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { status: "fetch_failed", note: "Relejs atgrieza nederīgu JSON.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, elapsedMs: 0 };
    }
    return mapRelayFetchResponse(body, src);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const note = aborted ? `Relejs neatbildēja ${Math.round(cfg.timeoutMs / 1000)} s laikā.` : `Releja savienojums neizdevās: ${formatFetchError(e, "fetch failed")}`;
    return { status: "fetch_failed", note, vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, elapsedMs: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function mapManualLogin(body: Rec): IrissRelayHealth["manualLogin"] {
  const raw = isObj(body.manualLogin) ? body.manualLogin : null;
  if (!raw) return null;
  const platform = str(raw.platform);
  if (platform !== "openlane" && platform !== "auto1" && platform !== "autobid") return null;
  return { platform, startedAt: str(raw.startedAt), vncReady: raw.vncReady === true };
}

export function mapRelayHealth(body: unknown, checkedAt: string): IrissRelayHealth {
  if (!isObj(body) || !isObj(body.platforms)) {
    return { reachable: false, note: "Relejs atgrieza nederīgu health JSON.", checkedAt, platforms: {}, manualLogin: null };
  }
  const platforms: IrissRelayHealth["platforms"] = {};
  for (const p of ["openlane", "auto1", "autobid"] as const) {
    const s = body.platforms[p];
    if (!isObj(s)) continue;
    const session = str(s.session);
    platforms[p] = {
      session: session === "ok" || session === "login_required" ? session : "unknown",
      sessionCheckedAt: str(s.sessionCheckedAt),
      lastFetchAt: str(s.lastFetchAt),
      lastFetchStatus: str(s.lastFetchStatus),
      lastError: str(s.lastError),
    };
  }
  return { reachable: true, note: "", checkedAt, platforms, manualLogin: mapManualLogin(body) };
}

function vncTokenLooksValid(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

/** noVNC skatītāja URL (tokens ceļā; Bearer tokens šeit nav). */
export function buildIrissRelayVncUrl(relayBaseUrl: string, vncToken: string): string {
  const base = relayBaseUrl.trim().replace(/\/+$/, "");
  const token = vncToken.trim().toLowerCase();
  if (!base || !vncTokenLooksValid(token)) return "";
  const path = `listings/vnc/${token}/`;
  return `${base}/vnc/${token}/vnc.html?autoconnect=true&reconnect=true&resize=scale&path=${encodeURIComponent(path)}`;
}

export function mapRelayLoginStart(body: unknown, relayBaseUrl: string): IrissRelayLoginStart {
  const empty: IrissRelayLoginStart = {
    ok: false,
    platform: "",
    vncToken: "",
    vncUrl: "",
    vncPath: "",
    vncReady: false,
    vncError: "",
    minutes: 0,
    startedAt: "",
    reused: false,
    note: "Relejs neatgrieza login atbildi.",
  };
  if (!isObj(body)) return empty;
  const platform = str(body.platform);
  const vncToken = str(body.vncToken).toLowerCase();
  const ok = body.ok === true && (platform === "openlane" || platform === "auto1" || platform === "autobid");
  const vncError = str(body.vncError) || str(body.error);
  return {
    ok,
    platform: ok ? platform : "",
    vncToken: vncTokenLooksValid(vncToken) ? vncToken : "",
    vncUrl: buildIrissRelayVncUrl(relayBaseUrl, vncToken),
    vncPath: str(body.vncPath),
    vncReady: body.vncReady === true,
    vncError,
    minutes: numOrNull(body.minutes) ?? 0,
    startedAt: str(body.startedAt),
    reused: body.reused === true,
    note: vncError || (ok ? "" : str(body.error) || empty.note),
  };
}

export function mapRelayLoginClose(body: unknown): IrissRelayLoginClose {
  if (!isObj(body)) return { ok: false, platform: "", loggedIn: false, session: "unknown", why: "", note: "Relejs neatgrieza close atbildi." };
  const platform = str(body.platform);
  const sessionRaw = str(body.session);
  return {
    ok: body.ok === true,
    platform: platform === "openlane" || platform === "auto1" || platform === "autobid" ? platform : "",
    loggedIn: body.loggedIn === true,
    session: sessionRaw === "ok" || sessionRaw === "login_required" ? sessionRaw : "unknown",
    why: str(body.why),
    note: str(body.note) || str(body.error),
  };
}

export function mapRelaySessionCheck(body: unknown): IrissRelaySessionCheck {
  if (!isObj(body)) return { ok: false, status: "fetch_failed", note: "Relejs neatgrieza sesijas pārbaudi." };
  return { ok: body.ok === true || str(body.status) === "ok", status: mapRelayStatus(body.status), note: str(body.note) || str(body.error) };
}

async function relayJson(
  cfg: IrissRelayConfig,
  path: string,
  body: Rec,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<{ status: number; body: unknown; note: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      return { status: res.status, body: {}, note: "Relejs atgrieza nederīgu JSON." };
    }
    const rec = isObj(parsed) ? parsed : {};
    return { status: res.status, body: parsed, note: str(rec.error) || str(rec.note) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      status: 0,
      body: {},
      note: aborted ? `Relejs neatbildēja ${Math.round((opts.timeoutMs ?? 45_000) / 1000)} s laikā.` : `Releja savienojums neizdevās: ${formatFetchError(e, "fetch failed")}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function startIrissRelayLogin(
  cfg: IrissRelayConfig,
  platform: IrissRelayPlatform,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<IrissRelayLoginStart> {
  const r = await relayJson(cfg, `/login/${platform}`, {}, { ...opts, timeoutMs: opts.timeoutMs ?? 45_000 });
  if (r.status === 0) return { ...mapRelayLoginStart({}, cfg.baseUrl), note: r.note };
  const mapped = mapRelayLoginStart(r.body, cfg.baseUrl);
  if (r.status >= 400 && !mapped.note) mapped.note = r.note || `Relejs atbildēja HTTP ${r.status}.`;
  if (r.status >= 400) mapped.ok = false;
  return mapped;
}

export async function closeIrissRelayLogin(
  cfg: IrissRelayConfig,
  platform: IrissRelayPlatform,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<IrissRelayLoginClose> {
  const r = await relayJson(cfg, `/login/${platform}/close`, {}, { ...opts, timeoutMs: opts.timeoutMs ?? 90_000 });
  if (r.status === 0) return { ok: false, platform, loggedIn: false, session: "unknown", why: "", note: r.note };
  const mapped = mapRelayLoginClose(r.body);
  if (r.status >= 400) return { ...mapped, ok: false, note: mapped.note || r.note || `Relejs atbildēja HTTP ${r.status}.` };
  return mapped;
}

export async function checkIrissRelaySession(
  cfg: IrissRelayConfig,
  platform: IrissRelayPlatform,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<IrissRelaySessionCheck> {
  const r = await relayJson(cfg, "/session/check", { platform }, { ...opts, timeoutMs: opts.timeoutMs ?? 90_000 });
  if (r.status === 0) return { ok: false, status: "fetch_failed", note: r.note };
  const mapped = mapRelaySessionCheck(r.body);
  if (r.status >= 400) return { ok: false, status: r.status === 503 ? "fetch_failed" : mapped.status, note: mapped.note || r.note || `Relejs atbildēja HTTP ${r.status}.` };
  return mapped;
}

export async function fetchIrissRelayHealth(cfg: IrissRelayConfig, opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}): Promise<IrissRelayHealth> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8_000);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/health`, { method: "GET", signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { reachable: false, note: `Releja health HTTP ${res.status}.`, checkedAt, platforms: {}, manualLogin: null };
    return mapRelayHealth(await res.json(), checkedAt);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { reachable: false, note: aborted ? "Relejs neatbild (health timeout)." : `Relejs nav sasniedzams: ${formatFetchError(e, "fetch failed")}`, checkedAt, platforms: {}, manualLogin: null };
  } finally {
    clearTimeout(timer);
  }
}
