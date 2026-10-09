import "server-only";

import { computeFreeSourceSeed } from "@/lib/admin-free-source-seed";
import { readOrderDraft, patchOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import {
  collectSourceBlockPhotoIdsFromWorkspace,
  readSourceBlockPhotoJpeg,
  writeSourceBlockPhotoJpeg,
} from "@/lib/admin-source-block-photo-store";
import { parseSourceBlockWipes } from "@/lib/admin-source-block-wipes";
import {
  createDefaultSourceBlocks,
  csddFormToPlainText,
  mergeSourceBlocksWithDefaults,
  tirgusFormToPlainText,
  vinRegistryBlockToPlainText,
  SOURCE_BLOCK_LABELS,
  type SourceBlockKey,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { getListingPeekById, listListingPeeks, type ListingPeekEntry } from "@/lib/listing-peek-store";
import {
  pickAutoImportPeek,
  quickEvalExpired,
  rankExportCandidates,
  vehicleKeys,
  type ExportCandidate,
  type QuickEvalMatchOrder,
  type QuickEvalMatchPeek,
} from "@/lib/quick-eval-match";
import { FREE_SOURCE_BLOCK_KEYS, importSourceBlocks, sourceBlockHasContent } from "@/lib/quick-eval-merge";
import {
  deleteQuickEval,
  emptyQuickEvalDoc,
  readQuickEval,
  updateQuickEval,
  type QuickEvalDoc,
} from "@/lib/quick-eval-store";

function emptyWorkspaceBody(): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

// ── F2: bezmaksas avoti ───────────────────────────────────────────────

/** Bezmaksas avotu ielase ātrajam vērtējumam (CSDD, sludinājums, DK/EE/SE). `refresh` ielasa no jauna. */
export async function seedQuickEval(peekId: string, opts: { refresh?: boolean } = {}): Promise<QuickEvalDoc | null> {
  const peek = await getListingPeekById(peekId);
  if (!peek) return null;
  const current = (await readQuickEval(peek.id)) ?? emptyQuickEvalDoc(peek.id);
  let baseline = current.sourceBlocks;
  if (opts.refresh) {
    const defaults = mergeSourceBlocksWithDefaults(null);
    const fresh: WorkspaceSourceBlocks = { ...baseline };
    for (const key of FREE_SOURCE_BLOCK_KEYS) {
      if (key === "csdd") {
        // PDF daļa (ja atkārtoti izmantota) paliek; API ielasa no jauna un tas atkal ir prioritārs.
        const c = { ...baseline.csdd };
        delete c.registry;
        delete c.conflicts;
        fresh.csdd = c;
      } else {
        (fresh as Record<SourceBlockKey, unknown>)[key] = defaults[key];
      }
    }
    baseline = fresh;
  }
  const seeded = await computeFreeSourceSeed(baseline, { vin: peek.vin, listingUrl: peek.listingUrl });
  return updateQuickEval(peek.id, (doc) => ({
    ...doc,
    vin: seeded.resolvedVin || doc.vin,
    sourceBlocks: seeded.blocks,
    seed: { at: new Date().toISOString(), parts: seeded.parts },
  }));
}

// ── F5: eksports uz pasūtījumu ───────────────────────────────────────

export type QuickEvalExportResult =
  | { ok: true; copied: SourceBlockKey[]; conflicts: SourceBlockKey[] }
  | { ok: false; error: string };

/** Nokopē source-block foto no avota darbiem uz mērķa pasūtījumu (citādi tos izdzēstu kā bāreņus). */
async function copyPhotos(fromSessionIds: string[], toSessionId: string, blocks: WorkspaceSourceBlocks, keys: SourceBlockKey[]) {
  if (fromSessionIds.length === 0 || keys.length === 0) return;
  const picked: Record<string, unknown> = {};
  for (const k of keys) picked[k] = blocks[k];
  const ids = collectSourceBlockPhotoIdsFromWorkspace({ sourceBlocks: picked });
  for (const photoId of ids) {
    for (const from of fromSessionIds) {
      if (from === toSessionId) continue;
      const buf = await readSourceBlockPhotoJpeg(from, photoId).catch(() => null);
      if (!buf) continue;
      await writeSourceBlockPhotoJpeg(toSessionId, photoId, buf).catch((err) => {
        console.warn("[quick-eval] photo copy failed", { from, toSessionId, photoId, err });
      });
      break;
    }
  }
}

/** Ieliek avotu blokus pasūtījuma darba zonā (tikai transportlīdzekļa dati, ne klienta). */
export async function importBlocksIntoOrder(
  sessionId: string,
  incoming: WorkspaceSourceBlocks,
  opts: { keys?: readonly SourceBlockKey[]; photoSessions?: string[] } = {},
): Promise<QuickEvalExportResult> {
  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const result = importSourceBlocks(baseline.sourceBlocks, incoming, {
    keys: opts.keys,
    wipes: parseSourceBlockWipes(baseline.sourceBlockWipes),
  });
  const conflicts = result.conflicts.map((c) => c.key);
  if (!result.changed) return { ok: true, copied: [], conflicts };
  await copyPhotos(opts.photoSessions ?? [], sessionId, result.blocks, result.copied);
  const workspace = persistBodyToOrderDraftWorkspace(
    { ...orderDraftWorkspaceToPersistBody(baseline), sourceBlocks: result.blocks },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );
  const patched = await patchOrderDraft(sessionId, { workspace }, { force: true });
  if (!patched.ok) return { ok: false, error: patched.error ?? "patch_failed" };
  return { ok: true, copied: result.copied, conflicts };
}

function photoSessionsOf(doc: QuickEvalDoc): string[] {
  return [...new Set((doc.reusedFrom ?? []).map((r) => r.fromId).filter((id) => !id.startsWith("qe:")))];
}

export async function exportQuickEvalToOrder(
  peekId: string,
  sessionId: string,
  mode: "auto" | "manual",
): Promise<QuickEvalExportResult> {
  const doc = await readQuickEval(peekId);
  if (!doc) return { ok: false, error: "no_quick_eval_data" };
  const r = await importBlocksIntoOrder(sessionId, doc.sourceBlocks, { photoSessions: photoSessionsOf(doc) });
  if (!r.ok) return r;
  await updateQuickEval(doc.peekId, (d) => ({
    ...d,
    exports: [
      ...(d.exports ?? []).filter((e) => e.sessionId !== sessionId),
      { sessionId, at: new Date().toISOString(), mode, copied: r.copied, conflicts: r.conflicts },
    ],
  }));
  return r;
}

async function matchPeek(peek: ListingPeekEntry, doc: QuickEvalDoc | null): Promise<QuickEvalMatchPeek> {
  return {
    id: peek.id,
    email: peek.email,
    phone: peek.phone,
    createdAt: peek.createdAt,
    vehicle: vehicleKeys(peek.vin, doc?.vin, doc?.sourceBlocks.csdd.registrationNumber, doc?.sourceBlocks.csdd.vin),
    exportedTo: (doc?.exports ?? []).map((e) => e.sessionId),
  };
}

/**
 * Stripe webhook: ja klients ar to pašu e-pastu jau saņēma ātro vērtējumu par šo VIN,
 * vērtējuma dati automātiski pāriet uz pasūtījumu (pirms bezmaksas ielases, lai tā neko neatkārto).
 */
export async function autoImportQuickEvalForPaidOrder(
  sessionId: string,
  order: { vin?: string | null; email?: string | null },
): Promise<{ peekId: string; result: QuickEvalExportResult } | null> {
  const orderVehicle = vehicleKeys(order.vin);
  if (!order.email || orderVehicle.size === 0) return null;
  const peeks = (await listListingPeeks(500)).filter((p) => p.email === order.email!.trim().toLowerCase());
  const candidates: QuickEvalMatchPeek[] = [];
  for (const p of peeks) {
    const doc = await readQuickEval(p.id);
    if (doc) candidates.push(await matchPeek(p, doc));
  }
  const hit = pickAutoImportPeek(
    { id: sessionId, createdMs: Date.now(), emails: [order.email], phones: [], vehicle: orderVehicle },
    candidates,
  );
  if (!hit) return null;
  const result = await exportQuickEvalToOrder(hit.id, sessionId, "auto");
  return { peekId: hit.id, result };
}

export type QuickEvalCandidateView = ExportCandidate & { email: string | null; vin: string | null; name: string | null };

export async function listQuickEvalExportCandidates(peekId: string): Promise<QuickEvalCandidateView[]> {
  const peek = await getListingPeekById(peekId);
  if (!peek) return [];
  const doc = await readQuickEval(peek.id);
  const paid = (await listPaidCheckoutSessions()).filter((r) => !r.isDemo && r.checkoutLine !== "provin_select");
  const drafts = await readOrderDraftSummaries(paid.map((r) => r.id)).catch(() => new Map());
  const orders: QuickEvalMatchOrder[] = paid.map((r) => {
    const d = drafts.get(r.id);
    return {
      id: r.id,
      createdMs: r.created < 1_000_000_000_000 ? r.created * 1000 : r.created,
      emails: [r.customerEmail, d?.customerEmail],
      phones: [d?.customerPhone],
      vehicle: vehicleKeys(r.vin, d?.vin),
    };
  });
  const ranked = rankExportCandidates(await matchPeek(peek, doc), orders).slice(0, 8);
  return ranked.map((c) => {
    const row = paid.find((r) => r.id === c.id);
    const d = drafts.get(c.id);
    return { ...c, email: row?.customerEmail ?? null, vin: d?.vin ?? row?.vin ?? null, name: d?.customerName ?? null };
  });
}

// ── 30 dienu glabāšana ─────────────────────────────────────────────

export async function cleanupExpiredQuickEvals(now = Date.now()): Promise<{ checked: number; deleted: number }> {
  const peeks = await listListingPeeks(500);
  let deleted = 0;
  let checked = 0;
  for (const p of peeks) {
    if (!quickEvalExpired(p.createdAt, false, now)) continue;
    const doc = await readQuickEval(p.id);
    if (!doc) continue;
    checked += 1;
    if (quickEvalExpired(p.createdAt, (doc.exports ?? []).length > 0, now)) {
      await deleteQuickEval(p.id);
      deleted += 1;
    }
  }
  return { checked, deleted };
}

// ── F4: AI konteksts un īss kopsavilkums ──────────────────────────────

export function quickEvalPlainContext(doc: QuickEvalDoc | null): string {
  if (!doc) return "";
  const b = doc.sourceBlocks;
  const parts: string[] = [];
  const csdd = csddFormToPlainText(b.csdd).trim();
  if (csdd) parts.push(`CSDD reģistrs:\n${csdd}`);
  const tirgus = tirgusFormToPlainText(b.tirgus).trim();
  if (tirgus) parts.push(`Sludinājuma vēsture:\n${tirgus}`);
  for (const key of ["tjekbil", "mnt_ee", "lkf_ee", "carinfo", "finnik", "traficom_fi"] as const) {
    const t = vinRegistryBlockToPlainText(b[key], { omitRaw: true }).trim();
    if (t) parts.push(`${SOURCE_BLOCK_LABELS[key]}:\n${t}`);
  }
  return parts.join("\n\n").slice(0, 12_000);
}

export async function quickEvalAiContextForPeek(peekId: string): Promise<string> {
  if (!peekId.trim()) return "";
  return quickEvalPlainContext(await readQuickEval(peekId).catch(() => null));
}

export type QuickEvalBlockSummary = { key: SourceBlockKey; label: string; text: string };

const REGISTRY_KEYS = new Set<SourceBlockKey>(["tjekbil", "mnt_ee", "lkf_ee", "carinfo", "finnik", "traficom_fi"]);

/** Īss, lasāms kopsavilkums kartītei (bez rediģēšanas, lai UI paliek viegls). */
export function quickEvalBlockSummaries(doc: QuickEvalDoc | null): QuickEvalBlockSummary[] {
  if (!doc) return [];
  const b = doc.sourceBlocks;
  const out: QuickEvalBlockSummary[] = [];
  for (const key of Object.keys(SOURCE_BLOCK_LABELS) as SourceBlockKey[]) {
    if (!sourceBlockHasContent(b, key)) continue;
    let text = "";
    if (key === "csdd") text = csddFormToPlainText(b.csdd);
    else if (key === "tirgus") text = tirgusFormToPlainText(b.tirgus);
    else if (REGISTRY_KEYS.has(key)) text = vinRegistryBlockToPlainText(b[key as "tjekbil"], { omitRaw: true });
    else if (key === "listing_analysis") text = String(b.listing_analysis.listingPasteRaw ?? "");
    else text = "Dati ir (atkārtoti izmantoti no iepriekšējā darba).";
    text = text.trim();
    if (!text) continue;
    out.push({ key, label: SOURCE_BLOCK_LABELS[key], text: text.length > 900 ? `${text.slice(0, 900)}…` : text });
  }
  return out;
}
