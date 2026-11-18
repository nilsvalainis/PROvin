/**
 * VIN SCAN momentuzņēmuma krātuve: ja Blob ieraksts neizdodas un vienīgā kopija būtu Vercel pagaidu
 * mapē, saglabāšana nedrīkst klusi "izdoties" - nākamais pieprasījums (cita instance) to neredzētu.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => blob);

import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { readVinScanSnapshot, writeVinScanSnapshot } from "@/lib/vin-scan/store";

const VIN = "WBA5R1C0XLFH42873";
const snapshot = {
  vin: VIN,
  plates: emptyVinScanPlates(),
  scannedAt: "2026-11-17T10:00:00.000Z",
  indicators: [
    { id: "stat_vin" as const, label: "stat.vin", country: "US", status: "found" as const, summary: "Copart 2021", detail: "", openUrl: `https://stat.vin/cars/${VIN}` },
  ],
};

describe("VIN SCAN krātuve: Blob kļūda", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "provin-vinscan-store-"));
    blob.put.mockReset();
    blob.get.mockReset();
    blob.get.mockRejectedValue(new Error("nav"));
    vi.stubEnv("VIN_SCAN_DIR", tmpDir);
    vi.stubEnv("VIN_SCAN_BLOB_PREFIX", "");
    vi.stubEnv("ADMIN_ORDER_DRAFT_BLOB_PREFIX", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.mocked(console.warn).mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("bez Blob konfigurācijas raksta failā un nolasa to pašu", async () => {
    await writeVinScanSnapshot(snapshot);
    expect(blob.put).not.toHaveBeenCalled();
    const read = await readVinScanSnapshot(VIN);
    expect(read).toMatchObject({ vin: VIN, scannedAt: snapshot.scannedAt });
    expect(read?.indicators[0]).toMatchObject({ id: "stat_vin", summary: "Copart 2021" });
  });

  it("Blob ieraksts izdodas - saglabāšana ir veiksmīga", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("VIN_SCAN_BLOB_PREFIX", "vin-scans-test");
    blob.put.mockResolvedValue({});
    await expect(writeVinScanSnapshot(snapshot)).resolves.toBeUndefined();
    expect(blob.put.mock.calls[0]?.[0]).toBe(`vin-scans-test/${VIN}.json`);
    expect(blob.put.mock.calls[0]?.[2]).toMatchObject({ access: "private", addRandomSuffix: false });
  });

  it("Blob krīt un fails ir tikai pagaidu mapē - saglabāšana ziņo kļūdu", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("VIN_SCAN_BLOB_PREFIX", "vin-scans-test");
    blob.put.mockRejectedValue(new Error("blob down"));
    await expect(writeVinScanSnapshot(snapshot)).rejects.toThrow("blob_write_failed");
  });

  it("Blob krīt un failu krātuve ir izslēgta - saglabāšana ziņo kļūdu", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("VIN_SCAN_BLOB_PREFIX", "vin-scans-test");
    vi.stubEnv("VIN_SCAN_DIR", "off");
    blob.put.mockRejectedValue(new Error("blob down"));
    await expect(writeVinScanSnapshot(snapshot)).rejects.toThrow("blob_write_failed");
  });
});
