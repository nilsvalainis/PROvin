import "server-only";

/**
 * Pasūtījuma melnraksta revīzijas Vercel Blob (privāti) - prodā `/tmp` revīzijas nav ilgtermiņa.
 * Ceļš: `admin-order-draft-revisions/<sid>/<ts>-rev<N>.json` - ATSEVIŠĶA sakne, ne pasūtījumu prefiksā
 * (citādi AI vēstures / mācīšanās `list(expanded)` un ikdienas backup lasītu ~40x vairāk failu).
 * Saglabā IEPRIEKŠĒJO versiju pirms pārrakstīšanas. Patur pēdējās 40 + lielāko (bagātāko) kopiju.
 */
import { del, get, list, put } from "@vercel/blob";
import type { OrderDraftRevisionMeta } from "@/lib/admin-order-draft-types";

export const BLOB_REVISIONS_ROOT = "admin-order-draft-revisions/";
/** `list` + vecāko dzēšana ne katrā rakstā (ik 10. reizi uz sesiju šajā instancē). */
export const BLOB_REVISION_PRUNE_EVERY = 10;
export const MAX_BLOB_REVISIONS_PER_SESSION = 40;
/** Parastai autosaglabāšanai ne biežāk kā 1x minūtē uz sesiju (citādi 40 kopijas = 2 min vēstures). */
export const BLOB_REVISION_MIN_INTERVAL_MS = 60_000;

export type BlobRevisionConfig = { token: string; prefix: string };

const lastRevisionAtBySession = new Map<string, number>();
const writesSincePruneBySession = new Map<string, number>();

/** Tikai testiem. */
export function resetBlobRevisionThrottleForTests(): void {
  lastRevisionAtBySession.clear();
  writesSincePruneBySession.clear();
}

export function blobRevisionSessionPrefix(_cfg: BlobRevisionConfig, sessionId: string): string {
  return `${BLOB_REVISIONS_ROOT}${sessionId}/`;
}

/** `20261125T103200123Z` - leksikogrāfiski kārtojams. */
export function compactRevisionTimestamp(d = new Date()): string {
  return d.toISOString().replace(/[-:.]/g, "");
}

export function blobRevisionId(revision: number, d = new Date()): string {
  const n = Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0;
  return `${compactRevisionTimestamp(d)}-rev${n}`;
}

const REVISION_ID_RE = /^\d{8}T\d{9}Z-rev\d{1,9}$/;

export function isBlobRevisionId(id: string): boolean {
  return REVISION_ID_RE.test(id);
}

/** Vai šis raksts drīkst izveidot revīziju (throttle; shrink/restore vienmēr). */
export function shouldWriteBlobRevision(
  sessionId: string,
  opts: { force?: boolean; nowMs?: number } = {},
): boolean {
  if (opts.force) return true;
  const now = opts.nowMs ?? Date.now();
  const last = lastRevisionAtBySession.get(sessionId) ?? 0;
  return now - last >= BLOB_REVISION_MIN_INTERVAL_MS;
}

export type BlobRevisionReason = "patch" | "overwrite_shrink" | "restore" | "invoice";

export async function writeBlobRevision(
  cfg: BlobRevisionConfig,
  sessionId: string,
  prevDoc: unknown,
  opts: { revision: number; reason: BlobRevisionReason; fillTotal?: number; now?: Date },
): Promise<string | null> {
  if (!prevDoc) return null;
  const now = opts.now ?? new Date();
  const revisionId = blobRevisionId(opts.revision, now);
  const pathname = `${blobRevisionSessionPrefix(cfg, sessionId)}${revisionId}.json`;
  const prevUpdatedAt =
    prevDoc && typeof prevDoc === "object" && typeof (prevDoc as { updatedAt?: unknown }).updatedAt === "string" ?
      (prevDoc as { updatedAt: string }).updatedAt
    : now.toISOString();
  await put(
    pathname,
    JSON.stringify({
      revisionId,
      savedAt: now.toISOString(),
      updatedAt: prevUpdatedAt,
      reason: opts.reason,
      ...(typeof opts.fillTotal === "number" ? { fillTotal: opts.fillTotal } : {}),
      doc: prevDoc,
    }),
    {
      access: "private",
      token: cfg.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    },
  );
  lastRevisionAtBySession.set(sessionId, now.getTime());
  const writes = (writesSincePruneBySession.get(sessionId) ?? 0) + 1;
  if (writes < BLOB_REVISION_PRUNE_EVERY) {
    writesSincePruneBySession.set(sessionId, writes);
    return revisionId;
  }
  writesSincePruneBySession.set(sessionId, 0);
  await pruneBlobRevisions(cfg, sessionId).catch((err) => {
    console.warn("[workspace:revision_prune_failed]", {
      sessionId,
      detail: err instanceof Error ? err.message : String(err),
    });
  });
  return revisionId;
}

type ListedRevision = { pathname: string; revisionId: string; size: number; uploadedAt: string | null };

async function listBlobRevisionsRaw(cfg: BlobRevisionConfig, sessionId: string): Promise<ListedRevision[]> {
  const prefix = blobRevisionSessionPrefix(cfg, sessionId);
  const out: ListedRevision[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token: cfg.token, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const revisionId = b.pathname.slice(prefix.length, -".json".length);
      if (!isBlobRevisionId(revisionId)) continue;
      const uploaded = (b as { uploadedAt?: Date | string }).uploadedAt;
      out.push({
        pathname: b.pathname,
        revisionId,
        size: typeof (b as { size?: number }).size === "number" ? (b as { size: number }).size : 0,
        uploadedAt: uploaded ? new Date(uploaded).toISOString() : null,
      });
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  out.sort((a, b) => (a.revisionId < b.revisionId ? 1 : a.revisionId > b.revisionId ? -1 : 0));
  return out;
}

/** Patur jaunākās 40; vecākās dzēš, izņemot lielāko (visbagātāko) kopiju. */
export async function pruneBlobRevisions(cfg: BlobRevisionConfig, sessionId: string): Promise<number> {
  const all = await listBlobRevisionsRaw(cfg, sessionId);
  if (all.length <= MAX_BLOB_REVISIONS_PER_SESSION) return 0;
  const largest = all.reduce((best, r) => (r.size > best.size ? r : best), all[0]!);
  const toDelete = all
    .slice(MAX_BLOB_REVISIONS_PER_SESSION)
    .filter((r) => r.pathname !== largest.pathname)
    .map((r) => r.pathname);
  if (!toDelete.length) return 0;
  await del(toDelete, { token: cfg.token });
  return toDelete.length;
}

function revisionLabel(id: string, size: number): string {
  const n = id.split("-rev")[1] ?? "?";
  const kb = size > 0 ? ` · ${Math.max(1, Math.round(size / 1024))} KB` : "";
  return `rev ${n}${kb}`;
}

export async function listBlobRevisions(
  cfg: BlobRevisionConfig,
  sessionId: string,
  limit = 20,
): Promise<(OrderDraftRevisionMeta & { size: number })[]> {
  const all = await listBlobRevisionsRaw(cfg, sessionId);
  return all.slice(0, Math.max(1, limit)).map((r) => {
    const ts = r.revisionId.slice(0, 19);
    const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}.${ts.slice(15, 18)}Z`;
    const savedAt = Number.isFinite(Date.parse(iso)) ? iso : (r.uploadedAt ?? new Date(0).toISOString());
    return {
      revisionId: r.revisionId,
      savedAt,
      updatedAt: savedAt,
      reason: revisionLabel(r.revisionId, r.size),
      size: r.size,
    };
  });
}

export async function readBlobRevisionDoc(
  cfg: BlobRevisionConfig,
  sessionId: string,
  revisionId: string,
): Promise<unknown | null> {
  if (!isBlobRevisionId(revisionId)) return null;
  const res = await get(`${blobRevisionSessionPrefix(cfg, sessionId)}${revisionId}.json`, {
    access: "private",
    token: cfg.token,
    useCache: false,
  }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  try {
    const parsed = JSON.parse(await new Response(res.stream).text()) as { doc?: unknown };
    return parsed && typeof parsed === "object" ? (parsed.doc ?? null) : null;
  } catch {
    return null;
  }
}
