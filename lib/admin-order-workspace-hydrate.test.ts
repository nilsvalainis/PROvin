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
  it("always uses localStorage when present, never server", () => {
    const local = snapshotWithAutodnaComment("Mans lokālais teksts", "2026-06-01T10:00:00.000Z");
    const server = snapshotWithAutodnaComment("Servera teksts", "2026-06-10T12:00:00.000Z");
    const resolved = resolveOrderWorkspaceHydration({
      localRaw: local,
      localRawLegacyV2: null,
      backupRaw: null,
      serverWorkspaceJson: server,
    });
    expect(resolved.source).toBe("local");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).toContain("Mans lokālais");
    expect(resolved.hydrated.sourceBlocks.autodna.comments).not.toContain("Servera");
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
});
