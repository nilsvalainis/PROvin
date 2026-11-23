import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { VinScanIndicator } from "@/lib/vin-scan/types";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("@/lib/staff-auth", () => ({ requireIrissSectionApi: async () => ({ ok: true }) }));
vi.mock("@/lib/source-health-store", () => ({ recordSourceOutcomes: async () => undefined }));
vi.mock("@/lib/csdd-tech-data-counted", () => ({ fetchCsddTechDataCounted: async () => null }));
vi.mock("@/lib/vin-scan/browser-import-log", () => ({ logVinScanBrowserImport: () => undefined }));
vi.mock("@/lib/vin-scan/monitor-store", () => ({ trackVinScanBrowserImport: () => undefined }));

const scan = vi.hoisted(() => ({
  impl: (async () => []) as (input: { sourceIds?: VinScanIndicator["id"][] }) => Promise<unknown[]>,
}));
vi.mock("@/lib/vin-scan/run", () => ({
  runVinScan: (input: { sourceIds?: VinScanIndicator["id"][] }) => scan.impl(input),
  sanitizeVinScanSourceIds: (raw: unknown) => (Array.isArray(raw) ? (raw as string[]) : null),
}));

import { GET, POST } from "@/app/api/admin/vin-scan/route";
import { applyVinScanBrowserResultToSnapshot } from "@/lib/vin-scan/apply-browser-result";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { readVinScanSnapshot, writeVinScanBrowserImport, writeVinScanSnapshot } from "@/lib/vin-scan/store";

const VIN = "WBA5R1C0XLFH42873";
const SOURCES: VinScanIndicator["id"][] = ["vin_decode", "csdd", "stat_vin", "bid_cars"];
const dir = mkdtempSync(path.join(os.tmpdir(), "vin-scan-race-"));

function row(id: VinScanIndicator["id"], status: VinScanIndicator["status"], summary = ""): VinScanIndicator {
  return { id, label: id, country: "US", status, summary, detail: "", openUrl: null };
}

/** Tas, ko serveris atgriež šiem avotiem: reģistri atrasti, izsoļu arhīvi gaida pārlūku. */
function serverRows(ids: readonly VinScanIndicator["id"][]): VinScanIndicator[] {
  return ids.map((id) =>
    id === "stat_vin" || id === "bid_cars" ? row(id, "browser_only", "Atver pārlūkā") : row(id, "found", `${id} serveris`),
  );
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/vin-scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function importResult(id: string, status: "found" | "none", summary: string) {
  return post({ vin: VIN, browserResult: { id, status, summary } });
}

async function seed(minutesAgo: number) {
  await writeVinScanSnapshot({
    vin: VIN,
    plates: emptyVinScanPlates(),
    scannedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    indicators: serverRows(SOURCES),
  });
}

function statuses(rows: readonly VinScanIndicator[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

describe("VIN SCAN: pārlūka imports skenēšanas laikā", () => {
  beforeAll(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VIN_SCAN_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true });
    scan.impl = async (input) => serverRows(input.sourceIds ?? []);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("skenēšana sāk -> imports saglabāts -> skenēšana beidz: importētā rinda paliek", async () => {
    await seed(60);
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const scanStarted = new Promise<void>((resolve) => (started = resolve));
    scan.impl = (input) =>
      new Promise((resolve) => {
        started();
        release = () => resolve(serverRows(input.sourceIds ?? []));
      });

    const scanning = post({ vin: VIN, force: true, sources: SOURCES });
    await scanStarted; // `prev` jau nolasīts, serveris "skenē"

    const imported = await importResult("stat_vin", "found", "3 izsoles (pārlūkā)");
    expect(imported.status).toBe(200);

    release();
    const res = await scanning;
    const body = (await res.json()) as { indicators: VinScanIndicator[] };
    expect(statuses(body.indicators)).toEqual({
      vin_decode: "found",
      csdd: "found",
      stat_vin: "found",
      bid_cars: "browser_only",
    });

    const saved = await readVinScanSnapshot(VIN);
    const stat = saved?.indicators.find((r) => r.id === "stat_vin");
    expect(stat?.status).toBe("found");
    expect(stat?.summary).toBe("3 izsoles (pārlūkā)");
    // servera rezultāts avotam, ko pārlūks neaiztika, paliek
    expect(saved?.indicators.find((r) => r.id === "csdd")?.summary).toBe("csdd serveris");
    expect(saved?.indicators.find((r) => r.id === "bid_cars")?.status).toBe("browser_only");

    const get = await GET(new Request(`http://localhost/api/admin/vin-scan?vin=${VIN}`));
    const fromGet = (await get.json()) as { snapshot: { indicators: VinScanIndicator[] } };
    expect(statuses(fromGet.snapshot.indicators).stat_vin).toBe("found");
  });

  it("importētās rindas laiks ir importa laiks, servera rindām - skenēšanas laiks", async () => {
    await seed(60);
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const scanStarted = new Promise<void>((resolve) => (started = resolve));
    scan.impl = (input) =>
      new Promise((resolve) => {
        started();
        release = () => resolve(serverRows(input.sourceIds ?? []));
      });
    const scanning = post({ vin: VIN, force: true, sources: SOURCES });
    await scanStarted;
    await new Promise((r) => setTimeout(r, 5));
    const beforeImport = Date.now();
    await importResult("stat_vin", "none", "");
    release();
    await scanning;

    const saved = await readVinScanSnapshot(VIN);
    const stat = saved?.indicators.find((r) => r.id === "stat_vin");
    const csdd = saved?.indicators.find((r) => r.id === "csdd");
    expect(Date.parse(stat?.scannedAt ?? "")).toBeGreaterThanOrEqual(beforeImport);
    expect(Date.parse(csdd?.scannedAt ?? "")).toBeLessThan(beforeImport);
  });

  it("divi dažādu avotu importi no viena un tā paša vecā momentuzņēmuma: abi redzami", async () => {
    await seed(1);
    const stale = await readVinScanSnapshot(VIN);
    const save = async (id: string, status: "found" | "none", at: string) => {
      const applied = applyVinScanBrowserResultToSnapshot({ snapshot: stale, vin: VIN, browserResult: { id, status } });
      if (!applied.ok) throw new Error(applied.error);
      const imported = applied.snapshot.indicators.find((r) => r.id === id)!;
      await writeVinScanBrowserImport(VIN, { ...imported, scannedAt: at }, at);
      await writeVinScanSnapshot(applied.snapshot); // pēdējais rakstītājs pārraksta otra importu
    };
    await save("stat_vin", "found", new Date(Date.now() - 2000).toISOString());
    await save("bid_cars", "none", new Date(Date.now() - 1000).toISOString());

    const saved = await readVinScanSnapshot(VIN);
    expect(statuses(saved?.indicators ?? [])).toMatchObject({ stat_vin: "found", bid_cars: "none", csdd: "found" });

    // kešotais POST ceļš atgriež to pašu
    const res = await post({ vin: VIN });
    const body = (await res.json()) as { cached: boolean; indicators: VinScanIndicator[] };
    expect(body.cached).toBe(true);
    expect(statuses(body.indicators)).toMatchObject({ stat_vin: "found", bid_cars: "none" });
  });

  it("divi vienlaicīgi importi caur maršrutu: abi redzami", async () => {
    await seed(1);
    const [a, b] = await Promise.all([
      importResult("stat_vin", "found", "A"),
      importResult("bid_cars", "found", "B"),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const saved = await readVinScanSnapshot(VIN);
    expect(statuses(saved?.indicators ?? [])).toMatchObject({ stat_vin: "found", bid_cars: "found" });
  });

  it("novecojis imports pēc force pārskenēšanas neatgriežas", async () => {
    await seed(60);
    // "nav datu" imports pirms 4 dienām (none TTL izsoļu arhīvam - 3 dienas)
    const old = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    await writeVinScanBrowserImport(VIN, { ...row("stat_vin", "none", "Nav datu (pārlūkā)"), scannedAt: old }, old);

    const res = await post({ vin: VIN, force: true, sources: SOURCES });
    const body = (await res.json()) as { indicators: VinScanIndicator[] };
    expect(statuses(body.indicators).stat_vin).toBe("browser_only");
    expect(statuses((await readVinScanSnapshot(VIN))?.indicators ?? []).stat_vin).toBe("browser_only");
  });

  it("citam avotam imports netiek glabāts atsevišķi", async () => {
    await seed(1);
    const at = new Date().toISOString();
    await writeVinScanBrowserImport(VIN, { ...row("csdd", "none", "viltots"), scannedAt: at }, at);
    expect((await readVinScanSnapshot(VIN))?.indicators.find((r) => r.id === "csdd")?.status).toBe("found");
  });
});
