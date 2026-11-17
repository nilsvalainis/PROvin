import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_PERMISSIONS_POLICY } from "@/lib/csp";
import {
  CAMERA_OCR_VARIANT_ORDER,
  CAMERA_SHEET_FRESH,
  cameraObjectCoverCrop,
  cameraOcrStopAfterPick,
  cameraScanControlState,
  isCameraBlackFrame,
  jpegDataUrlToBlob,
  pickVinFromBarcodeValues,
  vinFromBarcodeRaw,
} from "@/lib/vin-scan/camera-frame";

function ctxOf(rgb: [number, number, number]) {
  return { getImageData: () => ({ data: new Uint8ClampedArray([...rgb, 255]) }) } as unknown as CanvasRenderingContext2D;
}

describe("VIN SCAN kameras kadrs", () => {
  it("object-cover josla paliek video bufera iekšpusē (iPhone portrets)", () => {
    const crop = cameraObjectCoverCrop({
      videoWidth: 1080,
      videoHeight: 1920,
      elementWidth: 390,
      elementHeight: 280,
      whole: false,
    });
    expect(crop).not.toBeNull();
    expect(crop!.sx).toBeGreaterThanOrEqual(0);
    expect(crop!.sy).toBeGreaterThanOrEqual(0);
    expect(crop!.sx + crop!.sw).toBeLessThanOrEqual(1080);
    expect(crop!.sy + crop!.sh).toBeLessThanOrEqual(1920);
    expect(crop!.sw).toBeGreaterThan(100);
    expect(crop!.sh).toBeGreaterThan(40);
  });

  it("vesels kadrs un tukši izmēri", () => {
    const whole = cameraObjectCoverCrop({
      videoWidth: 1920,
      videoHeight: 1080,
      elementWidth: 390,
      elementHeight: 280,
      whole: true,
    });
    expect(whole).not.toBeNull();
    expect(whole!.sx).toBeGreaterThanOrEqual(0);
    expect(whole!.sy).toBeGreaterThanOrEqual(0);
    expect(whole!.sx + whole!.sw).toBeLessThanOrEqual(1920);
    expect(cameraObjectCoverCrop({ videoWidth: 0, videoHeight: 1080, elementWidth: 390, elementHeight: 280, whole: false })).toBeNull();
  });

  it("melns kadrs (iOS 18 canvas) pret gaišu plāksnīti", () => {
    expect(isCameraBlackFrame(ctxOf([0, 0, 0]), 1920, 1080)).toBe(true);
    expect(isCameraBlackFrame(ctxOf([180, 170, 160]), 1920, 1080)).toBe(false);
    expect(isCameraBlackFrame(ctxOf([200, 200, 200]), 0, 0)).toBe(true);
  });

  it("svītrkods: tīrs VIN, ar prefiksu, nederīgs teksts", () => {
    expect(vinFromBarcodeRaw("WBA3A5C50CF256551")).toBe("WBA3A5C50CF256551");
    expect(vinFromBarcodeRaw("VIN:WBA3A5C50CF256551")).toBe("WBA3A5C50CF256551");
    expect(pickVinFromBarcodeValues(["abc", "WBA3A5C50CF256551 extra"])).toBe("WBA3A5C50CF256551");
    expect(vinFromBarcodeRaw("nav vin")).toBeNull();
  });

  it("JPEG data URL → blob; bojāts → null", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, ...Array.from({ length: 40 }, () => 1)]);
    const blob = jpegDataUrlToBlob(`data:image/jpeg;base64,${bytes.toString("base64")}`);
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/jpeg");
    expect(jpegDataUrlToBlob("data:text/plain,hi")).toBeNull();
    expect(jpegDataUrlToBlob("data:image/jpeg;base64,")).toBeNull();
  });
});

describe("VIN SCAN kameras pogas un OCR secība", () => {
  it("Nolasa VIN… laikā Nofotografēt paliek lietojams; Izmantot VIN - tikai ar 17 zīmēm", () => {
    const reading = cameraScanControlState({ ready: true, status: "reading", vin: "" });
    expect(reading.photoEnabled).toBe(true);
    expect(reading.useVinEnabled).toBe(false);
    expect(reading.showRescan).toBe(false);
    const filled = cameraScanControlState({ ready: true, status: "reading", vin: "WBA3A5C50CF256551" });
    expect(filled.photoEnabled).toBe(true);
    expect(filled.useVinEnabled).toBe(true);
    expect(cameraScanControlState({ ready: false, status: "idle", vin: "" }).photoEnabled).toBe(false);
  });

  it("atkārtoti atverot: nav aktīvu pogu ar iepriekšējo VIN un nav «Skenēt vēlreiz»", () => {
    const fresh = cameraScanControlState(CAMERA_SHEET_FRESH);
    expect(fresh).toEqual({ photoEnabled: false, useVinEnabled: false, showRescan: false });
    // Pirms labojuma laukā palika iepriekšējais VIN - tad «Izmantot VIN» bija aktīva jau pirms kameras.
    expect(cameraScanControlState({ ...CAMERA_SHEET_FRESH, vin: "WBA3A5C51CF256551" }).useVinEnabled).toBe(true);
  });

  it("inversija ir pirmā, un pēc pirmā VIN tālākos variantus neturpinā", () => {
    expect(CAMERA_OCR_VARIANT_ORDER[0]).toBe("invert");
    expect(cameraOcrStopAfterPick(true)).toBe(true);
    expect(cameraOcrStopAfterPick(false)).toBe(false);
  });
});

describe("VIN camera client boundary", () => {
  it("keeps node:crypto and server-only off the camera sheet import chain", () => {
    const root = process.cwd();
    const files = [
      "components/admin/mobile/AdminMobileVinCameraSheet.tsx",
      "lib/vin-scan/camera-vin.ts",
      "lib/vin-scan/camera-frame.ts",
      "lib/vin-scan/vin-decode.ts",
      "lib/vin-scan/vin-check.ts",
      "lib/vin-iso3779.ts",
      "lib/order-field-validation.ts",
    ];
    for (const file of files) {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src, file).not.toMatch(/from\s+["']node:crypto["']/);
      expect(src, file).not.toMatch(/import\s+["']server-only["']/);
      expect(src, file).not.toMatch(/camera-ocr-server/);
    }
  });

  it("Permissions-Policy atļauj kameru šajā izcelsmē", () => {
    expect(SITE_PERMISSIONS_POLICY).toMatch(/camera=\(self\)/);
    expect(SITE_PERMISSIONS_POLICY).not.toMatch(/camera=\(\)/);
    const cfg = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(cfg).toMatch(/SITE_PERMISSIONS_POLICY/);
    expect(cfg).not.toMatch(/camera=\(\)/);
  });

  it("camera-ocr serveris lieto inversiju pirmo un klienta aborta signālu", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/vin-scan/camera-ocr-server.ts"), "utf8");
    expect(src).toMatch(/CAMERA_OCR_VARIANT_ORDER/);
    expect(src).toMatch(/cameraOcrStopAfterPick/);
    expect(src).toMatch(/signal\?\.aborted/);
    const route = readFileSync(path.join(process.cwd(), "app/api/admin/vin-scan/camera-ocr/route.ts"), "utf8");
    expect(route).toMatch(/req\.signal/);
  });
});
