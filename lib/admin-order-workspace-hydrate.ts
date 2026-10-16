/**
 * Admin darba zonas ielāde: uzvar jaunākais `savedAt` starp pārlūka melnrakstu, rezerves kopiju un serveri
 * (K3 — vecs local vairs nepārraksta jaunāku servera versiju no citas ierīces).
 */
import {
  createDefaultSourceBlocks,
  emptyVendorAvotuBlock,
  hydrateWorkspaceFromStorage,
} from "@/lib/admin-source-blocks";
import {
  parseWorkspaceSnapshotSavedAtMs,
  pickNewestBackupSnapshotRaw,
  workspaceHydrationFillScore,
} from "@/lib/admin-order-workspace-persist";
import {
  applyOrderPdfVisibilityDefaults,
  defaultPdfVisibilityForOrder,
} from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude } from "@/lib/provin-alert-banners";

export type WorkspaceHydrateSource = "local" | "backup" | "server" | "legacy" | "empty";

export type HydratedWorkspaceSnapshot = NonNullable<ReturnType<typeof hydrateWorkspaceFromStorage>>;

export type ResolvedWorkspaceHydration = {
  source: WorkspaceHydrateSource;
  hydrated: HydratedWorkspaceSnapshot;
  workspaceRevision: number;
};

function revisionFromRaw(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0;
  try {
    const p = JSON.parse(raw) as { workspaceRevision?: unknown };
    return typeof p.workspaceRevision === "number" && p.workspaceRevision > 0 ? p.workspaceRevision : 0;
  } catch {
    return 0;
  }
}

export function resolveOrderWorkspaceHydration(args: {
  localRaw: string | null;
  localRawLegacyV2: string | null;
  backupRaw: string | null;
  serverWorkspaceJson: string | null;
  serverInternalComment?: string | null;
  legacyInternalRaw?: string | null;
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
  notes?: string | null;
}): ResolvedWorkspaceHydration {
  const orderPdfArgs = {
    checkoutLine: args.checkoutLine,
    amountTotalCents: args.amountTotalCents,
    partnerId: args.partnerId,
    partnerCompanyName: args.partnerCompanyName,
    notes: args.notes,
  };
  const emptyVisibility = defaultPdfVisibilityForOrder(orderPdfArgs);
  const withOrderDefaults = (hydrated: HydratedWorkspaceSnapshot): HydratedWorkspaceSnapshot => ({
    ...hydrated,
    pdfVisibility: applyOrderPdfVisibilityDefaults(hydrated.pdfVisibility, orderPdfArgs),
  });
  const localRaw = args.localRaw?.trim() ? args.localRaw : args.localRawLegacyV2?.trim() ? args.localRawLegacyV2 : null;

  // K3: uzvar jaunākais `savedAt` (local / backup / server). Vienāds vai nezināms laiks → local > backup > server (vecā secība).
  const backupPick = pickNewestBackupSnapshotRaw(args.backupRaw);
  const candidates: { source: "local" | "backup" | "server"; raw: string; savedAtMs: number; rank: number }[] = [];
  if (localRaw) candidates.push({ source: "local", raw: localRaw, savedAtMs: parseWorkspaceSnapshotSavedAtMs(localRaw), rank: 0 });
  if (backupPick) {
    candidates.push({
      source: "backup",
      raw: backupPick.data,
      savedAtMs: Math.max(backupPick.savedAtMs, parseWorkspaceSnapshotSavedAtMs(backupPick.data)),
      rank: 1,
    });
  }
  if (args.serverWorkspaceJson?.trim()) {
    candidates.push({
      source: "server",
      raw: args.serverWorkspaceJson,
      savedAtMs: parseWorkspaceSnapshotSavedAtMs(args.serverWorkspaceJson),
      rank: 2,
    });
  }
  const scored = candidates
    .map((c) => {
      const hydrated = hydrateWorkspaceFromStorage(c.raw);
      if (!hydrated) return null;
      const fillScore = workspaceHydrationFillScore({
        sourceBlocks: hydrated.sourceBlocks,
        iriss: hydrated.iriss,
        apskatesPlāns: hydrated.apskatesPlāns,
        tehniskoRiskuAnalize: hydrated.tehniskoRiskuAnalize,
        cenasAtbilstiba: hydrated.cenasAtbilstiba,
        previewConfirmed: hydrated.previewConfirmed,
        vehicleAiExtraction: hydrated.vehicleAiExtraction ?? null,
        vehicleAiExtractionMeta: hydrated.vehicleAiExtractionMeta ?? null,
        incidentPhotoGroups: hydrated.incidentPhotoGroups ?? [],
        incidentPhotos: hydrated.incidentPhotos ?? [],
      });
      return { ...c, hydrated, fillScore };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);
  scored.sort((a, b) => {
    if (a.savedAtMs !== b.savedAtMs) {
      const newer = a.savedAtMs > b.savedAtMs ? a : b;
      const older = a.savedAtMs > b.savedAtMs ? b : a;
      if (newer.fillScore >= older.fillScore) return b.savedAtMs - a.savedAtMs;
      return b.fillScore - a.fillScore || b.savedAtMs - a.savedAtMs;
    }
    if (b.fillScore !== a.fillScore) return b.fillScore - a.fillScore;
    return a.rank - b.rank;
  });
  const winner = scored[0];
  if (winner) {
    return {
      source: winner.source,
      hydrated: withOrderDefaults(winner.hydrated),
      workspaceRevision: revisionFromRaw(winner.raw),
    };
  }

  const legacy = args.legacyInternalRaw?.trim();
  const serverC = args.serverInternalComment?.trim();
  if (legacy || serverC) {
    const blocks = createDefaultSourceBlocks();
    const parts: string[] = [];
    if (serverC) parts.push(serverC);
    if (legacy) parts.push(legacy);
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: parts.join("\n\n") };
    return {
      source: "legacy",
      hydrated: {
        sourceBlocks: blocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        pdfVisibility: emptyVisibility,
        pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
        manualBanners: [],
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
        incidentPhotoGroups: [],
        incidentPhotos: [],
      },
      workspaceRevision: 0,
    };
  }

  const emptyBlocks = createDefaultSourceBlocks();
  return {
    source: "empty",
    hydrated: {
      sourceBlocks: emptyBlocks,
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      pdfVisibility: emptyVisibility,
      pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
      manualBanners: [],
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
      incidentPhotoGroups: [],
      incidentPhotos: [],
    },
    workspaceRevision: 0,
  };
}
