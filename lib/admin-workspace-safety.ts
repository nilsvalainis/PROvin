/**
 * Pasūtījuma darba zonas datu drošība (25.11 incidents WVWZZZ3CZNE054721).
 * Tīras funkcijas - lieto gan serveris (shrink aizsargs), gan klients (apvienošana, lokālā kopija).
 */
import { mergeSourceBlocksWithDefaults, SOURCE_BLOCK_KEYS, type SourceBlockKey } from "@/lib/admin-source-blocks";
import {
  coalesceOrderWorkspacePersistBody,
  normalizeOrderWorkspacePersistBody,
  sourceBlockIsEmpty,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { parseClearedFields } from "@/lib/admin-cleared-fields";
import { parseSourceBlockWipes, sourceBlockWipesSnapshotField } from "@/lib/admin-source-block-wipes";
import { mergeDeletedPhotoIds, deletedPhotoIdsSnapshotField } from "@/lib/admin-photo-tombstones";

export const WORKSPACE_TEXT_FIELDS = ["iriss", "apskatesPlāns", "tehniskoRiskuAnalize", "cenasAtbilstiba"] as const;
export type WorkspaceTextField = (typeof WORKSPACE_TEXT_FIELDS)[number];

/** Lauka atslēga laika zīmogiem: teksta lauks, `block:<avots>` vai `incidentPhotos`. */
export type WorkspaceEditKey = WorkspaceTextField | `block:${SourceBlockKey}` | "incidentPhotos";
export type WorkspaceEditStamps = Partial<Record<WorkspaceEditKey, number>>;

function hasText(v: string | null | undefined): boolean {
  if (!v) return false;
  return v.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0;
}

export type WorkspaceFillCount = {
  /** Aizpildītie teksta lauki (+1, ja ir incidentu bildes). */
  fields: number;
  /** Aizpildītie avotu bloki. */
  blocks: number;
  total: number;
};

/** Cik lauku/bloku ir aizpildīti (bez satura - tikai skaitļi žurnālam un salīdzināšanai). */
export function countWorkspaceFilled(body: OrderWorkspacePersistBody | null | undefined): WorkspaceFillCount {
  if (!body) return { fields: 0, blocks: 0, total: 0 };
  let fields = 0;
  for (const f of WORKSPACE_TEXT_FIELDS) if (hasText(body[f])) fields += 1;
  if ((body.incidentPhotos?.length ?? 0) > 0) fields += 1;
  const blocksAll = mergeSourceBlocksWithDefaults(body.sourceBlocks);
  let blocks = 0;
  for (const k of SOURCE_BLOCK_KEYS) {
    if (!sourceBlockIsEmpty(k, blocksAll[k])) blocks += 1;
  }
  return { fields, blocks, total: fields + blocks };
}

export type WorkspaceShrink = {
  shrink: boolean;
  prev: WorkspaceFillCount;
  next: WorkspaceFillCount;
};

/**
 * Vai jaunais saturs ir būtiski «tukšāks»: aizpildīto lauku/bloku kopskaits krītas par ≥50 %
 * vai pazūd ≥5 aizpildīti bloki.
 */
export function detectWorkspaceShrink(
  prev: OrderWorkspacePersistBody | null | undefined,
  next: OrderWorkspacePersistBody | null | undefined,
): WorkspaceShrink {
  const p = countWorkspaceFilled(prev);
  const n = countWorkspaceFilled(next);
  const shrink = p.total > 0 && (n.total * 2 <= p.total || p.blocks - n.blocks >= 5);
  return { shrink, prev: p, next: n };
}

/**
 * Lokālās kopijas atjaunošana: aizpilda TIKAI tukšos servera laukus/blokus no lokālās kopijas.
 * Servera aizpildītie lauki nekad netiek mainīti.
 */
export function fillEmptyServerFieldsFromLocal(
  server: OrderWorkspacePersistBody,
  local: OrderWorkspacePersistBody,
): { body: OrderWorkspacePersistBody; filled: string[] } {
  const s = normalizeOrderWorkspacePersistBody(server);
  const l = normalizeOrderWorkspacePersistBody(local);
  const filled: string[] = [];
  const out: OrderWorkspacePersistBody = { ...s, sourceBlocks: { ...s.sourceBlocks } };
  for (const f of WORKSPACE_TEXT_FIELDS) {
    if (!hasText(s[f]) && hasText(l[f])) {
      out[f] = l[f];
      filled.push(f);
    }
  }
  const blocks = out.sourceBlocks as Record<SourceBlockKey, unknown>;
  for (const k of SOURCE_BLOCK_KEYS) {
    if (sourceBlockIsEmpty(k, s.sourceBlocks[k]) && !sourceBlockIsEmpty(k, l.sourceBlocks[k])) {
      blocks[k] = l.sourceBlocks[k];
      filled.push(`block:${k}`);
    }
  }
  if ((s.incidentPhotos?.length ?? 0) === 0 && (l.incidentPhotos?.length ?? 0) > 0) {
    out.incidentPhotos = l.incidentPhotos;
    out.incidentPhotoGroups = l.incidentPhotoGroups;
    filled.push("incidentPhotos");
  }
  if (!s.vehicleAiExtraction && l.vehicleAiExtraction) {
    out.vehicleAiExtraction = l.vehicleAiExtraction;
    out.vehicleAiExtractionMeta = l.vehicleAiExtractionMeta;
  }
  out.previewConfirmed = s.previewConfirmed || l.previewConfirmed;
  return { body: normalizeOrderWorkspacePersistBody(out), filled };
}

/**
 * Novecojusi cilne (409): servera aizpildītie lauki paliek; lokālie aizpilda tukšos
 * vai tos, ko lietotājs šajā cilnē mainīja PĒC servera saglabāšanas (`stamps[k] > serverSavedAtMs`).
 * Bildes apvieno, dzēsto bilžu kapakmeņi uzvar.
 */
export function mergeStaleLocalWithServer(
  local: OrderWorkspacePersistBody,
  server: OrderWorkspacePersistBody | null | undefined,
  stamps: WorkspaceEditStamps,
  serverSavedAtMs: number,
): OrderWorkspacePersistBody {
  const l = normalizeOrderWorkspacePersistBody(local);
  if (!server) return l;
  const s = normalizeOrderWorkspacePersistBody(server);
  const newer = (k: WorkspaceEditKey) => (stamps[k] ?? 0) > serverSavedAtMs;
  const sel: OrderWorkspacePersistBody = { ...s, sourceBlocks: { ...s.sourceBlocks } };
  for (const f of WORKSPACE_TEXT_FIELDS) {
    if (!hasText(s[f])) sel[f] = l[f];
    else if (newer(f) && hasText(l[f])) sel[f] = l[f];
  }
  const blocks = sel.sourceBlocks as Record<SourceBlockKey, unknown>;
  for (const k of SOURCE_BLOCK_KEYS) {
    if (sourceBlockIsEmpty(k, s.sourceBlocks[k])) blocks[k] = l.sourceBlocks[k];
    else if (newer(`block:${k}`) && !sourceBlockIsEmpty(k, l.sourceBlocks[k])) blocks[k] = l.sourceBlocks[k];
  }
  // Apzināta iztukšošana / bloka notīrīšana šajā cilnē - tikai, ja jaunāka par servera saglabāšanu.
  const cleared = parseClearedFields(l.clearedFields);
  const freshCleared: Record<string, number> = {};
  for (const [k, t] of Object.entries(cleared)) {
    if (t > serverSavedAtMs) {
      freshCleared[k] = t;
      if ((WORKSPACE_TEXT_FIELDS as readonly string[]).includes(k)) sel[k as WorkspaceTextField] = l[k as WorkspaceTextField];
    }
  }
  const wipes = parseSourceBlockWipes(l.sourceBlockWipes).filter((k) => newer(`block:${k}`));
  for (const k of wipes) blocks[k] = l.sourceBlocks[k];
  sel.clearedFields = freshCleared;
  Object.assign(sel, sourceBlockWipesSnapshotField(wipes));
  if (!wipes.length) delete sel.sourceBlockWipes;
  Object.assign(sel, deletedPhotoIdsSnapshotField(mergeDeletedPhotoIds(l.deletedPhotoIds, s.deletedPhotoIds)));
  sel.incidentPhotos = l.incidentPhotos;
  sel.incidentPhotoGroups = l.incidentPhotoGroups;
  sel.previewConfirmed = s.previewConfirmed || l.previewConfirmed;
  sel.vehicleAiExtraction = s.vehicleAiExtraction ?? l.vehicleAiExtraction;
  sel.vehicleAiExtractionMeta = s.vehicleAiExtractionMeta ?? l.vehicleAiExtractionMeta;
  return coalesceOrderWorkspacePersistBody(sel, s);
}

/** Salīdzina divus stāvokļus un atgriež mainītos laukus (atsauce, tad JSON). */
export function changedWorkspaceEditKeys(
  prev: OrderWorkspacePersistBody | null | undefined,
  next: OrderWorkspacePersistBody | null | undefined,
): WorkspaceEditKey[] {
  if (!prev || !next || prev === next) return [];
  const out: WorkspaceEditKey[] = [];
  for (const f of WORKSPACE_TEXT_FIELDS) if ((prev[f] ?? "") !== (next[f] ?? "")) out.push(f);
  const pb = prev.sourceBlocks as Record<string, unknown> | undefined;
  const nb = next.sourceBlocks as Record<string, unknown> | undefined;
  if (pb !== nb) {
    for (const k of SOURCE_BLOCK_KEYS) {
      const a = pb?.[k];
      const b = nb?.[k];
      if (a === b) continue;
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(`block:${k}`);
    }
  }
  if (prev.incidentPhotos !== next.incidentPhotos) {
    if (JSON.stringify(prev.incidentPhotos ?? []) !== JSON.stringify(next.incidentPhotos ?? [])) out.push("incidentPhotos");
  }
  return out;
}

export type WorkspaceUnsavedReason = "persistence_off" | "not_hydrated" | "revision_conflict" | "save_error" | "pending";

/** Kāpēc lokālās izmaiņas nav serverī (prioritārā secībā). */
export function workspaceUnsavedReason(s: {
  persistenceEnabled: boolean;
  hydrated: boolean;
  revisionConflict: boolean;
  saveError: boolean;
}): WorkspaceUnsavedReason {
  if (!s.persistenceEnabled) return "persistence_off";
  if (!s.hydrated) return "not_hydrated";
  if (s.revisionConflict) return "revision_conflict";
  if (s.saveError) return "save_error";
  return "pending";
}

export const WORKSPACE_UNSAVED_WARN_MS = 10_000;

/** Vai rādīt «Nav saglabāts serverī» / sūtīt beacon: lokālas izmaiņas gaida ≥10 s. */
export function shouldWarnWorkspaceUnsaved(s: {
  unsavedSinceMs: number | null;
  nowMs: number;
  saveInFlight: boolean;
  thresholdMs?: number;
}): boolean {
  if (s.unsavedSinceMs == null) return false;
  if (s.saveInFlight) return false;
  return s.nowMs - s.unsavedSinceMs >= (s.thresholdMs ?? WORKSPACE_UNSAVED_WARN_MS);
}
