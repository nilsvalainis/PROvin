import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

vi.mock("server-only", () => ({}));

describe("ensurePickupDateFix (via listLogisticsOrders)", () => {
  const prevVercel = process.env.VERCEL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevDir = process.env.ADMIN_IRISS_LOGISTICS_DIR;
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "provin-iriss-logistics-store-"));
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.ADMIN_IRISS_LOGISTICS_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
    if (prevDir === undefined) delete process.env.ADMIN_IRISS_LOGISTICS_DIR;
    else process.env.ADMIN_IRISS_LOGISTICS_DIR = prevDir;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    vi.resetModules();
  });

  async function seedOrders(items: Record<string, unknown>[]) {
    await fs.writeFile(path.join(tmpDir, "seed-meta.json"), JSON.stringify({ seeded: true }));
    await fs.writeFile(path.join(tmpDir, "orders.json"), JSON.stringify({ version: 1, items }));
  }

  it("clears pickupDate only for the known-bad VIN+date pairs, leaves everything else untouched", async () => {
    await seedOrders([
      { id: "lo-1", vin: "YV1DZ8256D2439274", pickupDate: "2026-10-17" },
      { id: "lo-2", vin: "WDB9061331N534460", pickupDate: "2026-10-17" },
      { id: "lo-3", vin: "YV1DZ3150E2599639", pickupDate: "2026-10-21" },
      { id: "lo-4", vin: "YV1DZ8256D2439274-OTHER", pickupDate: "2026-10-17" },
    ]);

    const mod = await import("@/lib/iriss-logistics-store");
    const orders = await mod.listLogisticsOrders();
    const byId = new Map(orders.map((o) => [o.id, o]));

    expect(byId.get("lo-1")?.pickupDate).toBe("");
    expect(byId.get("lo-2")?.pickupDate).toBe("");
    expect(byId.get("lo-3")?.pickupDate).toBe("2026-10-21");
    expect(byId.get("lo-4")?.pickupDate).toBe("2026-10-17");
  });

  it("is idempotent and does not reapply or re-touch data once the fix has run", async () => {
    await seedOrders([{ id: "lo-1", vin: "YV1DZ8256D2439274", pickupDate: "2026-10-17" }]);

    const mod = await import("@/lib/iriss-logistics-store");
    await mod.listLogisticsOrders();

    const metaPath = path.join(tmpDir, "pickup-date-fix-v1.json");
    const metaRaw = JSON.parse(await fs.readFile(metaPath, "utf8"));
    expect(metaRaw.done).toBe(true);
    expect(metaRaw.changed).toBe(1);

    // manuāli atjauno vērtību - otrā izsaukumā labojums vairs nav jāpiemēro (vienreizējs)
    const ordersPath = path.join(tmpDir, "orders.json");
    const raw = JSON.parse(await fs.readFile(ordersPath, "utf8"));
    raw.items[0].pickupDate = "2026-10-17";
    await fs.writeFile(ordersPath, JSON.stringify(raw));

    const orders = await mod.listLogisticsOrders();
    expect(orders[0].pickupDate).toBe("2026-10-17");
  });
});
