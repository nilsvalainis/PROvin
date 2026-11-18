/**
 * Kameras kadra OCR serverī: īstais modulis ar viltotu tesseract un sharp. Pārbauda, kādā secībā
 * tiek mēģināti attēla varianti, ka pēc pirmā VIN darbs apstājas un ka klienta aborts aptur lasīšanu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  recognized: [] as string[],
  reply: ((): string => "") as (variant: string) => string,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tesseract-local-lang", () => ({ tesseractLocalWorkerOptions: () => ({}) }));
vi.mock("tesseract.js", () => ({
  createWorker: async () => ({
    setParameters: async () => undefined,
    terminate: async () => undefined,
    recognize: async (img: Buffer) => {
      const variant = img.toString("utf8");
      state.recognized.push(variant);
      return { data: { text: state.reply(variant) } };
    },
  }),
}));
/* sharp viltojums: katrs variants atgriež buferi ar savu operāciju nosaukumiem. */
vi.mock("sharp", () => {
  const variant = (ops: string[]) => ({
    negate: () => variant([...ops, "negate"]),
    threshold: () => variant([...ops, "threshold"]),
    sharpen: () => variant([...ops, "sharpen"]),
    png: () => variant(ops),
    toBuffer: async () => Buffer.from(ops.join("+")),
  });
  const base = { rotate: () => base, resize: () => base, greyscale: () => base, normalise: () => base, clone: () => variant([]) };
  return { default: () => base };
});

import { CAMERA_OCR_VARIANT_ORDER } from "@/lib/vin-scan/camera-frame";
import { ocrVinFromCameraFrame } from "@/lib/vin-scan/camera-ocr-server";

const VIN = "WBA3A5C50CF256551";
const FRAME = Buffer.from("jpeg");
/** Kādas sharp operācijas veido katru variantu. */
const VARIANT_OPS: Record<(typeof CAMERA_OCR_VARIANT_ORDER)[number], string> = {
  invert: "negate+threshold",
  sharpen: "sharpen",
  threshold: "threshold",
};

beforeEach(() => {
  state.recognized.length = 0;
  state.reply = () => "";
});

describe("kameras OCR serverī", () => {
  it("pirmo mēģina inversiju (gaiši burti uz tumšas plāksnītes); ar VIN tālāk neturpina", async () => {
    state.reply = () => `VIN ${VIN}`;
    const pick = await ocrVinFromCameraFrame(FRAME);
    expect(pick?.vin).toBe(VIN);
    expect(state.recognized).toEqual([VARIANT_OPS.invert]);
  });

  it("ja VIN nav, izmēģina visus variantus noteiktajā secībā", async () => {
    const pick = await ocrVinFromCameraFrame(FRAME);
    expect(pick?.vin ?? "").toBe("");
    expect(state.recognized).toEqual(CAMERA_OCR_VARIANT_ORDER.map((name) => VARIANT_OPS[name]));
  });

  it("apstājas pie pirmā varianta, kurā VIN ir nolasāms", async () => {
    state.reply = (variant) => (variant === VARIANT_OPS.sharpen ? VIN : "troksnis");
    const pick = await ocrVinFromCameraFrame(FRAME);
    expect(pick?.vin).toBe(VIN);
    expect(state.recognized).toEqual([VARIANT_OPS.invert, VARIANT_OPS.sharpen]);
  });

  it("jau pārtrauktu pieprasījumu nelasa vispār", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await ocrVinFromCameraFrame(FRAME, ctrl.signal)).toBeNull();
    expect(state.recognized).toEqual([]);
  });

  it("aborts lasīšanas laikā aptur nākamos variantus", async () => {
    const ctrl = new AbortController();
    state.reply = () => {
      ctrl.abort();
      return "troksnis";
    };
    await ocrVinFromCameraFrame(FRAME, ctrl.signal);
    expect(state.recognized).toEqual([VARIANT_OPS.invert]);
  });
});
