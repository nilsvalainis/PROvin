import { describe, expect, it, vi } from "vitest";

import { ap2PatchJson, ap2ShouldRetry } from "./ap2-save";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const noSleep = () => Promise.resolve();

describe("Autoparks drošā saglabāšana", () => {
  it("tīkla kļūdu atkārto un otrajā reizē saglabā", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(200, { basics: { id: "a" } }));
    const r = await ap2PatchJson<{ basics: { id: string } }>("/x", { make: "Volvo" }, { fetchImpl: f, sleep: noSleep });
    expect(r.ok).toBe(true);
    expect(r.data?.basics.id).toBe("a");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("servera kļūdu atkārto ne vairāk kā 3 reizes", async () => {
    const f = vi.fn<typeof fetch>().mockImplementation(async () => json(503, {}));
    const r = await ap2PatchJson("/x", {}, { fetchImpl: f, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("validācijas kļūdu (400) neatkārto un atdod servera atbildi", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(json(400, { error: "invalid_power" }));
    const r = await ap2PatchJson<{ error: string }>("/x", { powerKw: 9999 }, { fetchImpl: f, sleep: noSleep });
    expect(r).toEqual({ ok: false, status: 400, data: { error: "invalid_power" } });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("kuras atbildes atkārtot", () => {
    expect([null, 500, 502, 429, 408].map(ap2ShouldRetry)).toEqual([true, true, true, true, true]);
    expect([400, 401, 404, 409].map(ap2ShouldRetry)).toEqual([false, false, false, false]);
  });
});
