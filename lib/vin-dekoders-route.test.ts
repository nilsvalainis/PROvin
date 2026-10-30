import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";

const events: unknown[] = [];
const csdd = vi.fn();
let usage = { decoderToday: 0, monthTotal: 0 };

vi.mock("@/lib/vin-check-stats-store", () => ({
  recordVinCheckEvent: async (e: unknown) => {
    events.push(e);
  },
  csddUsage: async () => usage,
}));
vi.mock("@/lib/csdd-tech-data-counted", () => ({ fetchCsddTechDataCounted: (...a: unknown[]) => csdd(...a) }));
vi.mock("@/lib/vin-memory-store", () => ({
  readVinMemory: async (vin: string) => (vin === "TMBJG7NE1J0123456" ? { vin, observations: [{}, {}], updatedAt: "" } : null),
}));
vi.mock("@/lib/free-vin-details", () => ({ fetchFreeVinDetails: async () => ({ vpic: null, signals: [] }) }));
vi.mock("@/lib/vin-model-learn-store", () => ({ readLearnedTable: async () => ({}) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ ok: true, retryAfterSec: 0 }) }));

const { GET } = await import("@/app/api/vin-dekoders/route");

function req(q: string, src = "home") {
  return new Request(`https://www.provin.lv/api/vin-dekoders?q=${encodeURIComponent(q)}&src=${src}`, { headers: { "x-forwarded-for": "1.2.3.4" } });
}

beforeEach(() => {
  events.length = 0;
  csdd.mockReset();
  usage = { decoderToday: 0, monthTotal: 0 };
});

describe("/api/vin-dekoders", () => {
  it("Eiropas VIN: modelis, arhīva skaits, uzskaite ar reģionu un shēmu", async () => {
    const res = await GET(req("TMBJG7NE1J0123456"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ kind: "vin", model: { make: "Škoda", model: "Octavia" }, memoryRecords: 2 });
    expect(events).toEqual([{ type: "check", kind: "vin", outcome: "ok", source: "home", region: "europe", model: "vag", memoryHit: true }]);
    expect(csdd).not.toHaveBeenCalled();
  });

  it("numurzīme: CSDD dati ar maskētu VIN, uzskaite 'plate ok'", async () => {
    csdd.mockResolvedValue({ found: true, message: "", data: { ...emptyCsddTechData(), vin: "TMBJG7NE1J0123456", make: "SKODA", model: "OCTAVIA", year: "2018", inspectionValidUntilIso: "2099-01-01" } });
    const res = await GET(req("ab-1234", "decoder"));
    const body = await res.json();
    expect(body).toMatchObject({ kind: "plate", plate: "AB1234", found: true, csdd: { make: "SKODA", vinMasked: "TMBJG7NE1J0******", inspection: "valid" }, memoryRecords: 2 });
    expect(JSON.stringify(body)).not.toContain("123456");
    expect(csdd).toHaveBeenCalledWith("AB1234", "decoder", expect.anything());
    expect(events).toEqual([{ type: "check", kind: "plate", outcome: "ok", source: "decoder", region: "europe", model: "csdd", memoryHit: true }]);
  });

  it("numurzīme nav reģistrā -> found false, uzskaite 'not_found'; CSDD kļūda -> 502 'csdd_error'", async () => {
    csdd.mockResolvedValueOnce({ found: false, message: "CSDD reģistrā šāds numurs netika atrasts" });
    const a = await (await GET(req("ZZ9999"))).json();
    expect(a).toEqual({ kind: "plate", plate: "ZZ9999", found: false });
    csdd.mockResolvedValueOnce({ found: false, message: "CSDD pieprasījums noildza" });
    const b = await GET(req("ZZ9998"));
    expect(b.status).toBe(502);
    expect(events.map((e) => (e as { outcome: string }).outcome)).toEqual(["not_found", "csdd_error"]);
  });

  it("dienas vai mēneša CSDD griesti sasniegti -> 503 'quota', CSDD nezvana", async () => {
    usage = { decoderToday: 200, monthTotal: 500 };
    expect((await GET(req("XY1111"))).status).toBe(503);
    usage = { decoderToday: 3, monthTotal: 9_000 };
    expect((await GET(req("XY1112"))).status).toBe(503);
    expect(csdd).not.toHaveBeenCalled();
    expect(events).toEqual([
      { type: "check", kind: "plate", outcome: "quota", source: "home" },
      { type: "check", kind: "plate", outcome: "quota", source: "home" },
    ]);
  });

  it("zem griestiem (8999 mēnesī, 199 šodien) numurzīme iet uz CSDD", async () => {
    usage = { decoderToday: 199, monthTotal: 8_999 };
    csdd.mockResolvedValue({ found: false, message: "netika atrasts" });
    expect((await GET(req("XY1113"))).status).toBe(200);
    expect(csdd).toHaveBeenCalledTimes(1);
  });

  it("kļūdains VIN un numurzīme tiek uzskaitīti atsevišķi", async () => {
    expect((await GET(req("WVWZZZ1KZ6W00000"))).status).toBe(400);
    expect((await GET(req("WVWZZZ1KZ6W00000O"))).status).toBe(400);
    expect((await GET(req("A1"))).status).toBe(400);
    expect(events.map((e) => `${(e as { kind: string }).kind}:${(e as { outcome: string }).outcome}`)).toEqual([
      "vin:invalid_length",
      "vin:invalid_chars",
      "plate:invalid_plate",
    ]);
  });
});
