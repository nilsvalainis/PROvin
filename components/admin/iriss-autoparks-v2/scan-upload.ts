"use client";

/**
 * Skenējuma augšupielāde (T4): bildes saspiež (~1600 px JPEG) un sūta pa daļām zem Vercel 4 MB limita.
 * Pirmā daļa izveido ierakstu (piem. rēķinu), nākamās pievieno lapas tam pašam rēķinam.
 */
export type ScanTarget = "number_check" | "diag" | "invoice" | "invoice_page";

const BATCH_BYTES = 3_400_000;
const BATCH_PAGES = 10;

export async function compressScanImage(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 450_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.74));
    // iOS: atbrīvo atmiņu uzreiz (citādi pēc vairākām lapām kanva kļūst melna).
    bmp.close();
    canvas.width = 0;
    canvas.height = 0;
    return blob ?? file;
  } catch {
    return file;
  }
}

export function batchPages(sizes: readonly number[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let bytes = 0;
  sizes.forEach((size, i) => {
    if (cur.length > 0 && (bytes + size > BATCH_BYTES || cur.length >= BATCH_PAGES)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(i);
    bytes += size;
  });
  if (cur.length) out.push(cur);
  return out;
}

export type ScanUploadResult = { ok: true; status: number } | { ok: false; status: number };

/** Sūta jau saspiestas lapas. `onProgress` 0..1 pa daļām. */
export async function uploadScanPages(
  carId: string,
  target: ScanTarget,
  pages: Blob[],
  opts: { invoiceId?: string; onProgress?: (p: number) => void; onInvoice?: (id: string) => void } = {},
): Promise<ScanUploadResult> {
  const batches = batchPages(pages.map((p) => p.size));
  let invoiceId = opts.invoiceId;
  let t: ScanTarget = target;
  for (let b = 0; b < batches.length; b += 1) {
    const form = new FormData();
    form.append("target", t);
    if (invoiceId) form.append("invoiceId", invoiceId);
    for (const i of batches[b]!) form.append("file", pages[i]!, `lapa-${i + 1}.jpg`);
    const res = await fetch(`/api/admin/iriss-autoparks-v2/serviss/${encodeURIComponent(carId)}/skenet`, { method: "POST", body: form }).catch(() => null);
    if (!res?.ok) return { ok: false, status: res?.status ?? 0 };
    const data = (await res.json().catch(() => null)) as { invoiceId?: string | null } | null;
    if (t === "invoice") {
      invoiceId = data?.invoiceId ?? undefined;
      if (invoiceId) opts.onInvoice?.(invoiceId);
      t = "invoice_page";
    }
    opts.onProgress?.((b + 1) / batches.length);
  }
  return { ok: true, status: 200 };
}
