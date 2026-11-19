import { describe, expect, it } from "vitest";
import { callWithOneRetry, isTransientApiFailure } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";

function seq(results: Array<{ status: number; data?: unknown } | Error>) {
  let i = 0;
  const calls: number[] = [];
  const fn = async () => {
    calls.push(i);
    const r = results[i++];
    if (r instanceof Error) throw r;
    return r;
  };
  return { fn, calls };
}

const noSleep = { sleep: async () => {} };

describe("worker pending: vienreiz atkārto pārejošu kļūdu", () => {
  it("500 -> pēc pauzes otrais mēģinājums atgriež 200 rindu", async () => {
    const { fn, calls } = seq([{ status: 500 }, { status: 200, data: { requests: [{ id: "wbr_1" }] } }]);
    const waited: number[] = [];
    const r = await callWithOneRetry(fn, { sleep: async (ms: number) => void waited.push(ms) });
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(waited).toEqual([2000]);
  });

  it("tīkla kļūda -> otrais mēģinājums izdodas", async () => {
    const { fn, calls } = seq([new Error("fetch failed"), { status: 200, data: {} }]);
    const r = await callWithOneRetry(fn, noSleep);
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("otrreiz arī 503 -> atgriež 503 (worker met pending_http_503), trešā mēģinājuma nav", async () => {
    const { fn, calls } = seq([{ status: 502 }, { status: 503 }, { status: 200 }]);
    const r = await callWithOneRetry(fn, noSleep);
    expect(r.status).toBe(503);
    expect(calls).toHaveLength(2);
  });

  it("otrreiz tīkla kļūda -> kļūda tiek mesta tālāk", async () => {
    const { fn } = seq([new Error("a"), new Error("timeout")]);
    await expect(callWithOneRetry(fn, noSleep)).rejects.toThrow("timeout");
  });

  it("200 un 4xx netiek atkārtoti", async () => {
    for (const status of [200, 401, 404]) {
      const { fn, calls } = seq([{ status }, { status: 200 }]);
      const r = await callWithOneRetry(fn, noSleep);
      expect(r.status).toBe(status);
      expect(calls).toHaveLength(1);
    }
  });

  it("onRetry saņem statusu (žurnālam)", async () => {
    const { fn } = seq([{ status: 500 }, { status: 200 }]);
    const seen: unknown[] = [];
    await callWithOneRetry(fn, { ...noSleep, onRetry: (i: unknown) => seen.push(i) });
    expect(seen).toEqual([{ status: 500, err: "" }]);
  });

  it("isTransientApiFailure: 5xx un kļūda - jā, 2xx/4xx - nē", () => {
    expect(isTransientApiFailure({ status: 500 }, null)).toBe(true);
    expect(isTransientApiFailure(undefined, new Error("x"))).toBe(true);
    expect(isTransientApiFailure({ status: 200 }, null)).toBe(false);
    expect(isTransientApiFailure({ status: 429 }, null)).toBe(false);
  });
});
