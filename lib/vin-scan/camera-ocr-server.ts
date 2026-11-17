/**
 * VIN SCAN kameras kadra OCR (tesseract). Atsevišķs worker ar VIN alfabētu, lai neietekmē sludinājumu OCR.
 */
import "server-only";

import { tesseractLocalWorkerOptions } from "@/lib/tesseract-local-lang";
import { CAMERA_OCR_VARIANT_ORDER, cameraOcrStopAfterPick } from "@/lib/vin-scan/camera-frame";
import { pickCameraVin, type CameraVinPick } from "@/lib/vin-scan/camera-vin";

const VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const OCR_WIDTH = 1600;
const RECOGNIZE_TIMEOUT_MS = 9_000;

type TessWorker = {
  recognize: (img: Buffer) => Promise<{ data: { text?: string } }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  terminate?: () => Promise<unknown>;
};

let workerPromise: Promise<TessWorker> | null = null;
/** Viens recognize vienlaikus - tesseract worker nav drošs paralēliem kadriem (klienta abort atstāj iepriekšējo dzīvu). */
let workChain: Promise<unknown> = Promise.resolve();

async function cameraWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = (await createWorker("eng", undefined, tesseractLocalWorkerOptions())) as unknown as TessWorker;
      await worker.setParameters({ tessedit_char_whitelist: VIN_ALPHABET, tessedit_pageseg_mode: "6" });
      return worker;
    })();
  }
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

/**
 * Nils 01.11: «pēc neveiksmīga mēģinājuma vairs nestrādā». Noildzis kadrs atstāja worker aizņemtu,
 * un visi nākamie kadri stāvēja rindā aiz tā. Pēc noildzes worker aizver; nākamais kadrs startē jaunu.
 */
async function resetWorker(worker: TessWorker): Promise<void> {
  workerPromise = null;
  await worker.terminate?.().catch(() => undefined);
}

async function recognize(worker: TessWorker, img: Buffer): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data } = await Promise.race([
      worker.recognize(img),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ocr_timeout")), RECOGNIZE_TIMEOUT_MS);
      }),
    ]);
    return data.text ?? "";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ocrVinFromCameraFrameLocked(buf: Buffer, signal?: AbortSignal): Promise<CameraVinPick | null> {
  if (signal?.aborted) return null;
  const sharp = (await import("sharp")).default;
  const base = sharp(buf, { failOn: "none" }).rotate().resize({ width: OCR_WIDTH }).greyscale().normalise();
  const variants: Record<(typeof CAMERA_OCR_VARIANT_ORDER)[number], () => Promise<Buffer>> = {
    invert: () => base.clone().negate().threshold(150).png().toBuffer(),
    sharpen: () => base.clone().sharpen().png().toBuffer(),
    threshold: () => base.clone().threshold(150).png().toBuffer(),
  };
  const worker = await cameraWorker();
  const texts: string[] = [];
  for (const name of CAMERA_OCR_VARIANT_ORDER) {
    if (signal?.aborted) break;
    try {
      texts.push(await recognize(worker, await variants[name]()));
      const pick = pickCameraVin(texts);
      if (cameraOcrStopAfterPick(Boolean(pick?.vin))) return pick;
    } catch (e) {
      if (e instanceof Error && e.message === "ocr_timeout") {
        await resetWorker(worker);
        break;
      }
    }
  }
  return pickCameraVin(texts);
}

/** Trīs varianti (inversija pirmā); pēc pirmā VIN tālākos neturpinā. */
export function ocrVinFromCameraFrame(buf: Buffer, signal?: AbortSignal): Promise<CameraVinPick | null> {
  const run = workChain.then(
    () => ocrVinFromCameraFrameLocked(buf, signal),
    () => ocrVinFromCameraFrameLocked(buf, signal),
  );
  workChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
