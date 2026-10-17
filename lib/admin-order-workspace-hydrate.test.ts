import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { describe, expect, it } from "vitest";
import { emptyVendorAvotuBlock, createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { serializeOrderWorkspaceSnapshotFromRef } from "@/lib/admin-order-workspace-persist";
import { resolveOrderWorkspaceHydration } from "@/lib/admin-order-workspace-hydrate";
import { DEFAULT_PDF_VISIBILITY } from "@/lib/pdf-visibility";

function snapshotWithAutodnaComment(comment: string, savedAt: string): string {
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
  );
}

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
});

