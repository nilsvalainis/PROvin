/**
 * «+ Nopirkts» (Loģistika POST ar `toAutoparks`): VIN nonāk Autoparka (v1) ierakstā un esošā /STOCK
 * mape tiek sasaistīta pēc VIN6. Jaunu mapi neveido; ja mapes nav - nekas nekrīt.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropboxEntry } from "@/lib/dropbox-client";
import { normalizeLogisticsVin } from "@/lib/iriss-logistics-types";

const SEP = " – ";
const VIN = "YV1UZA8VDK1234567";
const FOLDER = `/STOCK/Volvo XC60 2019 melns${SEP}234567${SEP}AB`;

function memoryDropbox() {
  const items = new Map<string, DropboxEntry>();
  let seq = 0;
  const add = (tag: "file" | "folder", p: string) => {
    const e = { tag, id: `id:${++seq}`, name: p.split("/").pop()!, pathLower: p.toLowerCase(), pathDisplay: p, rev: "", size: 0, contentHash: "", serverModified: "2026-11-18T10:00:00Z" };
    items.set(p.toLowerCase(), e);
    return e;
  };
  const byRef = (ref: string) => [...items.values()].find((e) => e.id === ref) ?? items.get(ref.toLowerCase()) ?? null;
  const client = {
    getMetadata: vi.fn(async (ref: string) => byRef(ref)),
    listAll: vi.fn(async (root: string) => ({
      entries: [...items.values()].filter((e) => e.pathLower.startsWith(`${root.toLowerCase()}/`) && !e.pathLower.slice(root.length + 1).includes("/")),
      cursor: "c0",
    })),
    ensureFolder: vi.fn(async (p: string) => byRef(p) ?? add("folder", p)),
    upload: vi.fn(),
    move: vi.fn(),
    download: vi.fn(async () => {
      throw new Error("not_found");
    }),
    temporaryLink: vi.fn(async () => "https://dl.example/x"),
  };
  return { client, add, items };
}

const holder = vi.hoisted(() => ({ client: null as unknown, after: [] as Array<() => unknown> }));
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => holder.client,
}));
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => void holder.after.push(fn) };
});
vi.mock("@/lib/staff-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/staff-auth")>()),
  requireLogisticsApi: async () => ({ ok: true, actor: { kind: "admin", name: "Tests" } }),
}));

let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nopirkts-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
  holder.client = null;
  holder.after = [];
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

async function nopirkts(body: Record<string, unknown>) {
  vi.resetModules();
  const route = await import("@/app/api/admin/iriss-logistics/orders/route");
  const res = await route.POST(
    new Request("https://www.provin.lv/api/admin/iriss-logistics/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "auction", auction: "Autobid", make: "Volvo", model: "XC60", title: "Volvo XC60", status: "organize_pickup", toAutoparks: true, ...body }),
    }),
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as { autoparksCarId: string; order: { vin: string } };
  for (const fn of holder.after.splice(0)) await fn();
  const store = await import("@/lib/iriss-autoparks-store");
  const car = (await store.readAutoparksState()).cars.find((c) => c.id === json.autoparksCarId);
  return { json, car };
}

describe("normalizeLogisticsVin", () => {
  it("lielie burti, bez atstarpēm, defisēm un «VIN:»; ne garāks par 17", () => {
    expect(normalizeLogisticsVin(" yv1 uza8vdk-1234567 ")).toBe(VIN);
    expect(normalizeLogisticsVin("VIN: YV1UZA8VDK1234567")).toBe(VIN);
    expect(normalizeLogisticsVin(`${VIN}99`)).toBe(VIN);
    expect(normalizeLogisticsVin(undefined)).toBe("");
  });
});

describe("«+ Nopirkts» -> Autoparks", () => {
  it("VIN (arī ar atstarpēm/mazajiem burtiem) saglabājas Loģistikā un v1 Autoparka ierakstā", async () => {
    const { json, car } = await nopirkts({ vin: " yv1uza8vdk 1234567" });
    expect(json.order.vin).toBe(VIN);
    expect(car).toMatchObject({ vin: VIN, status: "in_transit", make: "Volvo", model: "XC60" });
  });

  it("tukšs formas VIN -> ņem VIN no atpazītā sludinājuma", async () => {
    const { car } = await nopirkts({ vin: "", listingParsed: { make: "Volvo", model: "XC60", vin: VIN.toLowerCase() } });
    expect(car?.vin).toBe(VIN);
  });

  it("esoša /STOCK mape (pēc VIN6) tiek sasaistīta; jauna mape netiek veidota", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    db.add("folder", `/STOCK/Audi A4 2015${SEP}036715`);
    holder.client = db.client;
    const { car } = await nopirkts({ vin: VIN });
    expect(car?.dropboxFolderPath).toBe(FOLDER);
    expect(car?.dropboxFolderId).toBe(db.items.get(FOLDER.toLowerCase())!.id);
    expect(db.client.ensureFolder).not.toHaveBeenCalled();
    expect(db.client.move).not.toHaveBeenCalled();
  });

  it("mapes nav -> neveido, nekrīt, auto paliek bez sasaistes", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", `/STOCK/Audi A4 2015${SEP}036715`);
    holder.client = db.client;
    const { car } = await nopirkts({ vin: VIN });
    expect(car).toMatchObject({ vin: VIN });
    expect(car?.dropboxFolderId ?? "").toBe("");
    expect(db.client.ensureFolder).not.toHaveBeenCalled();
    expect([...db.items.keys()]).toHaveLength(2);
  });

  it("Dropbox nav konfigurēts -> pirkums tāpat saglabājas", async () => {
    const { car } = await nopirkts({ vin: VIN });
    expect(car?.vin).toBe(VIN);
  });

  it("agrāk bez VIN izveidots Autoparka auto saņem VIN no Loģistikas; esošu VIN nepārraksta", async () => {
    vi.resetModules();
    const store = await import("@/lib/iriss-autoparks-store");
    const actor = { id: "u1", name: "Tests" };
    const empty = await store.createAutoparksCar({ orderId: "o1", make: "Volvo" }, actor);
    const order = { id: "o1", title: "Volvo XC60", vin: VIN, make: "Volvo", model: "XC60", mileageKm: null } as Parameters<typeof store.ensureAutoparksCarFromOrder>[0];
    const filled = await store.ensureAutoparksCarFromOrder(order, actor);
    expect(filled).toMatchObject({ created: false, car: { id: empty.id, vin: VIN } });
    const other = await store.createAutoparksCar({ orderId: "o2", make: "BMW", vin: "WBA00000000000001" }, actor);
    const kept = await store.ensureAutoparksCarFromOrder({ ...order, id: "o2", vin: "YV1ZZZ8VDK7654321" }, actor);
    expect(kept.car).toMatchObject({ id: other.id, vin: "WBA00000000000001" });
  });
});
