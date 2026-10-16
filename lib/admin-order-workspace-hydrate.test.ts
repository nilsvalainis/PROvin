import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { describe, expect, it } from "vitest";
import { emptyVendorAvotuBlock, createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { serializeOrderWorkspaceSnapshotFromRef } from "@/lib/admin-order-workspace-persist";
import { resolveOrderWorkspaceHydration } from "@/lib/admin-order-workspace-hydrate";

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
    {},
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

  it("K3: jaunāks tukšāks serveris nepārraksta bagātīgāku local (zaudēts PATCH)", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "Pilns Captur komentārs no operatora" };
    const local = serializeOrderWorkspaceSnapshotFromRef(
      {
        sourceBlocks: blocks,
        iriss: "Kopsavilkums klientam",
        apskatesPlāns: "Apskate servisā",
        tehniskoRiskuAnalize: "Riski",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
      },
      {},
      {},
      "2026-10-16T20:49:00.000Z",
    );
    const server = snapshotWithAutodnaComment("", "2026-10-16T20:51:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(resolved.source).toBe("local");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).toContain("Captur");
    expect(resolved.hydrated.iriss).toContain("Kopsavilkums");
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
});
