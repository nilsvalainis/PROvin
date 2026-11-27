/**
 * Indekss pasūtījumiem, kuros TheCarApi bildes vēl gaida avotu, un cron slaucītājs.
 * Cron (`dealer-data-sweep`, ik 5 min) paņem tikai tos, kam pienācis `nextAt` (1 h, 3 h, 12 h, 24 h).
 */
import "server-only";

import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { syncCcVinPhotoGroupsAndFlat } from "@/lib/cc-vin-photo-types";
import { normalizeCcVinBlock } from "@/lib/cc-vin-report";
import { thecarapiPhotoWaitNextAt, type ThecarapiPhotoWait } from "@/lib/thecarapi-photo-wait";
import {
  readThecarapiPhotoWaitIndex,
  writeThecarapiPhotoWaitIndex,
  type ThecarapiPhotoWaitEntry,
} from "@/lib/vin-scan/store";
import { thecarapiRecordKey, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const LOG = "[thecarapi-photo-wait]";

function cleanVin(vin: string): string {
  return vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

/** Tīrs: jaunais indekss pēc pasūtījuma ierakstu statusa. `null` - nekas nemainās. */
export function upsertThecarapiPhotoWaitEntries(
  entries: readonly ThecarapiPhotoWaitEntry[],
  sessionId: string,
  vin: string,
  waits: readonly (ThecarapiPhotoWait | undefined)[],
  now: number,
): ThecarapiPhotoWaitEntry[] | null {
  const nextAt = thecarapiPhotoWaitNextAt(waits);
  const idx = entries.findIndex((entry) => entry.sessionId === sessionId);
  if (!nextAt) return idx >= 0 ? entries.filter((_, i) => i !== idx) : null;
  const entry: ThecarapiPhotoWaitEntry = { sessionId, vin: cleanVin(vin), nextAt, updatedAt: new Date(now).toISOString() };
  if (idx >= 0) {
    const old = entries[idx]!;
    if (old.nextAt === entry.nextAt && old.vin === entry.vin) return null;
    return entries.map((row, i) => (i === idx ? entry : row));
  }
  return [...entries, entry];
}

export async function noteThecarapiPhotoWait(
  sessionId: string,
  vin: string,
  records: readonly Pick<ThecarapiAdminRecord, "photoWait">[],
  now = Date.now(),
): Promise<void> {
  const entries = await readThecarapiPhotoWaitIndex();
  const next = upsertThecarapiPhotoWaitEntries(entries, sessionId, vin, records.map((r) => r.photoWait), now);
  if (next) await writeThecarapiPhotoWaitIndex(next);
}

type RetryFn = typeof import("@/lib/thecarapi-cc-vin").retryThecarapiPendingPhotos;

/** Melnrakstā aizstāj tikai atjaunotos TheCarApi ierakstus un pieliek jaunās grupas (operatora izmaiņas paliek). */
async function saveRetried(
  sessionId: string,
  retried: readonly ThecarapiAdminRecord[],
  groups: NonNullable<Awaited<ReturnType<RetryFn>>["groups"]>,
): Promise<ThecarapiAdminRecord[] | null> {
  const byKey = new Map(retried.map((record) => [thecarapiRecordKey(record.site, record.id), record]));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const draft = await readOrderDraft(sessionId).catch(() => null);
    if (!draft?.workspace) return null;
    const blocks = mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks);
    const cc = blocks.cc_vin;
    const records = (cc.thecarapiRecords ?? []).map(
      (record) => byKey.get(thecarapiRecordKey(record.site, record.id)) ?? record,
    );
    let nextCc = { ...cc, thecarapiRecords: records };
    if (groups.length > 0) {
      const synced = syncCcVinPhotoGroupsAndFlat([...(cc.photoGroups ?? []), ...groups]);
      nextCc = { ...nextCc, photoGroups: synced.photoGroups, photos: synced.photos };
    }
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...draft.workspace, sourceBlocks: { ...blocks, cc_vin: normalizeCcVinBlock(nextCc) } } },
      draft.workspaceRevision ? { expectedWorkspaceRevision: draft.workspaceRevision } : {},
    );
    if (res.ok) return records;
    if (res.error !== "stale_revision") return null;
  }
  return null;
}

function later(entry: ThecarapiPhotoWaitEntry, now: number): ThecarapiPhotoWaitEntry {
  return { ...entry, nextAt: new Date(now + 60 * 60 * 1000).toISOString(), updatedAt: new Date(now).toISOString() };
}

export type ThecarapiPhotoSweepRow = { sessionId: string; result: "loaded" | "waiting" | "failed" | "gone" | "error"; photos: number };

/**
 * Cron solis. Max `maxOrders` pasūtījumi vienā palaišanā; TheCarApi sauc tikai `auction-images`.
 */
export async function sweepThecarapiPhotoWait(opts: {
  now?: number;
  deadlineAt: number;
  maxOrders?: number;
  retry?: RetryFn;
}): Promise<{ waiting: number; processed: ThecarapiPhotoSweepRow[] }> {
  const now = opts.now ?? Date.now();
  const entries = await readThecarapiPhotoWaitIndex();
  const due = entries.filter((entry) => Date.parse(entry.nextAt) <= now).slice(0, opts.maxOrders ?? 1);
  if (due.length === 0) return { waiting: entries.length, processed: [] };
  const retry = opts.retry ?? (await import("@/lib/thecarapi-cc-vin")).retryThecarapiPendingPhotos;
  const processed: ThecarapiPhotoSweepRow[] = [];
  const updates = new Map<string, ThecarapiPhotoWaitEntry | null>();
  for (const entry of due) {
    if (Date.now() > opts.deadlineAt - 20_000) break;
    try {
      const draft = await readOrderDraft(entry.sessionId).catch(() => null);
      const prev = draft?.workspace ? mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks).cc_vin : null;
      if (!prev) {
        updates.set(entry.sessionId, null);
        processed.push({ sessionId: entry.sessionId, result: "gone", photos: 0 });
        continue;
      }
      const res = await retry({ vin: entry.vin, prev, sessionId: entry.sessionId, now, deadline: opts.deadlineAt - 15_000 });
      const records = res.changed ? await saveRetried(entry.sessionId, res.retried, res.groups ?? []) : prev.thecarapiRecords ?? [];
      if (!records) {
        // Melnraksts netika saglabāts - nākamais mēģinājums pēc stundas (bez cilpas ik 5 min).
        updates.set(entry.sessionId, later(entry, now));
        processed.push({ sessionId: entry.sessionId, result: "error", photos: 0 });
        continue;
      }
      const waits = records.map((record) => record.photoWait);
      const nextAt = thecarapiPhotoWaitNextAt(waits);
      updates.set(entry.sessionId, nextAt ? { ...entry, nextAt, updatedAt: new Date(now).toISOString() } : null);
      const photos = (res.groups ?? []).reduce((sum, group) => sum + group.photos.length, 0);
      const failed = res.retried.some((record) => record.photoWait?.state === "failed");
      processed.push({
        sessionId: entry.sessionId,
        result: photos > 0 ? "loaded" : nextAt ? "waiting" : failed ? "failed" : "loaded",
        photos,
      });
    } catch (err) {
      console.warn(LOG, "retry failed", { sessionId: entry.sessionId.slice(-8), msg: err instanceof Error ? err.message : "unknown" });
      updates.set(entry.sessionId, later(entry, now));
      processed.push({ sessionId: entry.sessionId, result: "error", photos: 0 });
    }
  }
  if (updates.size > 0) {
    // Svaigs nolasījums: starplaikā intake varēja pielikt citu pasūtījumu.
    const fresh = await readThecarapiPhotoWaitIndex();
    const next: ThecarapiPhotoWaitEntry[] = [];
    for (const row of fresh) {
      if (!updates.has(row.sessionId)) {
        next.push(row);
        continue;
      }
      const upd = updates.get(row.sessionId);
      if (upd) next.push(upd);
    }
    await writeThecarapiPhotoWaitIndex(next);
  }
  return { waiting: entries.length, processed };
}
