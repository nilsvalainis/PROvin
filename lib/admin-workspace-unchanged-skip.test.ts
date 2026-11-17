import { afterEach, describe, expect, it, vi } from "vitest";
import { stableWorkspaceChecksum } from "@/lib/admin-workspace-integrity";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import { clearAllWorkspacePersistQueues } from "@/lib/admin-workspace-persist-queue";
import {
  clearKnownServerWorkspace,
  clearLastOkWorkspaceRevision,
  noteKnownServerWorkspace,
  persistWorkspaceState,
  serverWorkspaceChecksumFromJson,
} from "@/lib/admin-workspace-persist-client";

/** Serveris kā prodā: kontrolsumma no saņemtā workspace, revīzija +1 katrā rakstā. */
function stubServer(startRevision: number) {
  let rev = startRevision;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { workspace: unknown };
    rev += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        updatedAt: new Date().toISOString(),
        durable: true,
        storageBackend: "blob",
        workspaceRevision: rev,
        workspaceChecksum: stableWorkspaceChecksum(body.workspace as never),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const body = (iriss = "") => ({
  sourceBlocks: createDefaultSourceBlocks(),
  iriss,
  apskatesPlāns: "",
  tehniskoRiskuAnalize: "",
  cenasAtbilstiba: "",
  previewConfirmed: false,
  vehicleAiExtraction: null,
  vehicleAiExtractionMeta: null,
});

const opts = (sessionId: string, iriss = "") => ({
  sessionId,
  body: body(iriss),
  baseline: null,
  pdfVisibility: mergePdfVisibility(undefined),
  pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
  expectedWorkspaceRevision: 25,
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearKnownServerWorkspace();
  clearLastOkWorkspaceRevision();
  clearAllWorkspacePersistQueues();
});

/** FABLE v3: tikai atverot PRO pasūtījumu - 3x PATCH ar to pašu kontrolsummu, revīzija 25→27. */
describe("nemainīts workspace netiek rakstīts vēlreiz", () => {
  it("pirmais raksts iet uz serveri, identisks otrais - nē, mainīts - atkal jā", async () => {
    const fetchMock = stubServer(25);
    const first = await persistWorkspaceState(opts("s-skip"));
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await persistWorkspaceState(opts("s-skip"));
    expect(second).toMatchObject({ ok: true, workspaceRevision: 26, storageBackend: "unchanged" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const changed = await persistWorkspaceState(opts("s-skip", "jauns teksts"));
    expect(changed.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ar SSR kontrolsummu jau pirmais nemainītais autosave netiek sūtīts", async () => {
    const fetchMock = stubServer(25);
    // Tas pats, ko serveris glabā (sākotnēji uzrakstīts) - kontrolsumma no SSR serverWorkspaceJson.
    await persistWorkspaceState(opts("s-probe"));
    const serverChecksum = stableWorkspaceChecksum(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).workspace);
    clearKnownServerWorkspace();
    fetchMock.mockClear();

    const json = JSON.stringify({ workspaceChecksum: serverChecksum, workspaceRevision: 25 });
    noteKnownServerWorkspace("s-ssr", serverWorkspaceChecksumFromJson(json), 25);
    const res = await persistWorkspaceState(opts("s-ssr"));
    expect(res).toMatchObject({ ok: true, workspaceRevision: 25 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cits sessionId vai bojāts JSON - nekādas izlaišanas", async () => {
    expect(serverWorkspaceChecksumFromJson("{bojāts")).toBeNull();
    expect(serverWorkspaceChecksumFromJson(JSON.stringify({ workspaceChecksum: "" }))).toBeNull();
    const fetchMock = stubServer(1);
    noteKnownServerWorkspace("cits", "abc", 1);
    await persistWorkspaceState(opts("s-other"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
