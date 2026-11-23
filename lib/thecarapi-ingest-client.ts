/**
 * Admin TheCarApi pogas klienta loģika: POST un atjaunošana no keša, ja Vercel atgriež 504 /
 * ne-JSON / tīkla kļūdu (serveris tikmēr datus jau var būt saglabājis kešā).
 */
import type { CcVinBlockState } from "@/lib/cc-vin-report";

export type ThecarapiIngestBody = {
  ok?: boolean;
  error?: string;
  summary?: string;
  block?: CcVinBlockState;
  used?: number;
  cap?: number;
  fromCache?: boolean;
  cachedAt?: string;
  cacheHasDetail?: boolean;
  partial?: boolean;
};

export type ThecarapiIngestOutcome = {
  /** HTTP statuss (0 - tīkla kļūda). */
  status: number;
  body: ThecarapiIngestBody;
  /** true - dati paņemti no keša pēc taimauta. */
  recovered: boolean;
  /** true - POST nesaņēma lietojamu atbildi (504 / ne-JSON / tīkls). */
  timedOut: boolean;
};

export const THECARAPI_TIMEOUT_ERROR_LV =
  "TheCarApi atbilde aizņēma par ilgu (taimauts) - dati, ja ir, saglabāti; mēģini vēlreiz.";
export const THECARAPI_RECOVERED_NOTE_LV = "Atbilde aizņēma par ilgu - parādīti saglabātie dati no keša.";

/** Klienta/servera pulksteņu nobīdes rezerve, salīdzinot keša laiku ar pieprasījuma sākumu. */
const CLOCK_SKEW_MS = 30_000;

const URL_PATH = "/api/admin/sources/thecarapi";

async function readJson(res: Response): Promise<ThecarapiIngestBody | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ThecarapiIngestBody) : null;
  } catch {
    return null;
  }
}

export async function runThecarapiIngest(opts: {
  vin: string;
  sessionId?: string;
  block: CcVinBlockState;
  skipCache: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ThecarapiIngestOutcome> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const startedMs = (opts.now ?? Date.now)();
  const post = (extra: Record<string, unknown>) =>
    fetchImpl(URL_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vin: opts.vin,
        sessionId: opts.sessionId || undefined,
        block: opts.block,
        ...extra,
      }),
    });

  let status = 0;
  let body: ThecarapiIngestBody | null = null;
  try {
    const res = await post({ skipCache: opts.skipCache });
    status = res.status;
    body = await readJson(res);
  } catch {
    status = 0;
  }
  const timedOut = status === 0 || status === 504 || body == null;
  if (!timedOut) return { status, body: body!, recovered: false, timedOut: false };

  const since = new Date(startedMs - CLOCK_SKEW_MS).toISOString();
  try {
    const res = await fetchImpl(`${URL_PATH}?vin=${encodeURIComponent(opts.vin)}`, { credentials: "include" });
    const st = (await readJson(res)) as { cache?: { cachedAt?: string } | null } | null;
    const cachedAt = st?.cache?.cachedAt ? Date.parse(st.cache.cachedAt) : Number.NaN;
    if (Number.isFinite(cachedAt) && cachedAt >= Date.parse(since)) {
      const again = await post({ skipCache: false, cacheOnly: true, cacheSince: since });
      const recovered = await readJson(again);
      if (again.ok && recovered?.ok && recovered.block) {
        return { status: again.status, body: recovered, recovered: true, timedOut: true };
      }
    }
  } catch {
    /* paliek taimauta kļūda */
  }
  return {
    status,
    body: { ...(body ?? {}), error: "timeout", summary: THECARAPI_TIMEOUT_ERROR_LV },
    recovered: false,
    timedOut: true,
  };
}
