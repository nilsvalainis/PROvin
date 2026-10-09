import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { SOURCE_BLOCK_LABELS, mergeSourceBlocksWithDefaults, type SourceBlockKey, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { listListingPeeks } from "@/lib/listing-peek-store";
import { vehicleKeys, vehicleKeysOverlap } from "@/lib/quick-eval-match";
import {
  PURCHASED_SOURCE_BLOCK_KEYS,
  VIN_REUSABLE_SOURCE_BLOCK_KEYS,
  importSourceBlocks,
  sourceBlockHasContent,
  sourceBlockHasPurchasedContent,
} from "@/lib/quick-eval-merge";
import { readQuickEval, updateQuickEval } from "@/lib/quick-eval-store";
import { importBlocksIntoOrder, seedQuickEval } from "@/lib/quick-eval-service";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";

/**
 * VIN kā globāla atslēga: kas par šo auto jau ir zināms (citi ātrie vērtējumi, apmaksāti pasūtījumi),
 * un vienā klikšķī pārnes jau nopirktos transportlīdzekļa datus uz jauno darbu.
 * Iepriekšējā klienta personas datus (vārds, e-pasts, tālrunis, piezīmes, teksti) nekad nekopē.
 */

export type VinHistoryEntry = {
  kind: "order" | "quick";
  /** Pasūtījumam `sessionId`, ātrajam vērtējumam `qe:<peekId>`. */
  id: string;
  createdAt: string;
  savedAt: string | null;
  /** Tikai rādīšanai adminā (nekad netiek kopēts). */
  who: string;
  status: string | null;
  dataKeys: SourceBlockKey[];
  purchasedKeys: SourceBlockKey[];
  labels: string[];
};

const MAX_ENTRIES = 8;

function keysWithData(blocks: WorkspaceSourceBlocks) {
  const all = (Object.keys(SOURCE_BLOCK_LABELS) as SourceBlockKey[]).filter((k) => sourceBlockHasContent(blocks, k));
  const purchased = PURCHASED_SOURCE_BLOCK_KEYS.filter((k) => sourceBlockHasPurchasedContent(blocks, k));
  return { all, purchased: [...purchased] };
}

export async function findVinHistory(
  vinOrPlate: Array<string | null | undefined>,
  exclude: { sessionId?: string; peekId?: string } = {},
): Promise<VinHistoryEntry[]> {
  const keys = vehicleKeys(...vinOrPlate);
  if (keys.size === 0) return [];
  const out: VinHistoryEntry[] = [];

  const [paid, peeks] = await Promise.all([
    listPaidCheckoutSessions().catch(() => []),
    listListingPeeks(500).catch(() => []),
  ]);
  const drafts = await readOrderDraftSummaries(paid.map((r) => r.id)).catch(() => new Map());

  for (const row of paid) {
    if (out.length >= MAX_ENTRIES) break;
    if (row.isDemo || row.id === exclude.sessionId || row.checkoutLine === "provin_select") continue;
    const d = drafts.get(row.id);
    if (!vehicleKeysOverlap(keys, vehicleKeys(row.vin, d?.vin))) continue;
    const draft = await readOrderDraft(row.id).catch(() => null);
    const blocks = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks);
    const k = keysWithData(blocks);
    const createdMs = row.created < 1_000_000_000_000 ? row.created * 1000 : row.created;
    out.push({
      kind: "order",
      id: row.id,
      createdAt: new Date(createdMs).toISOString(),
      savedAt: draft?.workspaceSavedAt ?? draft?.updatedAt ?? null,
      who: d?.customerName || row.customerEmail || "—",
      status: d?.auditCompletedAt ? "Izpildīts" : null,
      dataKeys: k.all,
      purchasedKeys: k.purchased,
      labels: k.purchased.map((x) => SOURCE_BLOCK_LABELS[x]),
    });
  }

  for (const p of peeks) {
    if (out.length >= MAX_ENTRIES) break;
    if (p.id === exclude.peekId) continue;
    if (!vehicleKeysOverlap(keys, vehicleKeys(p.vin))) continue;
    const doc = await readQuickEval(p.id).catch(() => null);
    const blocks = doc?.sourceBlocks ?? mergeSourceBlocksWithDefaults(null);
    const k = keysWithData(blocks);
    out.push({
      kind: "quick",
      id: `qe:${p.id}`,
      createdAt: p.createdAt,
      savedAt: doc?.seed?.at ?? doc?.updatedAt ?? null,
      who: p.email,
      status: p.status,
      dataKeys: k.all,
      purchasedKeys: k.purchased,
      labels: k.purchased.map((x) => SOURCE_BLOCK_LABELS[x]),
    });
  }

  out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return out;
}

async function loadBlocks(fromId: string): Promise<{ blocks: WorkspaceSourceBlocks; savedAt: string | null; photoSessions: string[] } | null> {
  if (fromId.startsWith("qe:")) {
    const doc = await readQuickEval(fromId.slice(3));
    if (!doc) return null;
    const photoSessions = (doc.reusedFrom ?? []).map((r) => r.fromId).filter((x) => !x.startsWith("qe:"));
    return { blocks: doc.sourceBlocks, savedAt: doc.updatedAt, photoSessions };
  }
  const draft = await readOrderDraft(fromId);
  if (!draft?.workspace) return null;
  return {
    blocks: mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks),
    savedAt: draft.workspaceSavedAt ?? draft.updatedAt ?? null,
    photoSessions: [fromId],
  };
}

/** Tikai nopirktā / manuāli savāktā daļa; CSDD bez API momentuzņēmuma (to ielasa svaigi). */
function reusableBlocks(blocks: WorkspaceSourceBlocks): WorkspaceSourceBlocks {
  const csdd = { ...blocks.csdd };
  delete csdd.registry;
  delete csdd.apiUnlocked;
  delete csdd.conflicts;
  return { ...blocks, csdd };
}

export type VinReuseResult =
  | { ok: true; copied: SourceBlockKey[]; conflicts: SourceBlockKey[] }
  | { ok: false; error: string };

export async function reuseVehicleData(
  fromId: string,
  target: { kind: "quick"; peekId: string } | { kind: "order"; sessionId: string; vin?: string; listingUrl?: string },
): Promise<VinReuseResult> {
  const src = await loadBlocks(fromId);
  if (!src) return { ok: false, error: "source_not_found" };
  const incoming = reusableBlocks(src.blocks);
  const keys = VIN_REUSABLE_SOURCE_BLOCK_KEYS.filter((k) => sourceBlockHasPurchasedContent(src.blocks, k));
  if (keys.length === 0) return { ok: true, copied: [], conflicts: [] };

  if (target.kind === "order") {
    const r = await importBlocksIntoOrder(target.sessionId, incoming, { keys, photoSessions: src.photoSessions });
    if (r.ok) {
      // Bezmaksas avotus ielasa svaigi (CSDD API paliek prioritārs).
      await seedPaidOrderAutoSources(target.sessionId, { vin: target.vin, listingUrl: target.listingUrl }).catch(() => null);
    }
    return r;
  }

  let copied: SourceBlockKey[] = [];
  let conflicts: SourceBlockKey[] = [];
  await updateQuickEval(target.peekId, (doc) => {
    const r = importSourceBlocks(doc.sourceBlocks, incoming, { keys });
    copied = r.copied;
    conflicts = r.conflicts.map((c) => c.key);
    return {
      ...doc,
      sourceBlocks: r.blocks,
      reusedFrom: [
        ...(doc.reusedFrom ?? []).filter((x) => x.fromId !== fromId),
        ...src.photoSessions.filter((s) => s !== fromId).map((s) => ({ fromId: s, keys: [], at: new Date().toISOString(), sourceSavedAt: null })),
        { fromId, keys: r.copied, at: new Date().toISOString(), sourceSavedAt: src.savedAt },
      ],
    };
  });
  await seedQuickEval(target.peekId).catch(() => null);
  return { ok: true, copied, conflicts };
}
