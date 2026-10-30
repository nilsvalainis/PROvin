/**
 * CSP pārkāpumu apkopojums pa dienām (audits P9): pirms piespiedu CSP vajag redzēt, ko politika
 * bloķētu nedēļas griezumā. Lauks `direktīva|bloķētais hosts|lapas hosts` -> skaits.
 * Glabā Redis, ja tas ir; citādi Vercel Blob (dienas JSON, Nils 28.10: bez jauna konta).
 * Blob skaitītājs ir aptuvens (vienlaicīgi ieraksti var pazust) - statistikai pietiek.
 */
import { get, put } from "@vercel/blob";
import { resolveRateLimitRedis } from "@/lib/rate-limit";
import type { CspReportSummary } from "@/lib/csp";

const KEY_PREFIX = "provin:csp:";
const TTL_SECONDS = 14 * 24 * 60 * 60;
const TIMEOUT_MS = 400;
const BLOB_PREFIX = "security/csp-reports/";
/** Aizsardzība pret ziņojumu plūdiem: Blob operācijas maksā, lauku skaits ierobežots. */
const BLOB_WRITES_PER_INSTANCE_DAY = 300;
const BLOB_MAX_FIELDS = 300;

export type CspBlobIo = {
  read: (pathname: string) => Promise<Record<string, number> | null>;
  write: (pathname: string, counts: Record<string, number>) => Promise<void>;
};

function defaultBlobIo(env: NodeJS.ProcessEnv): CspBlobIo | null {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;
  return {
    async read(pathname) {
      try {
        const res = await get(pathname, { access: "private", token, useCache: false });
        if (!res || res.statusCode !== 200 || !res.stream) return null;
        const data = JSON.parse(await new Response(res.stream).text()) as unknown;
        return data && typeof data === "object" ? (data as Record<string, number>) : null;
      } catch {
        return null;
      }
    },
    async write(pathname, counts) {
      await put(pathname, JSON.stringify(counts), {
        access: "private",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
  };
}

export function cspReportBlobPath(day: string): string {
  return `${BLOB_PREFIX}${day}.json`;
}

const instanceWrites = { day: "", count: 0 };

/** Tikai testiem. */
export function resetCspBlobWriteBudget(): void {
  instanceWrites.day = "";
  instanceWrites.count = 0;
}

async function recordCspReportBlob(field: string, day: string, io: CspBlobIo): Promise<boolean> {
  if (instanceWrites.day !== day) {
    instanceWrites.day = day;
    instanceWrites.count = 0;
  }
  if (instanceWrites.count >= BLOB_WRITES_PER_INSTANCE_DAY) return false;
  instanceWrites.count += 1;
  try {
    const path = cspReportBlobPath(day);
    const counts = (await io.read(path)) ?? {};
    if (!(field in counts) && Object.keys(counts).length >= BLOB_MAX_FIELDS) return false;
    counts[field] = (Number(counts[field]) || 0) + 1;
    await io.write(path, counts);
    return true;
  } catch {
    return false;
  }
}

export function cspReportDayKey(now: Date = new Date()): string {
  return `${KEY_PREFIX}${now.toISOString().slice(0, 10)}`;
}

export function cspReportField(summary: CspReportSummary): string {
  return [summary.violatedDirective, summary.blockedUri, summary.documentHost]
    .map((part) => part.replace(/\|/g, "/"))
    .join("|")
    .slice(0, 260);
}

/** HINCRBY + EXPIRE vienā pipeline; kļūda vai taimauts netiek mests tālāk. */
export async function recordCspReport(
  summary: CspReportSummary,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date; blobIo?: CspBlobIo | null } = {},
): Promise<boolean> {
  const cfg = resolveRateLimitRedis(opts.env);
  if (!cfg) {
    const io = opts.blobIo !== undefined ? opts.blobIo : defaultBlobIo(opts.env ?? process.env);
    if (!io) return false;
    const day = cspReportDayKey(opts.now).slice(KEY_PREFIX.length);
    return recordCspReportBlob(cspReportField(summary), day, io);
  }
  const key = cspReportDayKey(opts.now);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["HINCRBY", key, cspReportField(summary), "1"],
        ["EXPIRE", key, String(TTL_SECONDS)],
      ]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type CspReportDay = { day: string; counts: Record<string, number> };

/** Pēdējo `days` dienu kopsavilkums adminam (Redis HGETALL vai Blob dienas faili). Bez krātuves - `null`. */
export async function readCspReportDays(
  days = 7,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date; blobIo?: CspBlobIo | null } = {},
): Promise<CspReportDay[] | null> {
  const cfg = resolveRateLimitRedis(opts.env);
  const now = opts.now ?? new Date();
  const keys = Array.from({ length: Math.min(Math.max(days, 1), 14) }, (_, i) =>
    cspReportDayKey(new Date(now.getTime() - i * 86_400_000)),
  );
  if (!cfg) {
    const io = opts.blobIo !== undefined ? opts.blobIo : defaultBlobIo(opts.env ?? process.env);
    if (!io) return null;
    return Promise.all(
      keys.map(async (key) => {
        const day = key.slice(KEY_PREFIX.length);
        const raw = (await io.read(cspReportBlobPath(day))) ?? {};
        const counts: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) counts[k] = Number(v) || 0;
        return { day, counts };
      }),
    );
  }
  const res = await (opts.fetchImpl ?? fetch)(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(keys.map((k) => ["HGETALL", k])),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: unknown }[];
  return keys.map((key, i) => {
    const flat = Array.isArray(data?.[i]?.result) ? (data[i].result as unknown[]) : [];
    const counts: Record<string, number> = {};
    for (let j = 0; j + 1 < flat.length; j += 2) counts[String(flat[j])] = Number(flat[j + 1]) || 0;
    return { day: key.slice(KEY_PREFIX.length), counts };
  });
}
