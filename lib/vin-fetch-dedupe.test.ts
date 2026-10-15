import { describe, expect, it } from "vitest";

import { dedupeAsync, resetVinFetchDedupe } from "@/lib/vin-fetch-dedupe";

describe("avotu zvanu dedupe", () => {
  it("60 s atkārto to pašu solījumu un kļūdu nekešo", async () => {
    resetVinFetchDedupe();
    let calls = 0;
    const a = dedupeAsync("tjekbil-dmr:https://example.test", async () => {
      calls += 1;
      return "ok";
    });
    const b = dedupeAsync("tjekbil-dmr:https://example.test", async () => {
      calls += 1;
      return "other";
    });
    expect(await a).toBe("ok");
    expect(await b).toBe("ok");
    expect(calls).toBe(1);

    await expect(
      dedupeAsync("fail-once", async () => {
        throw new Error("http");
      }),
    ).rejects.toThrow("http");
    let retry = 0;
    const again = await dedupeAsync("fail-once", async () => {
      retry += 1;
      return "recovered";
    });
    expect(again).toBe("recovered");
    expect(retry).toBe(1);
    resetVinFetchDedupe();
  });
});
