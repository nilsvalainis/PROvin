import { beforeEach, describe, expect, it, vi } from "vitest";

const ocr = vi.hoisted(() => ({ fn: vi.fn() }));
const gate = vi.hoisted(() => ({ ok: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/staff-auth", () => ({
  requireIrissSectionApi: async () =>
    gate.ok ? { ok: true } : { ok: false, response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) },
}));
vi.mock("@/lib/vin-scan/camera-ocr-server", () => ({ ocrVinFromCameraFrame: ocr.fn }));

import { POST } from "@/app/api/admin/vin-scan/camera-ocr/route";

const VIN = "WBA3A5C50CF256551";

function request(bytes: number, signal?: AbortSignal) {
  return new Request("http://localhost/api/admin/vin-scan/camera-ocr", {
    method: "POST",
    body: Buffer.alloc(bytes, 1),
    signal,
  });
}

beforeEach(() => {
  ocr.fn.mockReset();
  gate.ok = true;
});

describe("POST /api/admin/vin-scan/camera-ocr", () => {
  it("nodod OCR kadru kopā ar klienta aborta signālu un atgriež VIN", async () => {
    ocr.fn.mockResolvedValue({ vin: VIN, checkDigitOk: true, alts: [] });
    const ctrl = new AbortController();
    const req = request(2000, ctrl.signal);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ vin: VIN, checkDigitOk: true, alts: [] });
    expect(ocr.fn).toHaveBeenCalledTimes(1);
    const [buf, signal] = ocr.fn.mock.calls[0]!;
    expect((buf as Buffer).length).toBe(2000);
    expect(signal).toBe(req.signal);
    ctrl.abort();
    expect((signal as AbortSignal).aborted).toBe(true);
  });

  it("bez VIN atgriež tukšu atbildi, nevis kļūdu", async () => {
    ocr.fn.mockResolvedValue(null);
    expect(await (await POST(request(2000))).json()).toEqual({ vin: "", checkDigitOk: false, alts: [] });
  });

  it("pārāk mazu vai pārāk lielu attēlu OCR nenodod", async () => {
    expect((await POST(request(100))).status).toBe(400);
    expect((await POST(request(4_000_001))).status).toBe(400);
    expect(ocr.fn).not.toHaveBeenCalled();
  });

  it("bez tiesībām OCR nenotiek; OCR kļūda ir 502", async () => {
    gate.ok = false;
    expect((await POST(request(2000))).status).toBe(401);
    expect(ocr.fn).not.toHaveBeenCalled();
    gate.ok = true;
    ocr.fn.mockRejectedValue(new Error("boom"));
    expect((await POST(request(2000))).status).toBe(502);
  });
});
