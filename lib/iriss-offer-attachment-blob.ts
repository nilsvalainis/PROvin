/**
 * Piedāvājuma attēli: dataUrl paliek, līdz Blob ceļš ir saglabāts.
 * Migrācija nedzēš vecos dataUrl, ja augšupielāde neizdodas.
 */

import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

export function irissOfferAttachmentHasBytes(a: Pick<IrissOfferAttachment, "dataUrl" | "blobPath" | "size">): boolean {
  return Boolean(a.dataUrl) || Boolean(a.blobPath) || a.size > 0;
}

export function irissOfferImageBlobPath(orderId: string, offerId: string, attachmentId: string): string {
  return `iriss-pasutijumi/offers/${orderId}/${offerId}/${attachmentId}`;
}

export function parseDataUrlPayload(dataUrl: string): { mimeType: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
    if (bytes.length === 0) return null;
    return { mimeType: m[1] || "application/octet-stream", bytes };
  } catch {
    return null;
  }
}

export function attachmentAfterBlobPut(
  a: IrissOfferAttachment,
  blobPath: string,
  blobUrl?: string,
): IrissOfferAttachment {
  return {
    ...a,
    blobPath,
    blobUrl: blobUrl || a.blobUrl,
    dataUrl: "",
  };
}

export function keepAttachmentDataIfBlobFailed(a: IrissOfferAttachment): IrissOfferAttachment {
  return { ...a };
}
