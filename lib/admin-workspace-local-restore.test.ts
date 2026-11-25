import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import { pickLocalRestoreCandidate, snapshotRawToPersistBody } from "@/lib/admin-workspace-local-restore";
import { fillEmptyServerFieldsFromLocal } from "@/lib/admin-workspace-safety";

function snap(fields: Record<string, unknown>, savedAt: string): string {
  return JSON.stringify({
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    ...fields,
    savedAt,
  });
}

describe("lokālās kopijas atjaunošanas piedāvājums", () => {
  const server = snapshotRawToPersistBody(snap({ iriss: "Servera IRISS" }, "2026-11-25T10:31:00Z"));

  it("piedāvā, ja rezerves kopijā vairāk aizpildītu lauku", () => {
    const rich = snap(
      {
        iriss: "Lokālais IRISS",
        apskatesPlāns: "Plāns",
        sourceBlocks: { ...createDefaultSourceBlocks(), autodna: { ...emptyVendorAvotuBlock(), comments: "AutoDNA dati" } },
      },
      "2026-11-25T10:30:00Z",
    );
    const backupRaw = JSON.stringify([
      { savedAt: "2026-11-25T12:31:00Z", data: snap({}, "2026-11-25T12:31:00Z") },
      { savedAt: "2026-11-25T10:30:00Z", data: rich },
    ]);
    const offer = pickLocalRestoreCandidate({ localRaw: snap({}, "2026-11-25T12:31:00Z"), backupRaw, serverBody: server });
    expect(offer).not.toBeNull();
    expect(offer!.localTotal).toBe(3);
    expect(offer!.serverTotal).toBe(1);
    expect(offer!.savedAtMs).toBe(Date.parse("2026-11-25T10:30:00Z"));
    // Atjaunojot - tikai tukšie servera lauki.
    const { body } = fillEmptyServerFieldsFromLocal(server!, offer!.body);
    expect(body.iriss).toBe("Servera IRISS");
    expect(body.apskatesPlāns).toBe("Plāns");
    expect(body.sourceBlocks.autodna.comments).toBe("AutoDNA dati");
  });

  it("nepiedāvā, ja serverī tikpat vai vairāk", () => {
    const offer = pickLocalRestoreCandidate({
      localRaw: snap({ iriss: "x" }, "2026-11-25T10:00:00Z"),
      backupRaw: null,
      serverBody: server,
    });
    expect(offer).toBeNull();
  });

  it("bojāti dati netraucē", () => {
    expect(pickLocalRestoreCandidate({ localRaw: "{bojāts", backupRaw: "nav json", serverBody: null })).toBeNull();
  });
});
