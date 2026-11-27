/**
 * TheCarApi bildes, kuras avots vēl gatavo (`auction-images` → `pending` > 0).
 * Oriģinālās izsoles CDN saites (piem. BCA) bieži jau atbild 404, bet TheCarApi
 * tās vēl lejupielādē savā krātuvē. Tad lotei bilžu nav, un adminā jābūt skaidram statusam,
 * nevis tukšai grupai. Automātika atkārto tikai bilžu saraksta pieprasījumu.
 *
 * Tīra loģika: bez tīkla un krātuves.
 */

/** Mēģinājumu laiki no pirmās konstatēšanas: 1 h, 3 h, 12 h, 24 h. */
export const THECARAPI_PHOTO_RETRY_DELAYS_MS = [1, 3, 12, 24].map((h) => h * 60 * 60 * 1000);
export const THECARAPI_PHOTO_MAX_ATTEMPTS = THECARAPI_PHOTO_RETRY_DELAYS_MS.length;

export type ThecarapiPhotoWait = {
  /** `pending` - gaida avotu; `failed` - pēc visiem mēģinājumiem bilžu nav. */
  state: "pending" | "failed";
  /** Cik bildes TheCarApi pēdējā atbildē vēl gatavoja. */
  pending: number;
  /** Automātiskie atkārtojumi, kas jau izdarīti (0..4). */
  attempts: number;
  firstAt: string;
  nextAt?: string;
  lastAt?: string;
};

export function thecarapiImagesPendingCount(json: unknown): number {
  if (!json || typeof json !== "object" || Array.isArray(json)) return 0;
  const pending = (json as { pending?: unknown }).pending;
  return typeof pending === "number" && Number.isFinite(pending) && pending > 0 ? Math.floor(pending) : 0;
}

export function normalizeThecarapiPhotoWait(raw: unknown): ThecarapiPhotoWait | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const state = rec.state === "pending" || rec.state === "failed" ? rec.state : null;
  const firstAt = typeof rec.firstAt === "string" && Number.isFinite(Date.parse(rec.firstAt)) ? rec.firstAt : "";
  if (!state || !firstAt) return undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const date = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : undefined);
  const nextAt = date(rec.nextAt);
  const lastAt = date(rec.lastAt);
  return {
    state,
    pending: num(rec.pending),
    attempts: Math.min(THECARAPI_PHOTO_MAX_ATTEMPTS, num(rec.attempts)),
    firstAt,
    ...(nextAt ? { nextAt } : {}),
    ...(lastAt ? { lastAt } : {}),
  };
}

/**
 * Nākamais statuss pēc bilžu saglabāšanas mēģinājuma.
 * - Ir saglabātas bildes → statusa nav.
 * - Bilžu nav, avots vēl gatavo (vai jau gaidām) → `pending` ar nākamo laiku.
 * - Pēc 4. atkārtojuma joprojām nav → `failed` («Avots bildes nepiegādāja»).
 * `retried` = šis bija automātisks atkārtojums (palielina skaitītāju).
 */
export function nextThecarapiPhotoWait(input: {
  storedPhotos: number;
  pending: number;
  prev?: ThecarapiPhotoWait;
  retried: boolean;
  now: number;
}): ThecarapiPhotoWait | undefined {
  const { storedPhotos, pending, prev, retried, now } = input;
  if (storedPhotos > 0) return undefined;
  if (!prev && pending <= 0) return undefined;
  if (prev?.state === "failed" && !retried) return prev;
  const firstAt = prev?.firstAt ?? new Date(now).toISOString();
  const attempts = Math.min(THECARAPI_PHOTO_MAX_ATTEMPTS, (prev?.attempts ?? 0) + (retried ? 1 : 0));
  const lastAt = retried ? new Date(now).toISOString() : prev?.lastAt;
  const base = { pending: pending > 0 ? pending : (prev?.pending ?? 0), attempts, firstAt, ...(lastAt ? { lastAt } : {}) };
  if (attempts >= THECARAPI_PHOTO_MAX_ATTEMPTS) return { state: "failed", ...base };
  const first = Date.parse(firstAt);
  const nextAt = new Date(first + THECARAPI_PHOTO_RETRY_DELAYS_MS[attempts]!).toISOString();
  return { state: "pending", ...base, nextAt };
}

export function thecarapiPhotoWaitDue(wait: ThecarapiPhotoWait | undefined, now: number): boolean {
  if (!wait || wait.state !== "pending" || wait.attempts >= THECARAPI_PHOTO_MAX_ATTEMPTS) return false;
  const next = wait.nextAt ? Date.parse(wait.nextAt) : Number.NaN;
  return !Number.isFinite(next) || next <= now;
}

/** Admin statusa teksts (sarkans). */
export function thecarapiPhotoWaitLabel(wait: ThecarapiPhotoWait | undefined): string {
  if (!wait) return "";
  if (wait.state === "failed") return "Avots bildes nepiegādāja";
  return `Foto vēl tiek sagatavoti avotā${wait.pending > 0 ? ` (${wait.pending})` : ""} - mēģinās vēlreiz`;
}

/** Agrākais nākamā mēģinājuma laiks starp ierakstiem (indeksam). */
export function thecarapiPhotoWaitNextAt(waits: readonly (ThecarapiPhotoWait | undefined)[]): string | null {
  let best = Number.POSITIVE_INFINITY;
  for (const wait of waits) {
    if (!wait || wait.state !== "pending") continue;
    const t = wait.nextAt ? Date.parse(wait.nextAt) : 0;
    if (Number.isFinite(t) && t < best) best = t;
  }
  return Number.isFinite(best) ? new Date(best).toISOString() : null;
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|\[::1\])|^(172\.(1[6-9]|2\d|3[01])\.)|\.(local|internal|localhost)$/i;

/**
 * Bilde no TheCarApi `auction-images` atbildes: hostu iepriekš nezinām (avota krātuve),
 * tāpēc uzticamies saitei no atbildes, bet tikai publiskam https vārdam (ne IP, ne iekšējam),
 * bez lietotāja/paroles. Saturam jābūt bildei (pārbauda lejupielāde).
 */
export function isSafeThecarapiImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== "443") return false;
    const host = u.hostname.toLowerCase();
    if (!host || !host.includes(".") || PRIVATE_HOST.test(host)) return false;
    if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

type WaitRecord = { site: string; id: string; photos?: readonly unknown[] | null; rawImages?: unknown; photoWait?: ThecarapiPhotoWait };

function waitKey(record: Pick<WaitRecord, "site" | "id">): string {
  return `${record.site}:${record.id}`;
}

/**
 * Katram ierakstam aprēķina `photoWait` pēc saglabāšanas. Iepriekšējais statuss (no pasūtījuma
 * melnraksta) tiek ņemts pēc platforma + ID. `retried` - automātisks atkārtojums.
 */
export function applyThecarapiPhotoWaits<T extends WaitRecord>(
  records: readonly T[],
  previous: readonly WaitRecord[] | null | undefined,
  opts: { retried: boolean; now: number },
): T[] {
  const prevByKey = new Map((previous ?? []).map((row) => [waitKey(row), row.photoWait]));
  return records.map((record) => {
    const wait = nextThecarapiPhotoWait({
      storedPhotos: record.photos?.length ?? 0,
      pending: thecarapiImagesPendingCount(record.rawImages),
      prev: prevByKey.get(waitKey(record)),
      retried: opts.retried,
      now: opts.now,
    });
    const { photoWait: _old, ...rest } = record;
    void _old;
    return (wait ? { ...rest, photoWait: wait } : rest) as T;
  });
}
