/**
 * Admin darba zonas ielāde: uzvar jaunākais `savedAt` starp pārlūka melnrakstu, rezerves kopiju un serveri
 * (K3 — vecs local vairs nepārraksta jaunāku servera versiju no citas ierīces).
 * Foto lauki: salipina visus avotus, lai jaunāks tukšs localStorage nepazaudētu servera bildes.
 */
import {
  createDefaultSourceBlocks,
  emptyVendorAvotuBlock,
  hydrateWorkspaceFromStorage,
} from "@/lib/admin-source-blocks";
import {
  coalesceOrderWorkspacePersistBody,
  parseWorkspaceSnapshotSavedAtMs,
  pickNewestBackupSnapshotRaw,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { clearedFieldsSnapshotField } from "@/lib/admin-cleared-fields";
import { deletedPhotoIdsSnapshotField } from "@/lib/admin-photo-tombstones";
import { sourceBlockWipesSnapshotField } from "@/lib/admin-source-block-wipes";
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

  // K3: teksts — jaunākais `savedAt` (vienāds laiks → local). Foto — salipina visus avotus.
  const backupPick = pickNewestBackupSnapshotRaw(args.backupRaw);
  const rawCandidates: { source: "local" | "backup" | "server"; raw: string; savedAtMs: number; rank: number }[] = [];
  if (localRaw) {
    rawCandidates.push({ source: "local", raw: localRaw, savedAtMs: parseWorkspaceSnapshotSavedAtMs(localRaw), rank: 0 });
  }
  if (backupPick) {
    rawCandidates.push({
      source: "backup",
      raw: backupPick.data,
      savedAtMs: Math.max(backupPick.savedAtMs, parseWorkspaceSnapshotSavedAtMs(backupPick.data)),
      rank: 1,
    });
  }
  if (args.serverWorkspaceJson?.trim()) {
    rawCandidates.push({
      source: "server",
      raw: args.serverWorkspaceJson,
      savedAtMs: parseWorkspaceSnapshotSavedAtMs(args.serverWorkspaceJson),
      rank: 2,
    });
  }
  rawCandidates.sort((a, b) => b.savedAtMs - a.savedAtMs || a.rank - b.rank);

  const hydratedCandidates: {
    source: "local" | "backup" | "server";
    data: HydratedWorkspaceSnapshot;
    body: OrderWorkspacePersistBody;
    revision: number;
  }[] = [];
  for (const c of rawCandidates) {
    const hydrated = hydrateWorkspaceFromStorage(c.raw);
    if (!hydrated) continue;
    const data = withOrderDefaults(hydrated);
    hydratedCandidates.push({
      source: c.source,
      data,
      revision: revisionFromRaw(c.raw),
      body: {
        sourceBlocks: data.sourceBlocks,
        iriss: data.iriss,
        apskatesPlāns: data.apskatesPlāns,
        tehniskoRiskuAnalize: data.tehniskoRiskuAnalize,
        cenasAtbilstiba: data.cenasAtbilstiba,
        previewConfirmed: data.previewConfirmed,
        vehicleAiExtraction: data.vehicleAiExtraction,
        vehicleAiExtractionMeta: data.vehicleAiExtractionMeta,
        incidentPhotoGroups: data.incidentPhotoGroups,
        incidentPhotos: data.incidentPhotos,
        ...sourceBlockWipesSnapshotField(data.sourceBlockWipes),
        ...clearedFieldsSnapshotField(data.clearedFields),
        // K1: bez kapakmeņiem apvienošana atdzīvinātu dzēstās bildes no vecākiem snapshotiem.
        ...deletedPhotoIdsSnapshotField(data.deletedPhotoIds),
      },
    });
  }

  const chosen = hydratedCandidates[0];
  if (chosen) {
    let mergedBody = chosen.body;
    for (const other of hydratedCandidates.slice(1)) {
      mergedBody = coalesceOrderWorkspacePersistBody(mergedBody, other.body);
    }
    const maxRevision = hydratedCandidates.reduce((n, c) => Math.max(n, c.revision), 0);
    return {
      source: chosen.source,
      hydrated: {
        ...chosen.data,
        sourceBlocks: mergedBody.sourceBlocks,
        iriss: mergedBody.iriss,
        apskatesPlāns: mergedBody.apskatesPlāns,
        tehniskoRiskuAnalize: mergedBody.tehniskoRiskuAnalize,
        cenasAtbilstiba: mergedBody.cenasAtbilstiba,
        previewConfirmed: mergedBody.previewConfirmed,
        vehicleAiExtraction: mergedBody.vehicleAiExtraction,
        vehicleAiExtractionMeta: mergedBody.vehicleAiExtractionMeta,
        incidentPhotoGroups: mergedBody.incidentPhotoGroups ?? [],
        incidentPhotos: mergedBody.incidentPhotos ?? [],
        ...deletedPhotoIdsSnapshotField(mergedBody.deletedPhotoIds),
      },
      workspaceRevision: maxRevision,
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
