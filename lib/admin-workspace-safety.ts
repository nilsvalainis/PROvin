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

/** Lauki ārpus tekstiem un blokiem, kas arī jāsalīdzina trīspusēji. */
const WORKSPACE_EXTRA_FIELDS = [
  "technicalRiskMap",
  "odometerAnomalyOverrides",
  "contradictionFeedback",
  "dealerMajorWorkOverrides",
  "dealerSignals",
] as const;

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function textSame(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "") === (b ?? "");
}

export type StaleMergeResult = {
  body: OrderWorkspacePersistBody;
  /** Lauki, kur uzvarēja šīs cilnes izmaiņas. */
  localChanged: string[];
  /** Lauki, ko mainīja abas puses (teksti/apakšlauki: uzvar lokālais; bloki: apvienoti pa laukiem). */
  bothChanged: string[];
  /** Avotu bloki, kurus mainīja abas puses un kas apvienoti pa laukiem (paziņojumam). */
  fieldMergedBlocks: SourceBlockKey[];
};

/**
 * Bloks, ko mainīja gan šī cilne, gan serveris (piem. CSDD maksas izziņa, CARFAX pasts, AutoDNA apply,
 * kamēr Nils pilda to pašu bloku): trīspusēji PA LAUKIEM - šeit mainītais lauks -> lokālais, citādi servera.
 */
function meaningful(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return hasText(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** Bez bāzes: lokāli aizpildītie lauki uzvar, tukšos aizpilda serveris. */
function mergeSourceBlockFieldsNoBase(local: unknown, server: unknown): Record<string, unknown> {
  const l = (local && typeof local === "object" ? local : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...((server && typeof server === "object" ? server : {}) as Record<string, unknown>) };
  for (const [key, v] of Object.entries(l)) if (meaningful(v)) out[key] = v;
  return out;
}

export function mergeSourceBlockFields(local: unknown, server: unknown, base: unknown): Record<string, unknown> {
  const l = (local && typeof local === "object" ? local : {}) as Record<string, unknown>;
  const sv = (server && typeof server === "object" ? server : {}) as Record<string, unknown>;
  const b = (base && typeof base === "object" ? base : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...sv };
  for (const key of new Set([...Object.keys(l), ...Object.keys(b)])) {
    if (same(l[key], b[key])) continue;
    if (l[key] === undefined) delete out[key];
    else out[key] = l[key];
  }
  return out;
}

/**
 * Novecojusi cilne (409) - TRĪSPUSĒJA apvienošana bez pulksteņiem.
 * `base` = servera versija, ko šī cilne pēdējo reizi redzēja vai saglabāja.
 * Lauks, ko šī cilne mainīja (`local !== base`), uzvar (arī iztukšošana); citādi ņem servera versiju
 * (tā satur citu cilņu / servera rakstītāju jaunumus). Bildes apvieno, dzēsto bilžu kapakmeņi uzvar.
 * Bez `base` (nav zināms, ko cilne redzēja) - lokālais aizpildītais uzvar, tukšo aizpilda serveris.
 */
export function mergeStaleLocalWithServer(
  local: OrderWorkspacePersistBody,
  server: OrderWorkspacePersistBody | null | undefined,
  base: OrderWorkspacePersistBody | null | undefined,
): StaleMergeResult {
  const l = normalizeOrderWorkspacePersistBody(local);
  if (!server) return { body: l, localChanged: [], bothChanged: [], fieldMergedBlocks: [] };
  const s = normalizeOrderWorkspacePersistBody(server);
  const b = base ? normalizeOrderWorkspacePersistBody(base) : null;
  const localChanged: string[] = [];
  const bothChanged: string[] = [];
  const fieldMergedBlocks: SourceBlockKey[] = [];
  const note = (k: string, serverChanged: boolean) => {
    localChanged.push(k);
    if (serverChanged) bothChanged.push(k);
  };

  // Teksti.
  const textPick: Partial<Record<WorkspaceTextField, string>> = {};
  for (const f of WORKSPACE_TEXT_FIELDS) {
    const changed = b ? !textSame(l[f], b[f]) : hasText(l[f]);
    if (changed) {
      textPick[f] = l[f] ?? "";
      note(f, b ? !textSame(s[f], b[f]) : hasText(s[f]));
    }
  }

  // Bloki.
  const lBlocks = mergeSourceBlocksWithDefaults(l.sourceBlocks);
  const sBlocks = mergeSourceBlocksWithDefaults(s.sourceBlocks);
  const bBlocks = b ? mergeSourceBlocksWithDefaults(b.sourceBlocks) : null;
  const changedBlocks: SourceBlockKey[] = [];
  /** Šīs cilnes versija katram mainītajam blokam (bothChanged - jau apvienota pa laukiem). */
  const localBlockPick: Partial<Record<SourceBlockKey, Record<string, unknown>>> = {};
  for (const k of SOURCE_BLOCK_KEYS) {
    const changed = bBlocks ? !same(lBlocks[k], bBlocks[k]) : !sourceBlockIsEmpty(k, lBlocks[k]);
    if (!changed) continue;
    changedBlocks.push(k);
    const serverChanged = bBlocks ? !same(sBlocks[k], bBlocks[k]) : !sourceBlockIsEmpty(k, sBlocks[k]);
    note(`block:${k}`, serverChanged);
    if (serverChanged) {
      localBlockPick[k] = bBlocks
        ? mergeSourceBlockFields(lBlocks[k], sBlocks[k], bBlocks[k])
        : mergeSourceBlockFieldsNoBase(lBlocks[k], sBlocks[k]);
      fieldMergedBlocks.push(k);
    } else {
      localBlockPick[k] = lBlocks[k] as unknown as Record<string, unknown>;
    }
  }

  // Pārējie lauki.
  const extraLocal: string[] = [];
  for (const f of WORKSPACE_EXTRA_FIELDS) {
    const changed = b ? !same(l[f], b[f]) : l[f] != null;
    if (changed) {
      extraLocal.push(f);
      note(f, b ? !same(s[f], b[f]) : s[f] != null);
    }
  }
  const aiChanged = b
    ? !same(l.vehicleAiExtraction, b.vehicleAiExtraction) || !same(l.vehicleAiExtractionMeta, b.vehicleAiExtractionMeta)
    : l.vehicleAiExtraction != null;
  if (aiChanged) note("vehicleAiExtraction", b ? !same(s.vehicleAiExtraction, b.vehicleAiExtraction) : s.vehicleAiExtraction != null);
  const previewChanged = b ? l.previewConfirmed !== b.previewConfirmed : l.previewConfirmed;

  // Ienākošais coalesce: servera bāze + šīs cilnes izmaiņas (bildes apvienojas, kapakmeņi uzvar).
  const wipes = parseSourceBlockWipes(l.sourceBlockWipes).filter((k) => changedBlocks.includes(k));
  const sel: OrderWorkspacePersistBody = {
    ...s,
    ...textPick,
    sourceBlocks: { ...sBlocks },
    incidentPhotos: l.incidentPhotos,
    incidentPhotoGroups: l.incidentPhotoGroups,
  };
  for (const k of changedBlocks) (sel.sourceBlocks as Record<SourceBlockKey, unknown>)[k] = localBlockPick[k];
  const freshCleared: Record<string, number> = {};
  for (const [k, t] of Object.entries(parseClearedFields(l.clearedFields))) {
    if (k in textPick || (k.startsWith("block:") && changedBlocks.includes(k.slice(6) as SourceBlockKey))) freshCleared[k] = t;
  }
  sel.clearedFields = freshCleared;
  delete sel.sourceBlockWipes;
  Object.assign(sel, sourceBlockWipesSnapshotField(wipes));
  Object.assign(sel, deletedPhotoIdsSnapshotField(mergeDeletedPhotoIds(l.deletedPhotoIds, s.deletedPhotoIds)));
  const out = coalesceOrderWorkspacePersistBody(sel, s);

  // Šīs cilnes izmaiņas uzvar arī tad, ja coalesce izvēlētos «bagātāko» servera vērtību (dzēsums neatdzīvojas).
  for (const [f, v] of Object.entries(textPick)) out[f as WorkspaceTextField] = v as string;
  const outBlocks = out.sourceBlocks as Record<SourceBlockKey, Record<string, unknown>>;
  for (const k of changedBlocks) {
    const merged = outBlocks[k] ?? {};
    const mine = localBlockPick[k] ?? {};
    const next: Record<string, unknown> = { ...mine };
    // Bildes - apvienotās (ar kapakmeņiem), ja blokam tādas ir.
    for (const pf of ["photos", "photoGroups"]) if (pf in merged) next[pf] = merged[pf];
    outBlocks[k] = next;
  }
  for (const f of WORKSPACE_EXTRA_FIELDS) {
    const v = extraLocal.includes(f) ? l[f] : s[f];
    if (v === undefined) delete (out as Record<string, unknown>)[f];
    else (out as Record<string, unknown>)[f] = v;
  }
  out.vehicleAiExtraction = aiChanged ? l.vehicleAiExtraction : s.vehicleAiExtraction;
  out.vehicleAiExtractionMeta = aiChanged ? l.vehicleAiExtractionMeta : s.vehicleAiExtractionMeta;
  out.previewConfirmed = previewChanged ? l.previewConfirmed : s.previewConfirmed;
  return { body: out, localChanged, bothChanged, fieldMergedBlocks };
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
