import { describe, expect, it } from "vitest";
import { drainScanQueue, enqueueScan, type QueuedScan, type QueueStore } from "./scan-queue";

function memStore(): QueueStore & { map: Map<string, QueuedScan> } {
  const map = new Map<string, QueuedScan>();
  return {
    map,
    all: async () => [...map.values()].map((x) => ({ ...x })),
    put: async (i) => void map.set(i.id, { ...i }),
    remove: async (id) => void map.delete(id),
  };
}

const page = new Blob(["x"], { type: "image/jpeg" });

describe("bezsaistes rinda (T9)", () => {
  it("3 skenējumi -> augšupielāde pa vienam secībā; 503 paliek rindā ar Neizdevās; lokāli dzēš tikai pēc 200/409", async () => {
    const store = memStore();
    const a = await enqueueScan({ carId: "c", target: "invoice", title: "Servisa rēķins", pages: [page, page] }, store);
    await new Promise((r) => setTimeout(r, 2));
    const b = await enqueueScan({ carId: "c", target: "number_check", title: "Numuru salīdzināšanas akts", pages: [page] }, store);
    await new Promise((r) => setTimeout(r, 2));
    const c = await enqueueScan({ carId: "c", target: "diag", title: "CSDD diagnostika", pages: [page] }, store);
    const order: string[] = [];
    let running = 0;
    let maxParallel = 0;
    const status: Record<string, number> = { [a.id]: 200, [b.id]: 409, [c.id]: 503 };
    const n = await drainScanQueue(
      store,
      async (item) => {
        running += 1;
        maxParallel = Math.max(maxParallel, running);
        order.push(item.title);
        await new Promise((r) => setTimeout(r, 1));
        running -= 1;
        const st = status[item.id]!;
        return st === 200 ? { ok: true, status: 200 } : { ok: false, status: st };
      },
      () => undefined,
    );
    expect(order).toEqual(["Servisa rēķins", "Numuru salīdzināšanas akts", "CSDD diagnostika"]);
    expect(maxParallel).toBe(1);
    expect(n).toBe(2);
    expect([...store.map.values()].map((x) => [x.title, x.state])).toEqual([["CSDD diagnostika", "failed"]]);

    // Tīkls atpakaļ / VĒLREIZ -> augšupielādējas un pazūd.
    await drainScanQueue(store, async () => ({ ok: true, status: 200 }), () => undefined);
    expect(store.map.size).toBe(0);
  });

  it("tīkla kļūda (izņēmums) - nekas netiek dzēsts", async () => {
    const store = memStore();
    await enqueueScan({ carId: "c", target: "diag", title: "x", pages: [page] }, store);
    await drainScanQueue(store, async () => {
      throw new Error("offline");
    }, () => undefined);
    expect([...store.map.values()][0]!.state).toBe("failed");
  });
});
