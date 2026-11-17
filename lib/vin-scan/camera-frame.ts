/**
 * VIN SCAN kameras kadrs: object-cover izgriezums, melna kadra tests, svītrkoda VIN, pogu stāvoklis.
 * Bez DOM / tesseract - testējams node vidē.
 */
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { cameraVinCandidates } from "@/lib/vin-scan/camera-vin";

export const CAMERA_FRAME_INSET_X = 24;
export const CAMERA_FRAME_H = 88;

/** VIN plāksnīte parasti ir gaiši burti uz tumša fona - inversija pirmā, lai neiztērētu 12 s pirms tās. */
export const CAMERA_OCR_VARIANT_ORDER = ["invert", "sharpen", "threshold"] as const;
export type CameraOcrVariant = (typeof CAMERA_OCR_VARIANT_ORDER)[number];

export type CameraVideoCrop = { sx: number; sy: number; sw: number; sh: number };

/**
 * Video `object-cover` → avota taisnstūris buferī. Safari drawImage ārpus bufera dod melnu kadru.
 */
export function cameraObjectCoverCrop(args: {
  videoWidth: number;
  videoHeight: number;
  elementWidth: number;
  elementHeight: number;
  whole: boolean;
  frameInsetX?: number;
  frameH?: number;
}): CameraVideoCrop | null {
  const vw = args.videoWidth;
  const vh = args.videoHeight;
  const ew = args.elementWidth;
  const eh = args.elementHeight;
  if (!vw || !vh || !ew || !eh) return null;
  const scale = Math.max(ew / vw, eh / vh);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const sx0 = (vw - ew / scale) / 2;
  const sy0 = (vh - eh / scale) / 2;
  const frameH = args.frameH ?? CAMERA_FRAME_H;
  const insetX = args.frameInsetX ?? CAMERA_FRAME_INSET_X;
  const band = args.whole ? eh : frameH * 1.6;
  const x = args.whole ? 0 : insetX / 2;
  const y = (eh - band) / 2;
  let sx = sx0 + x / scale;
  let sy = sy0 + Math.max(0, y) / scale;
  let sw = (ew - 2 * x) / scale;
  let sh = Math.min(eh, band) / scale;
  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > vw) sw = vw - sx;
  if (sy + sh > vh) sh = vh - sy;
  if (sw < 2 || sh < 2) return null;
  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.round(sw),
    sh: Math.round(sh),
  };
}

/** Kadrs ir melns, ja nevienā no 64 parauga punktiem nav gaismas (iOS 18 bieži tāds, kamēr preview jau rāda bildi). */
export function isCameraBlackFrame(ctx: Pick<CanvasRenderingContext2D, "getImageData">, width: number, height: number): boolean {
  if (width < 1 || height < 1) return true;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const px = ctx.getImageData(Math.floor(((x + 0.5) * width) / 8), Math.floor(((y + 0.5) * height) / 8), 1, 1).data;
      if (px[0]! > 12 || px[1]! > 12 || px[2]! > 12) return false;
    }
  }
  return true;
}

export function vinFromBarcodeRaw(raw: string): string | null {
  const direct = normalizeVin(raw);
  if (isValidVin(direct)) return direct;
  return cameraVinCandidates(raw).find((v) => isValidVin(v)) ?? null;
}

export function pickVinFromBarcodeValues(values: readonly string[]): string | null {
  for (const raw of values) {
    const vin = vinFromBarcodeRaw(raw);
    if (vin) return vin;
  }
  return null;
}

export function jpegDataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !/^data:image\/jpeg;base64$/i.test(dataUrl.slice(0, comma))) return null;
  const b64 = dataUrl.slice(comma + 1);
  if (!b64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 32) return null;
    return new Blob([bytes], { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export function cameraOcrStopAfterPick(hasVin: boolean): boolean {
  return hasVin;
}

/** VIN SCAN loga stāvoklis katrā atvēršanā: kamera vēl nav gatava, lauks tukšs. */
export const CAMERA_SHEET_FRESH = { ready: false, status: "idle", vin: "" } as const;

export function cameraScanControlState(args: {
  ready: boolean;
  status: "idle" | "reading" | "found" | "miss";
  vin: string;
}): { photoEnabled: boolean; useVinEnabled: boolean; showRescan: boolean } {
  return {
    photoEnabled: args.ready,
    useVinEnabled: isValidVin(normalizeVin(args.vin)),
    showRescan: args.status === "found" || args.status === "miss",
  };
}
