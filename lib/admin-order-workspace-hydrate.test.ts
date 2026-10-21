import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { describe, expect, it } from "vitest";
import { emptyVendorAvotuBlock, createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { serializeOrderWorkspaceSnapshotFromRef } from "@/lib/admin-order-workspace-persist";
import { resolveOrderWorkspaceHydration, shouldAutosaveHydratedLocalDraft } from "@/lib/admin-order-workspace-hydrate";
import { DEFAULT_PDF_VISIBILITY } from "@/lib/pdf-visibility";

function snapshotWithAutodnaComment(comment: string, savedAt: string, workspaceRevision?: number): string {
  const blocks = createDefaultSourceBlocks();
  blocks.autodna = { ...emptyVendorAvotuBlock(), comments: comment };
  return serializeOrderWorkspaceSnapshotFromRef(
    {
      sourceBlocks: blocks,
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    },
    DEFAULT_PDF_VISIBILITY,
    {},
    savedAt,
    [],
    workspaceRevision,
  );
}

describe("shouldAutosaveHydratedLocalDraft", () => {
  it("saves a newer local draft after reload when persistence is on", () => {
    const local = snapshotWithAutodnaComment("Lokālais", "2026-06-10T12:00:00.000Z");
    const server = snapshotWithAutodnaComment("Serveris", "2026-06-01T10:00:00.000Z");
    expect(
      shouldAutosaveHydratedLocalDraft({
        persistenceEnabled: true,
        source: "local",
        localRaw: local,
        serverWorkspaceJson: server,
      }),
    ).toBe(true);
  });

  it("does not overwrite a newer server version", () => {
    const local = snapshotWithAutodnaComment("Lokālais", "2026-06-10T12:00:00.000Z", 1);
    const newerByTime = snapshotWithAutodnaComment("Jaunāks serveris", "2026-06-11T08:00:00.000Z", 1);
    const newerByRevision = snapshotWithAutodnaComment("Serveris", "2026-06-01T10:00:00.000Z", 5);
    expect(
      shouldAutosaveHydratedLocalDraft({
        persistenceEnabled: true,
        source: "server",
        localRaw: local,
        serverWorkspaceJson: newerByTime,
      }),
    ).toBe(false);
    expect(
      shouldAutosaveHydratedLocalDraft({
        persistenceEnabled: true,
        source: "local",
        localRaw: local,
        serverWorkspaceJson: newerByTime,
      }),
    ).toBe(false);
    expect(
      shouldAutosaveHydratedLocalDraft({
        persistenceEnabled: true,
        source: "local",
        localRaw: local,
        serverWorkspaceJson: newerByRevision,
      }),
    ).toBe(false);
  });

  it("wires reload autosave through OrderDetailWorkspace", () => {
    const src = readFileSync(join(__dirname, "../components/admin/OrderDetailWorkspace.tsx"), "utf8");
    expect(src).toContain("shouldAutosaveHydratedLocalDraft");
    expect(src).toContain("pendingHydrateAutosaveRef");
    expect(src).toContain("scheduleWorkspaceServerPatch({ immediate: true, showFlash: false })");
  });

  it("never writes when persistence is off (old orders / no durable store)", () => {
    const local = snapshotWithAutodnaComment("Lokālais", "2026-06-10T12:00:00.000Z");
    const server = snapshotWithAutodnaComment("Serveris", "2026-06-01T10:00:00.000Z");
    expect(
      shouldAutosaveHydratedLocalDraft({
        persistenceEnabled: false,
        source: "local",
        localRaw: local,
        serverWorkspaceJson: server,
      }),
    ).toBe(false);
  });
});

describe("resolveOrderWorkspaceHydration", () => {
  it("K3: jaunāks serveris uzvar vecu local (cita ierīce)", () => {
    const local = snapshotWithAutodnaComment("Mans lokālais teksts", "2026-06-01T10:00:00.000Z");
    const server = snapshotWithAutodnaComment("Servera teksts", "2026-06-10T12:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({ localRaw: local, localRawLegacyV2: null, backupRaw: null, serverWorkspaceJson: server });
    expect(resolved.source).toBe("server");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).toContain("Servera");
  });

  it("K3: jaunāks local (nesaglabāts) uzvar vecāku serveri", () => {
    const local = snapshotWithAutodnaComment("Mans lokālais teksts", "2026-06-10T12:00:00.000Z");
    const server = snapshotWithAutodnaComment("Servera teksts", "2026-06-01T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({ localRaw: local, localRawLegacyV2: null, backupRaw: null, serverWorkspaceJson: server });
    expect(resolved.source).toBe("local");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).toContain("Mans lokālais");
  });

  it("K3: vienāds laiks → local (vecā secība); saturs (raw/PDF lauki) nemainīts", () => {
    const t = "2026-06-10T12:00:00.000Z";
    const local = snapshotWithAutodnaComment("Mans lokālais teksts", t);
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: snapshotWithAutodnaComment("Servera teksts", t),
    });
    expect(resolved.source).toBe("local");
    const direct = hydrateWorkspaceFromStorage(local)!;
    expect(resolved.hydrated.sourceBlocks).toEqual(direct.sourceBlocks);
    expect(resolved.hydrated.iriss).toBe(direct.iriss);
  });

  it("keeps legacy flat incident photos when a newer local snapshot has empty titled groups", () => {
    const photoIds = [
      "inc_ph_937727923800eda3afa93f26",
      "inc_ph_5798840b66b5e88b0e48f4ab",
      "inc_ph_c3194363ced8f763b41688f7",
      "inc_ph_d8fc9e5fb7f70941379bd33f",
      "inc_ph_d565f075dad85e0297bd7ac5",
      "inc_ph_72ad282fab2805fc9c7ac312",
      "inc_ph_3a475614946ec7b77ab96a4d",
      "inc_ph_01fd8003e0ca28c5bef70436",
      "inc_ph_ad2da1b13360ff7c9e18477e",
      "inc_ph_ec652ef4236da799844f4245",
      "inc_ph_0a34f943d694e3b78a294a47",
      "inc_ph_57c8cfb9091d9a330846ebab",
      "inc_ph_95631a1cd3dfbbd25db519a2",
      "inc_ph_ce56efb9f45898a2d5b76016",
      "inc_ph_5f30ac6719ea67e103654067",
      "inc_ph_753187aa2706658382904a17",
      "inc_ph_51c54a11fa3482be40daf5d2",
      "inc_ph_24cc1a42a0f4a21a7cf0e5c9",
      "inc_ph_5f94ae6bfbc5e4e785e5f00c",
      "inc_ph_2855e69b45ff35264bc9688c",
      "inc_ph_48c03b05b02eee298f9be659",
      "inc_ph_f726326ab2a6055274099f40",
    ];
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "AutoDNA 2017 Hollywood" };
    const legacyServer = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: blocks,
        iriss: "BMW 640i kopsavilkums",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
        incidentPhotos: photoIds.map((id) => ({ id })),
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-20T17:00:00.000Z",
    );
    const parsedServer = JSON.parse(legacyServer) as { workspaceRevision?: number; incidentPhotoGroups?: unknown };
    parsedServer.workspaceRevision = 276;
    delete parsedServer.incidentPhotoGroups;
    const serverRaw = JSON.stringify(parsedServer);

    const emptyLocalBlocks = createDefaultSourceBlocks();
    const emptyLocal = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: emptyLocalBlocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
        incidentPhotoGroups: [
          { id: "inc_phg_dba3356fdeba12c81d232520", title: "Arhīva fotogrāfijas 2026-10-20", photos: [] },
        ],
        incidentPhotos: [],
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-20T22:20:00.000Z",
    );
    const parsedLocal = JSON.parse(emptyLocal) as { workspaceRevision?: number };
    parsedLocal.workspaceRevision = 270;
    const localRaw = JSON.stringify(parsedLocal);

    const resolved = resolveOrderWorkspaceHydration({
      localRaw,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: serverRaw,
    });
    expect(resolved.hydrated.incidentPhotos.map((p) => p.id)).toEqual(photoIds);
    expect(resolved.hydrated.incidentPhotoGroups.flatMap((g) => g.photos.map((p) => p.id))).toEqual(photoIds);
    expect(resolved.workspaceRevision).toBe(276);
  });

  it("falls back to server only when no local", () => {
    const server = snapshotWithAutodnaComment("Tikai serveris", "2026-06-01T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: null,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(resolved.source).toBe("server");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).toContain("Tikai serveris");
  });

  it("uses MINI PDF defaults on an empty workspace", () => {
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: null,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: null,
      checkoutLine: "mini",
      amountTotalCents: 3999,
    });
    expect(resolved.source).toBe("empty");
    expect(resolved.hydrated.pdfVisibility.autodna).toBe(false);
    expect(resolved.hydrated.pdfVisibility.carvertical).toBe(false);
    expect(resolved.hydrated.pdfVisibility.auto_records).toBe(false);
    expect(resolved.hydrated.pdfVisibility.csdd).toBe(true);
  });

  it("turns off payment visibility for B2B partner orders even when a snapshot had it on", () => {
    const local = snapshotWithAutodnaComment("Partnera teksts", "2026-09-01T10:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: null,
      checkoutLine: "business",
      partnerId: "ptr_0123456789abcdef",
      notes: "B2B business · partner_id=ptr_0123456789abcdef",
    });
    expect(resolved.source).toBe("local");
    expect(resolved.hydrated.pdfVisibility.payment).toBe(false);
  });

  it("round-trips an optional technicalRiskMap without dropping other fields", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "AutoDNA komentārs" };
    const raw = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: blocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "Ķēde",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
        technicalRiskMap: {
          identification: {
            engine: { value: "N47D20", confidence: "A", evidence: "Outvin", candidates: ["N47D20"] },
            gearbox: { value: "", confidence: "C", evidence: "", candidates: [] },
            platform: { value: "E84", confidence: "B", evidence: "gads", candidates: ["E84"] },
          },
          risks: [],
          damage_interpretation: [],
          recalls: [{ id_or_title: "nav atrasts", source: "meklēšana", status_known: false }],
          strengths: [],
          unknowns: [],
        },
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-17T10:00:00.000Z",
    );
    const hydrated = hydrateWorkspaceFromStorage(raw);
    expect(hydrated?.tehniskoRiskuAnalize).toBe("Ķēde");
    expect(hydrated?.sourceBlocks.autodna.comments).toBe("AutoDNA komentārs");
    expect(hydrated?.technicalRiskMap?.identification.engine.value).toBe("N47D20");
    expect(hydrated?.technicalRiskMap?.recalls[0]?.id_or_title).toBe("nav atrasts");
  });

  it("round-trips optional odometerAnomalyOverrides and omits the field on old snapshots", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "AutoDNA komentārs" };
    const withOverrides = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: blocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
        odometerAnomalyOverrides: [{ key: "01.06.2024|120000|CSDD|1", action: "dismiss" }],
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-17T10:00:00.000Z",
    );
    const hydrated = hydrateWorkspaceFromStorage(withOverrides);
    expect(hydrated?.sourceBlocks.autodna.comments).toBe("AutoDNA komentārs");
    expect(hydrated?.odometerAnomalyOverrides).toEqual([
      { key: "01.06.2024|120000|CSDD|1", action: "dismiss" },
    ]);
    expect(JSON.parse(withOverrides).odometerAnomalyOverrides).toEqual([
      { key: "01.06.2024|120000|CSDD|1", action: "dismiss" },
    ]);

    const oldRaw = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: blocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-17T10:00:00.000Z",
    );
    expect(JSON.parse(oldRaw).odometerAnomalyOverrides).toBeUndefined();
    expect(hydrateWorkspaceFromStorage(oldRaw)?.odometerAnomalyOverrides).toBeUndefined();
  });

  it("uses server revision when newer local snapshot has no workspaceRevision", () => {
    const server = snapshotWithAutodnaComment("Serveris 325", "2026-10-20T22:40:33.549Z");
    const parsedServer = JSON.parse(server) as { workspaceRevision?: number };
    parsedServer.workspaceRevision = 325;
    const local = snapshotWithAutodnaComment("Lokālais pēc hidratācijas", "2026-10-20T22:40:40.000Z");
    expect(JSON.parse(local).workspaceRevision).toBeUndefined();
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: JSON.stringify(parsedServer),
    });
    expect(resolved.source).toBe("local");
    expect(resolved.workspaceRevision).toBe(325);
  });

  it("writes workspaceRevision into the local snapshot", () => {
    const raw = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: createDefaultSourceBlocks(),
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
      },
      DEFAULT_PDF_VISIBILITY,
      {},
      "2026-10-20T22:40:33.549Z",
      [],
      325,
    );
    expect(JSON.parse(raw).workspaceRevision).toBe(325);
  });
});

