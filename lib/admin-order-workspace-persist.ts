/**
 * Pasūtījuma darba zonas serializācija un hidratācijas izvēle (jaunākais `savedAt` uzvar).
 */
import type { ProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

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
    if (hasAnyTimestamp && a.savedAtMs !== b.savedAtMs) {
      return b.savedAtMs - a.savedAtMs;
    }
    const scoreA = a.fillScore ?? 0;
    const scoreB = b.fillScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return rank[b.source] - rank[a.source];
  });
  return sorted[0] ?? null;
}
