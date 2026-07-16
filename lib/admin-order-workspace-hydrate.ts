/**
 * Vienkārša admin darba zonas ielāde: ja pārlūkā ir saglabāts melnraksts — tikai tas.
 * Servera/Blob dati tiek lietoti tikai pirmajā apmeklējumā (ja localStorage vēl nav).
 */
import {
  createDefaultSourceBlocks,
  emptyVendorAvotuBlock,
  hydrateWorkspaceFromStorage,
} from "@/lib/admin-source-blocks";
import {
  parseWorkspaceSnapshotSavedAtMs,
  pickNewestBackupSnapshotRaw,
} from "@/lib/admin-order-workspace-persist";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
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
}): ResolvedWorkspaceHydration {
  const localRaw = args.localRaw?.trim() ? args.localRaw : args.localRawLegacyV2?.trim() ? args.localRawLegacyV2 : null;

  if (localRaw) {
    const hydrated = hydrateWorkspaceFromStorage(localRaw);
    if (hydrated) {
      return {
        source: "local",
        hydrated,
        workspaceRevision: revisionFromRaw(localRaw),
      };
    }
  }

  const backupPick = pickNewestBackupSnapshotRaw(args.backupRaw);
  if (backupPick) {
    const hydrated = hydrateWorkspaceFromStorage(backupPick.data);
    if (hydrated) {
      return {
        source: "backup",
        hydrated,
        workspaceRevision: revisionFromRaw(backupPick.data),
      };
    }
  }

  if (args.serverWorkspaceJson?.trim()) {
    const hydrated = hydrateWorkspaceFromStorage(args.serverWorkspaceJson);
    if (hydrated) {
      return {
        source: "server",
        hydrated,
        workspaceRevision: revisionFromRaw(args.serverWorkspaceJson),
      };
    }
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
        cenasAtbilstiba: "",
        previewConfirmed: false,
        pdfVisibility: mergePdfVisibility(undefined),
        pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
        manualBanners: [],
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
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
      cenasAtbilstiba: "",
      previewConfirmed: false,
      pdfVisibility: mergePdfVisibility(undefined),
      pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
      manualBanners: [],
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    },
    workspaceRevision: 0,
  };
}
