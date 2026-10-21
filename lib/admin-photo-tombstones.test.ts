import { describe, expect, it } from "vitest";
import {
  coalesceOrderWorkspacePersistBody,
  normalizeOrderWorkspacePersistBody,
  serializeOrderWorkspaceSnapshotFromRef,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks, hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { removedPhotoIds, stripDeletedPhotos } from "@/lib/admin-photo-tombstones";
import { resolveOrderWorkspaceHydration } from "@/lib/admin-order-workspace-hydrate";
import { coalesceOrderDraftWorkspacePatch, orderDraftWorkspaceToPersistBody, persistBodyToOrderDraftWorkspace } from "@/lib/admin-order-draft-workspace-merge";

const A = "la_ph_aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "la_ph_bbbbbbbbbbbbbbbbbbbbbbbb";
const C = "sb_ph_cccccccccccccccccccccccc";

function body(photos: string[], extra: Partial<OrderWorkspacePersistBody> = {}): OrderWorkspacePersistBody {
  const blocks = createDefaultSourceBlocks();
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks: {
      ...blocks,
      listing_analysis: {
        ...blocks.listing_analysis,
        photoAnalysis: "RAW sludinājuma teksts",
        photoGroups: [{ id: "la_phg_aaaaaaaaaaaaaaaaaaaaaaaa", title: "G", photos: photos.map((id) => ({ id })) }],
        photos: photos.map((id) => ({ id })),
      },
      csdd: { ...blocks.csdd, rawUnprocessedData: "CSDD RAW", photoGroups: [{ id: "g", title: "", photos: [{ id: C }] }], photos: [{ id: C }] },
    } as OrderWorkspacePersistBody["sourceBlocks"],
    iriss: "<p>IRISS</p>",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
    ...extra,
  });
}

const ids = (b: OrderWorkspacePersistBody) =>
  (b.sourceBlocks.listing_analysis.photoGroups ?? []).flatMap((g) => g.photos.map((p) => p.id));

describe("K1 photo tombstones", () => {
  it("bez kapakmeņiem — rezultāts nemainās (regresija)", () => {
    const merged = coalesceOrderWorkspacePersistBody(body([A]), body([A, B]));
    expect(ids(merged)).toEqual([A, B]);
    expect(merged.deletedPhotoIds).toBeUndefined();
  });

  it("dzēsta bilde neatgriežas no bagātāka server baseline", () => {
    const merged = coalesceOrderWorkspacePersistBody(body([A], { deletedPhotoIds: [B] }), body([A, B]));
    expect(ids(merged)).toEqual([A]);
    expect(merged.sourceBlocks.listing_analysis.photos?.map((p) => p.id)).toEqual([A]);
    expect(merged.deletedPhotoIds).toEqual([B]);
  });

  it("vecs local (bez kapakmeņa) pret serveri ar kapakmeni — arī nepārnāk", () => {
    const merged = coalesceOrderWorkspacePersistBody(body([A, B]), body([A], { deletedPhotoIds: [B] }));
    expect(ids(merged)).toEqual([A]);
  });

  it("raw teksti un citu bloku bildes paliek nemainīti", () => {
    const merged = coalesceOrderWorkspacePersistBody(body([A], { deletedPhotoIds: [B] }), body([A, B]));
    expect(merged.sourceBlocks.listing_analysis.photoAnalysis).toBe("RAW sludinājuma teksts");
    expect(merged.sourceBlocks.csdd.rawUnprocessedData).toBe("CSDD RAW");
    const control = coalesceOrderWorkspacePersistBody(body([A]), body([A, B]));
    expect(merged.sourceBlocks.csdd).toEqual(control.sourceBlocks.csdd);
    expect(merged.iriss).toBe("<p>IRISS</p>");
  });

  it("kapakmeņi izdzīvo localStorage serializāciju un server draft apli", () => {
    const b = body([A], { deletedPhotoIds: [B] });
    const snap = serializeOrderWorkspaceSnapshotFromRef(b, mergePdfVisibility({}), {});
    expect(hydrateWorkspaceFromStorage(snap)?.deletedPhotoIds).toEqual([B]);
    const draft = persistBodyToOrderDraftWorkspace(b, mergePdfVisibility({}), {});
    expect(draft.deletedPhotoIds).toEqual([B]);
    expect(orderDraftWorkspaceToPersistBody(draft).deletedPhotoIds).toEqual([B]);
    const res = coalesceOrderDraftWorkspacePatch(
      persistBodyToOrderDraftWorkspace(body([A, B]), mergePdfVisibility({}), {}),
      draft,
      "cs_test",
    );
    expect(ids(orderDraftWorkspaceToPersistBody(res.workspace))).toEqual([A]);
  });

  it("removedPhotoIds: pārvietošana nav dzēšana; strip neaiztiek nemainītus objektus", () => {
    expect(removedPhotoIds({ g: [{ photos: [{ id: A }, { id: B }] }] }, { g: [{ photos: [{ id: B }] }, { photos: [{ id: A }] }] })).toEqual([]);
    expect(removedPhotoIds({ photos: [{ id: A }, { id: B }] }, { photos: [{ id: A }] })).toEqual([B]);
    const v = { x: { photos: [{ id: A }] } };
    expect(stripDeletedPhotos(v, new Set([B]))).toBe(v);
  });
});

describe("K1 photo tombstones on hydrate (#396 photo coalesce)", () => {
  const snap = (b: OrderWorkspacePersistBody, savedAt: string) =>
    serializeOrderWorkspaceSnapshotFromRef(b, mergePdfVisibility({}), {}, savedAt);
  const hydratedIds = (h: { sourceBlocks: OrderWorkspacePersistBody["sourceBlocks"] }) =>
    (h.sourceBlocks.listing_analysis.photoGroups ?? []).flatMap((g) => g.photos.map((p) => p.id));

  it("dzēsta bilde neatdzīvojas no vecāka servera snapshot pēc pārlādes", () => {
    const local = snap(body([A], { deletedPhotoIds: [B] }), "2026-10-20T12:00:00.000Z");
    const server = snap(body([A, B]), "2026-10-20T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(hydratedIds(resolved.hydrated)).toEqual([A]);
    expect(resolved.hydrated.deletedPhotoIds).toEqual([B]);
  });

  it("servera kapakmenis noņem bildi arī no jaunāka local bez kapakmeņa", () => {
    const local = snap(body([A, B]), "2026-10-20T12:00:00.000Z");
    const server = snap(body([A], { deletedPhotoIds: [B] }), "2026-10-20T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(hydratedIds(resolved.hydrated)).toEqual([A]);
  });

  it("bez kapakmeņiem bildes joprojām apvienojas (#396)", () => {
    const local = snap(body([A]), "2026-10-20T12:00:00.000Z");
    const server = snap(body([A, B]), "2026-10-20T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(hydratedIds(resolved.hydrated).sort()).toEqual([A, B].sort());
  });
});
