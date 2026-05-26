/**
 * Pasūtījuma darba zonas serializācija un hidratācijas izvēle (jaunākais `savedAt` uzvar).
 */
import type { ProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  autoRecordsTrafficLevel,
  citiAvotiTrafficLevel,
  csddTrafficLevel,
  listingSectionTrafficLevel,
  ltabTrafficLevel,
  vendorAvotuTrafficLevel,
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

/** API / server melnraksts — pilns darba zonas JSON (iesk. AI ekstrakciju). */
export function buildOrderDraftWorkspaceBody(
  body: OrderWorkspacePersistBody,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: body.sourceBlocks,
    iriss: body.iriss,
    apskatesPlāns: body.apskatesPlāns,
    cenasAtbilstiba: body.cenasAtbilstiba,
    previewConfirmed: body.previewConfirmed,
    pdfVisibility: pdf,
    pdfBannerInclude: bannerInclude,
    vehicleAiExtraction: body.vehicleAiExtraction,
    vehicleAiExtractionMeta: body.vehicleAiExtractionMeta,
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

export function serializeOrderWorkspaceSnapshot(
  body: OrderWorkspacePersistBody,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
  savedAt = new Date().toISOString(),
): string {
  return JSON.stringify({
    sourceBlocks: body.sourceBlocks,
    iriss: body.iriss,
    apskatesPlāns: body.apskatesPlāns,
    cenasAtbilstiba: body.cenasAtbilstiba,
    previewConfirmed: body.previewConfirmed,
    pdfVisibility: pdf,
    pdfBannerInclude: bannerInclude,
    vehicleAiExtraction: body.vehicleAiExtraction,
    vehicleAiExtractionMeta: body.vehicleAiExtractionMeta,
    savedAt,
  });
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

/**
 * Ja lokālajā ir vairāk datu nekā izvēlētajā avotā, saglabāt localStorage (admin labojumi pēc PDF / navigācijas).
 */
export function preferRicherLocalWorkspaceHydration<T>(
  picked: WorkspaceHydrationPick<T> | null,
  local: WorkspaceHydrationPick<T> | null,
): WorkspaceHydrationPick<T> | null {
  if (!picked || !local || picked.source === "local") return picked;
  const localScore = local.fillScore ?? 0;
  const pickedScore = picked.fillScore ?? 0;
  if (localScore >= pickedScore + 2) return local;
  if (local.savedAtMs > 0 && local.savedAtMs >= picked.savedAtMs - 3000 && localScore > pickedScore) {
    return local;
  }
  return picked;
}
