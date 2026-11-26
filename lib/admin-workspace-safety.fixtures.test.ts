/**
 * Tikko ielādēta cilne bez izmaiņām -> 409 apvienošana neko neuzskata par «lokāli mainītu»
 * (bāze un ielādes stāvoklis veidoti ar vienu un to pašu pilno parseri).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOrderWorkspaceHydration } from "@/lib/admin-order-workspace-hydrate";
import { hydratedSnapshotToPersistBody, snapshotRawToPersistBody } from "@/lib/admin-workspace-local-restore";
import { mergeStaleLocalWithServer } from "@/lib/admin-workspace-safety";

const DIR = path.join(process.cwd(), "lib/__fixtures__/mileage-etalons");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("mileage-etalons: ielādēta cilne bez izmaiņām", () => {
  it("ir fiksturas", () => {
    expect(files.length).toBeGreaterThanOrEqual(21);
  });

  for (const f of files) {
    it(`${f}: localChanged tukšs`, () => {
      const fx = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Record<string, unknown>;
      const serverJson = JSON.stringify({
        sourceBlocks: fx.sourceBlocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        ...(fx.odometerAnomalyOverrides != null ? { odometerAnomalyOverrides: fx.odometerAnomalyOverrides } : {}),
        savedAt: "2026-11-25T10:00:00.000Z",
      });
      const resolved = resolveOrderWorkspaceHydration({
        localRaw: null,
        localRawLegacyV2: null,
        backupRaw: null,
        serverWorkspaceJson: serverJson,
      });
      const local = hydratedSnapshotToPersistBody(resolved.hydrated);
      const base = snapshotRawToPersistBody(serverJson);
      const server = snapshotRawToPersistBody(serverJson);
      const r = mergeStaleLocalWithServer(local, server, base);
      expect(r.localChanged).toEqual([]);
      expect(r.fieldMergedBlocks).toEqual([]);
    });
  }
});
