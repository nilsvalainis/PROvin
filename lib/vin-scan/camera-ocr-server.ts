/**
 * VIN SCAN kameras kadra OCR (tesseract). Atsevišķs worker ar VIN alfabētu, lai neietekmē sludinājumu OCR.
 */
import "server-only";

import { tesseractLocalWorkerOptions } from "@/lib/tesseract-local-lang";
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

/** Trīs varianti: pelēks, melnbalts slieksnis, inversija (gaiši burti uz tumša). VIN izvēlas pēc visiem trim. */
export async function ocrVinFromCameraFrame(buf: Buffer): Promise<CameraVinPick | null> {
  const sharp = (await import("sharp")).default;
  const base = sharp(buf, { failOn: "none" }).rotate().resize({ width: OCR_WIDTH }).greyscale().normalise();
  const variants = [
    () => base.clone().sharpen().png().toBuffer(),
    () => base.clone().threshold(150).png().toBuffer(),
    () => base.clone().negate().threshold(150).png().toBuffer(),
  ];
  const worker = await cameraWorker();
  const texts: string[] = [];
  for (const make of variants) {
    try {
      texts.push(await recognize(worker, await make()));
    } catch (e) {
      if (e instanceof Error && e.message === "ocr_timeout") {
        await resetWorker(worker);
        break;
      }
      // nākamais variants
    }
  }
  return pickCameraVin(texts);
}
