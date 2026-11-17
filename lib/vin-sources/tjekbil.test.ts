import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetVinFetchDedupe } from "@/lib/vin-fetch-dedupe";
import { fetchTjekbil, fetchTjekbilDmrRaw, TJEKBIL_FETCH_TIMEOUT_MS } from "@/lib/vin-sources/tjekbil";
import { probeTjekbil } from "@/lib/vin-scan/probes";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";

vi.mock("@/lib/vin-sources/nummerplade", () => ({
  fetchNummerplade: async () => null,
}));

const VIN = "WVWZZZ1KZ6W000001";

/** fetch, kas nekad neatbild, bet ievēro AbortSignal (kā īstais fetch). */
function hangingFetch(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener("abort", () => {
        reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
      });
    })) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("tjekbil fetch noildze", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetVinFetchDedupe();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetVinFetchDedupe();
  });

  it("DMR pieprasījums pēc 10 s met Error('timeout')", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const p = fetchTjekbilDmrRaw(VIN);
    const assertion = expect(p).rejects.toThrow(/^timeout$/);
    await vi.advanceTimersByTimeAsync(TJEKBIL_FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("pirms 10 s vēl gaida (nav priekšlaicīgas noildzes)", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    let settled = false;
    const p = fetchTjekbilDmrRaw(VIN).then(
      () => (settled = true),
      () => (settled = true),
    );
    await vi.advanceTimersByTimeAsync(TJEKBIL_FETCH_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe(true);
  });

  it("VIN SCAN zonde noildzi rāda kā statusu timeout", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const p = probeTjekbil({ vin: VIN, plates: emptyVinScanPlates(), listingUrl: "" } as Parameters<typeof probeTjekbil>[0]);
    await vi.advanceTimersByTimeAsync(TJEKBIL_FETCH_TIMEOUT_MS);
    const row = await p;
    expect(row.status).toBe("timeout");
  });

  it("papildu daļu noildze uzvedas kā trūkstoša daļa, DMR dati paliek", async () => {
    const dmr = { basic: { koeretoejId: 123, stelnummer: VIN, registreringsnummer: "AB12345" } };
    const urls: string[] = [];
    vi.stubGlobal("fetch", ((url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.includes("/dmr/vin/")) return Promise.resolve(jsonResponse(dmr));
      return hangingFetch()(url, init);
    }) as typeof fetch);
    const p = fetchTjekbil(VIN);
    await vi.advanceTimersByTimeAsync(TJEKBIL_FETCH_TIMEOUT_MS);
    const res = await p;
    expect(res.source).toBe("tjekbil");
    // Papildu daļas tika pieprasītas un noildza, bet rezultāts tik un tā atgriezās.
    expect(urls.some((u) => u.includes("mileagelogs?dmrId=123"))).toBe(true);
    const raw = JSON.parse(res.raw ?? "{}") as { tjekbil: Record<string, unknown> };
    expect(raw.tjekbil.dmr).toMatchObject({ basic: { koeretoejId: 123 } });
    expect(raw.tjekbil.mileagelogs).toBeNull();
    expect(raw.tjekbil.wanted).toBeNull();
    expect(raw.tjekbil.rapex).toBeNull();
    expect(raw.tjekbil.prices).toBeNull();
  });
});
