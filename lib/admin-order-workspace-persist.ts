/**
 * Pasūtījuma darba zonas serializācija un hidratācijas izvēle (jaunākais `savedAt` uzvar).
 */
import type { ProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  SOURCE_BLOCK_KEYS,
  createDefaultSourceBlocks,
  mergeSourceBlocksWithDefaults,
  type SourceBlockKey,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsTrafficLevel,
  citiAvotiTrafficLevel,
  csddTrafficLevel,
  listingAnalysisTrafficLevel,
  listingSectionTrafficLevel,
  ltabTrafficLevel,
  tirgusTrafficLevel,
  vendorAvotuTrafficLevel,
  type TrafficFillLevel,
} from "@/lib/admin-block-traffic-status";

export type OrderWorkspacePersistBody = {
  sourceBlocks: WorkspaceSourceBlocks;
  iriss: string;
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  previewConfirmed: boolean;
  vehicleAiExtraction: VehicleAIExtraction | null;
  vehicleAiExtractionMeta: VehicleAiExtractionMeta | null;
};

export type WorkspaceHydrationSource = "local" | "backup" | "server";

export type WorkspaceHydrationPick<T> = {
  source: WorkspaceHydrationSource;
  data: T;
  savedAtMs: number;
  /** Jaunākais `savedAt` vienāds — izšķir pēc aizpildījuma (lielāks = labāk). */
  fillScore?: number;
};

export function parseWorkspaceSnapshotSavedAtMs(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0;
  try {
    const p = JSON.parse(raw) as { savedAt?: unknown };
    if (typeof p.savedAt !== "string") return 0;
    const t = Date.parse(p.savedAt);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

const TRAFFIC_RANK: Record<TrafficFillLevel, number> = { empty: 0, partial: 1, complete: 2 };

function sourceBlockTrafficRank(key: SourceBlockKey, block: WorkspaceSourceBlocks[SourceBlockKey]): number {
  switch (key) {
    case "csdd":
      return TRAFFIC_RANK[csddTrafficLevel(block as WorkspaceSourceBlocks["csdd"])];
    case "autodna":
    case "carvertical":
      return TRAFFIC_RANK[vendorAvotuTrafficLevel(block as WorkspaceSourceBlocks["autodna"])];
    case "auto_records":
      return TRAFFIC_RANK[autoRecordsTrafficLevel(block as WorkspaceSourceBlocks["auto_records"])];
    case "ltab":
      return TRAFFIC_RANK[ltabTrafficLevel(block as WorkspaceSourceBlocks["ltab"])];
    case "citi_avoti":
      return TRAFFIC_RANK[citiAvotiTrafficLevel(block as WorkspaceSourceBlocks["citi_avoti"])];
    case "tirgus":
      return TRAFFIC_RANK[tirgusTrafficLevel(block as WorkspaceSourceBlocks["tirgus"])];
    case "listing_analysis":
      return TRAFFIC_RANK[listingAnalysisTrafficLevel(block as WorkspaceSourceBlocks["listing_analysis"])];
    default:
      return 0;
  }
}

/** Cik atslēgu ir `sourceBlocks` pirms merge (zemāks = nepilnīgs / bīstams melnraksts). */
export function countRawSourceBlockKeys(partial: unknown): number {
  if (!partial || typeof partial !== "object") return 0;
  const o = partial as Record<string, unknown>;
  let n = 0;
  for (const key of SOURCE_BLOCK_KEYS) {
    if (o[key] != null && typeof o[key] === "object") n += 1;
  }
  return n;
}

/** Apgriež HTML bieži tukšu `<p><br></p>` — neuzskatīt par „bagātāku” par īsu lietotāja tekstu (IRISS u.c.). */
function substantivePlainTextLen(htmlOrText: string): number {
  return htmlOrText
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function pickRicherTextField(incoming: string, baseline: string): string {
  const inLen = substantivePlainTextLen(incoming);
  const baseLen = substantivePlainTextLen(baseline);
  if (baseLen === 0) return incoming;
  if (inLen === 0) return baseline;
  return inLen >= baseLen ? incoming : baseline;
}

function pickRicherSourceBlock<K extends SourceBlockKey>(
  key: K,
  incoming: WorkspaceSourceBlocks[K],
  baseline: WorkspaceSourceBlocks[K],
): WorkspaceSourceBlocks[K] {
  const inRank = sourceBlockTrafficRank(key, incoming);
  const baseRank = sourceBlockTrafficRank(key, baseline);
  if (inRank > baseRank) return incoming;
  if (baseRank > inRank) return baseline;
  return incoming;
}

/**
 * Apvieno ienākošo darba zonu ar pēdējo zināmo labo momentuzņēmumu — nekad neiztukšo bloku,
 * kurā baseline jau bija dati (piem. saglabā AutoDNA, ja saglabā tikai Citi avoti).
 */
export function coalesceOrderWorkspacePersistBody(
  incoming: OrderWorkspacePersistBody,
  baseline: OrderWorkspacePersistBody | null | undefined,
): OrderWorkspacePersistBody {
  const incomingBlocks = mergeSourceBlocksWithDefaults(incoming.sourceBlocks);
  if (!baseline) {
    return { ...incoming, sourceBlocks: incomingBlocks };
  }
  const baselineBlocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  const mergedBlocks: WorkspaceSourceBlocks = {
    csdd: pickRicherSourceBlock("csdd", incomingBlocks.csdd, baselineBlocks.csdd),
    autodna: pickRicherSourceBlock("autodna", incomingBlocks.autodna, baselineBlocks.autodna),
    carvertical: pickRicherSourceBlock("carvertical", incomingBlocks.carvertical, baselineBlocks.carvertical),
    auto_records: pickRicherSourceBlock("auto_records", incomingBlocks.auto_records, baselineBlocks.auto_records),
    ltab: pickRicherSourceBlock("ltab", incomingBlocks.ltab, baselineBlocks.ltab),
    tirgus: pickRicherSourceBlock("tirgus", incomingBlocks.tirgus, baselineBlocks.tirgus),
    citi_avoti: pickRicherSourceBlock("citi_avoti", incomingBlocks.citi_avoti, baselineBlocks.citi_avoti),
    listing_analysis: pickRicherSourceBlock(
      "listing_analysis",
      incomingBlocks.listing_analysis,
      baselineBlocks.listing_analysis,
    ),
  };
  return {
    sourceBlocks: mergeSourceBlocksWithDefaults(mergedBlocks),
    iriss: pickRicherTextField(incoming.iriss, baseline.iriss),
    apskatesPlāns: pickRicherTextField(incoming.apskatesPlāns, baseline.apskatesPlāns),
    cenasAtbilstiba: pickRicherTextField(incoming.cenasAtbilstiba, baseline.cenasAtbilstiba),
    previewConfirmed: incoming.previewConfirmed || baseline.previewConfirmed,
    vehicleAiExtraction: incoming.vehicleAiExtraction ?? baseline.vehicleAiExtraction,
    vehicleAiExtractionMeta: incoming.vehicleAiExtractionMeta ?? baseline.vehicleAiExtractionMeta,
  };
}

/** Vai ienākošais melnraksts ir būtiski „tukšāks” par baseline (noraida regresīvu PATCH). */
export function isRegressiveWorkspacePersist(
  incoming: OrderWorkspacePersistBody,
  baseline: OrderWorkspacePersistBody | null | undefined,
): boolean {
  if (!baseline) return false;
  const coalesced = coalesceOrderWorkspacePersistBody(incoming, baseline);
  const inScore = workspaceHydrationFillScore(coalesced);
  const baseScore = workspaceHydrationFillScore(baseline);
  return inScore + 2 < baseScore;
}

/** API / server melnraksts — pilns darba zonas JSON (iesk. AI ekstrakciju). */
export function buildOrderDraftWorkspaceBody(
  body: OrderWorkspacePersistBody,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
  /** Tikai īpašiem servera merge gadījumiem; klienta PATCH vienmēr bez baseline. */
  baseline?: OrderWorkspacePersistBody | null,
): OrderDraftWorkspaceBody {
  const safe =
    baseline != null ? coalesceOrderWorkspacePersistBody(body, baseline) : normalizeOrderWorkspacePersistBody(body);
  return {
    sourceBlocks: safe.sourceBlocks,
    iriss: safe.iriss,
    apskatesPlāns: safe.apskatesPlāns,
    cenasAtbilstiba: safe.cenasAtbilstiba,
    previewConfirmed: safe.previewConfirmed,
    pdfVisibility: pdf,
    pdfBannerInclude: bannerInclude,
    vehicleAiExtraction: safe.vehicleAiExtraction,
    vehicleAiExtractionMeta: safe.vehicleAiExtractionMeta,
  };
}

/** Jaunākā rezerves kopija pēc `savedAt` (masīvs jaunākais elements pirmais). */
export function pickNewestBackupSnapshotRaw(rawBackup: string | null): {
  data: string;
  savedAtMs: number;
} | null {
  if (!rawBackup) return null;
  try {
    const arr = JSON.parse(rawBackup) as { savedAt?: string; data?: string }[];
    if (!Array.isArray(arr)) return null;
    let best: { data: string; savedAtMs: number } | null = null;
    for (const item of arr) {
      if (!item || typeof item.data !== "string") continue;
      const t = typeof item.savedAt === "string" ? Date.parse(item.savedAt) : 0;
      const savedAtMs = Number.isFinite(t) ? t : 0;
      if (!best || savedAtMs > best.savedAtMs) {
        best = { data: item.data, savedAtMs };
      }
    }
    return best;
  } catch {
    return null;
  }
}

/** Pilni bloki no atmiņas — bez baseline apvienošanas (localStorage uzticības avots). */
export function normalizeOrderWorkspacePersistBody(body: OrderWorkspacePersistBody): OrderWorkspacePersistBody {
  const merged = mergeSourceBlocksWithDefaults(body.sourceBlocks);
  const complete: WorkspaceSourceBlocks = { ...createDefaultSourceBlocks(), ...merged };
  return {
    sourceBlocks: complete,
    iriss: body.iriss,
    apskatesPlāns: body.apskatesPlāns,
    cenasAtbilstiba: body.cenasAtbilstiba,
    previewConfirmed: body.previewConfirmed,
    vehicleAiExtraction: body.vehicleAiExtraction,
    vehicleAiExtractionMeta: body.vehicleAiExtractionMeta,
  };
}

/** Tieša serializācija — katrs keystroke / PDF imports raksta tieši `wsPersistRef` saturu. */
export function serializeOrderWorkspaceSnapshotFromRef(
  body: OrderWorkspacePersistBody,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
  savedAt = new Date().toISOString(),
): string {
  const normalized = normalizeOrderWorkspacePersistBody(body);
  return JSON.stringify({
    sourceBlocks: normalized.sourceBlocks,
    iriss: normalized.iriss,
    apskatesPlāns: normalized.apskatesPlāns,
    cenasAtbilstiba: normalized.cenasAtbilstiba,
    previewConfirmed: normalized.previewConfirmed,
    pdfVisibility: pdf,
    pdfBannerInclude: bannerInclude,
    vehicleAiExtraction: normalized.vehicleAiExtraction,
    vehicleAiExtractionMeta: normalized.vehicleAiExtractionMeta,
    savedAt,
  });
}

export function serializeOrderWorkspaceSnapshot(
  body: OrderWorkspacePersistBody,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
  savedAt = new Date().toISOString(),
  baseline?: OrderWorkspacePersistBody | null,
): string {
  const safe = coalesceOrderWorkspacePersistBody(body, baseline ?? null);
  return JSON.stringify({
    sourceBlocks: safe.sourceBlocks,
    iriss: safe.iriss,
    apskatesPlāns: safe.apskatesPlāns,
    cenasAtbilstiba: safe.cenasAtbilstiba,
    previewConfirmed: safe.previewConfirmed,
    pdfVisibility: pdf,
    pdfBannerInclude: bannerInclude,
    vehicleAiExtraction: safe.vehicleAiExtraction,
    vehicleAiExtractionMeta: safe.vehicleAiExtractionMeta,
    savedAt,
  });
}

/** Hidratācija — salipina visus avotus bloku pa blokam (neizmet AutoDNA, ja local ir tikai Citi avoti). */
export function mergeWorkspaceHydrationBodies(
  bodies: (OrderWorkspacePersistBody | null | undefined)[],
): OrderWorkspacePersistBody {
  const empty: OrderWorkspacePersistBody = {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
  };
  let merged = empty;
  for (const b of bodies) {
    if (b) merged = coalesceOrderWorkspacePersistBody(merged, b);
  }
  return merged;
}

/** Jaunākais `savedAt` uzvar; bez laika zīmoga — `fillScore` un avota prioritāte. */
export function pickNewestWorkspaceHydration<T>(candidates: WorkspaceHydrationPick<T>[]): WorkspaceHydrationPick<T> | null {
  if (candidates.length === 0) return null;
  const rank: Record<WorkspaceHydrationSource, number> = { local: 3, backup: 2, server: 1 };
  const hasAnyTimestamp = candidates.some((c) => c.savedAtMs > 0);
  const sorted = [...candidates].sort((a, b) => {
    if (hasAnyTimestamp) {
      const aTs = a.savedAtMs > 0 ? a.savedAtMs : -1;
      const bTs = b.savedAtMs > 0 ? b.savedAtMs : -1;
      if (aTs !== bTs) return bTs - aTs;
    }
    const scoreA = a.fillScore ?? 0;
    const scoreB = b.fillScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return rank[b.source] - rank[a.source];
  });
  return sorted[0] ?? null;
}

/**
 * Ja `localStorage` ir jaunāks par izvēlēto avotu, vienmēr uzvar pārlūks —
 * servera vecāks / nepilnīgs JSON nedrīkst pārrakstīt lokālo.
 */
export function applyStrictLocalTimestampHydration<T>(
  picked: WorkspaceHydrationPick<T> | null,
  local: WorkspaceHydrationPick<T> | null,
): WorkspaceHydrationPick<T> | null {
  if (!picked || !local || picked.source === "local") return picked;
  if (local.savedAtMs > 0 && picked.savedAtMs > 0 && local.savedAtMs > picked.savedAtMs) {
    return local;
  }
  return picked;
}

/** Nepilnīgs `sourceBlocks` (< 4 atslēgas) ar augstu citu avotu score — aizdomīgs melnraksts. */
export function isSuspiciouslyIncompleteWorkspaceSnapshot(
  rawSourceBlocks: unknown,
  fillScore: number,
): boolean {
  const keyCount = countRawSourceBlockKeys(rawSourceBlocks);
  return keyCount > 0 && keyCount < 4 && fillScore <= 3;
}

/** Aizpildījuma heuristika hidratācijai — jaunāks `savedAt` ar tukšu serveri nedrīkst pārrakstīt bagātīgu localStorage. */
export function workspaceHydrationFillScore(body: OrderWorkspacePersistBody): number {
  let s = 0;
  if (body.iriss.trim()) s += 2;
  if (body.apskatesPlāns.trim()) s += 2;
  if (body.cenasAtbilstiba.trim()) s += 2;
  if (body.previewConfirmed) s += 1;
  s += csddTrafficLevel(body.sourceBlocks.csdd) === "empty" ? 0 : 2;
  s += vendorAvotuTrafficLevel(body.sourceBlocks.autodna) === "empty" ? 0 : 1;
  s += vendorAvotuTrafficLevel(body.sourceBlocks.carvertical) === "empty" ? 0 : 1;
  s += autoRecordsTrafficLevel(body.sourceBlocks.auto_records) === "empty" ? 0 : 1;
  s += ltabTrafficLevel(body.sourceBlocks.ltab) === "empty" ? 0 : 1;
  s += citiAvotiTrafficLevel(body.sourceBlocks.citi_avoti) === "empty" ? 0 : 1;
  s +=
    listingSectionTrafficLevel(body.sourceBlocks.tirgus, body.sourceBlocks.listing_analysis) === "empty" ? 0 : 1;
  return s;
}

/** Vai lokālajā melnrakstā ir reāli dati (ne tikai tukši noklusējuma bloki). */
export function localWorkspaceHasSubstantiveContent(body: OrderWorkspacePersistBody): boolean {
  const hasText = (s: string, min = 8) => s.trim().length >= min;
  if (hasText(body.iriss) || hasText(body.apskatesPlāns) || hasText(body.cenasAtbilstiba)) return true;
  const b = mergeSourceBlocksWithDefaults(body.sourceBlocks);
  if (hasText(b.autodna.comments) || hasText(b.carvertical.comments)) return true;
  if (hasText(b.autodna.mileagePasteRaw ?? "", 12) || hasText(b.carvertical.mileagePasteRaw ?? "", 12)) {
    return true;
  }
  if (vendorAvotuTrafficLevel(b.autodna) !== "empty" || vendorAvotuTrafficLevel(b.carvertical) !== "empty") {
    return true;
  }
  if (tirgusTrafficLevel(b.tirgus) !== "empty" || listingAnalysisTrafficLevel(b.listing_analysis) !== "empty") {
    return true;
  }
  if (csddTrafficLevel(b.csdd) !== "empty") return true;
  if (autoRecordsTrafficLevel(b.auto_records) !== "empty" || ltabTrafficLevel(b.ltab) !== "empty") {
    return true;
  }
  for (const section of b.citi_avoti.sections) {
    if (hasText(section.rawUnprocessedData ?? "", 12) || hasText(section.comments)) return true;
  }
  return false;
}

/** Hidratācijas izvēle: jaunākais `savedAt`; lokālais uzvar, ja jaunāks par izvēlēto. */
export function pickWorkspaceHydrationCandidate<T>(
  candidates: WorkspaceHydrationPick<T>[],
  local: WorkspaceHydrationPick<T> | null,
  rawSourceBlocksBySource?: Partial<Record<WorkspaceHydrationSource, unknown>>,
): WorkspaceHydrationPick<T> | null {
  const filtered = candidates.filter((c) => {
    const raw = rawSourceBlocksBySource?.[c.source];
    if (raw == null) return true;
    return !isSuspiciouslyIncompleteWorkspaceSnapshot(raw, c.fillScore ?? 0);
  });
  const pool = filtered.length > 0 ? filtered : candidates;
  let picked = pickNewestWorkspaceHydration(pool);
  picked = applyStrictLocalTimestampHydration(picked, local);
  return picked;
}

/**
 * Ja pārlūkā ir derīgs `localStorage`, vienmēr tas — nevis servera/backup „frankenšteins”
 * (vecāki bloki no citas laika zīmes nedrīkst sajaukties ar jaunākiem).
 */
/** Ja pārlūkā ir parsējams melnraksts — vienmēr tas (servera `updatedAt` no `orderEdits` nedrīkst pārrakstīt). */
export function pickOrderWorkspaceHydrationForLoad<T>(
  candidates: WorkspaceHydrationPick<T>[],
  local: WorkspaceHydrationPick<T> | null,
  rawSourceBlocksBySource?: Partial<Record<WorkspaceHydrationSource, unknown>>,
): WorkspaceHydrationPick<T> | null {
  if (local && local.source === "local") {
    return local;
  }
  return pickWorkspaceHydrationCandidate(candidates, local, rawSourceBlocksBySource);
}

/** Apvieno divus hidratētos ierakstus bloku pa blokam (drošs reload). */
export function mergeHydratedWorkspaceBodies(
  primary: OrderWorkspacePersistBody,
  secondary: OrderWorkspacePersistBody,
): OrderWorkspacePersistBody {
  return coalesceOrderWorkspacePersistBody(primary, secondary);
}
