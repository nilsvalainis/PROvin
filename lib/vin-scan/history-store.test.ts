import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = mkdtempSync(path.join(os.tmpdir(), "vin-hist-"));

describe("VIN SCAN vēstures krātuve", () => {
  beforeAll(() => {
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("katram lietotājam savs saraksts", async () => {
    const { addVinScanHistory, readVinScanHistory } = await import("@/lib/vin-scan/history-store");
    await addVinScanHistory("admin", "WBA3A5C50CF256551", "2026-10-21T10:00:00Z");
    await addVinScanHistory("staff:a", "1M8GDM9AXKP042788", "2026-10-21T11:00:00Z");
    expect((await readVinScanHistory("admin")).map((e) => e.vin)).toEqual(["WBA3A5C50CF256551"]);
    expect((await readVinScanHistory("staff:a")).map((e) => e.vin)).toEqual(["1M8GDM9AXKP042788"]);
    expect(await readVinScanHistory("staff:b")).toEqual([]);
  });
});
