import "server-only";

import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { readIrissOfferAttachmentBytes, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import {
  irissOfferImageMimeForFormat,
  readIrissOfferImageWidth,
  renderIrissOfferDisplayImage,
  renderIrissOfferThumbJpeg,
  type IrissOfferImageFormat,
} from "@/lib/iriss-offer-image-thumb";
import { shouldServeOriginalOfferDisplay } from "@/lib/iriss-offer-public-photo";
import {
  buildIrissOfferPublicView,
  irissOfferPublicViewContainsSecret,
  isIrissOfferLinkUsable,
  isIrissOfferPublicImageMime,
  isSafeIrissOfferAttachmentId,
  type IrissOfferPublicView,
} from "@/lib/iriss-offer-client-link";
import {
  readIrissOfferClaimedDecision,
  readIrissOfferClientLinkByToken,
  recordIrissOfferLinkView,
} from "@/lib/iriss-offer-client-link-store";

export async function openUsableIrissOfferLink(token: string, nowMs = Date.now()) {
  const link = await readIrissOfferClientLinkByToken(token);
  if (!link || !isIrissOfferLinkUsable(link, nowMs)) return null;
  const order = await readIrissPasutijums(link.orderId);
  if (!order || isIrissRecordDeleted(order)) return null;
  const offer = order.offers.find((item) => item.id === link.offerId);
  if (!offer) return null;
  return { link, offer, order };
}

export async function loadIrissOfferPublicView(token: string, nowMs = Date.now()): Promise<IrissOfferPublicView | null> {
  const opened = await openUsableIrissOfferLink(token, nowMs);
  if (!opened) return null;
  const viewed = await recordIrissOfferLinkView(opened.link.tokenHash, nowMs);
  if (!viewed || !isIrissOfferLinkUsable(viewed, nowMs)) return null;
  const claimed = viewed.decision ? null : await readIrissOfferClaimedDecision(viewed.tokenHash);
  const view = buildIrissOfferPublicView(
    opened.offer,
    {
      decision: viewed.decision || claimed?.decision || "",
      question: viewed.question,
      decidedAt: viewed.decision ? viewed.decidedAt : claimed?.decidedAt ?? "",
    },
    { nowMs },
  );
  const secrets = [opened.order.id, opened.link.token, opened.link.tokenHash, opened.link.offerId];
  if (secrets.some((secret) => irissOfferPublicViewContainsSecret(view, secret))) return null;
  return view;
}

export type IrissOfferPublicPhotoVariant =
  | { kind: "full" }
  | { kind: "thumb" }
  | { kind: "display"; width: number; format: IrissOfferImageFormat };

export async function readIrissOfferPublicPhoto(
  token: string,
  attachmentId: string,
  variant: IrissOfferPublicPhotoVariant = { kind: "full" },
  nowMs = Date.now(),
): Promise<{ mimeType: string; bytes: Buffer } | null> {
  if (!isSafeIrissOfferAttachmentId(attachmentId)) return null;
  const opened = await openUsableIrissOfferLink(token, nowMs);
  if (!opened) return null;
  const att = opened.offer.attachments.find((item) => item.id === attachmentId);
  if (!att || !isIrissOfferPublicImageMime(att.mimeType)) return null;

  if (variant.kind === "thumb") {
    if (att.thumbDataUrl || att.thumbBlobPath) {
      const thumb = await readIrissOfferAttachmentBytes({
        dataUrl: att.thumbDataUrl || "",
        blobPath: att.thumbBlobPath || "",
        mimeType: "image/jpeg",
      });
      if (thumb && thumb.bytes.length > 0) return { mimeType: "image/jpeg", bytes: thumb.bytes };
    }
    const full = await readIrissOfferAttachmentBytes(att);
    if (!full || full.bytes.length === 0) return null;
    const rendered = await renderIrissOfferThumbJpeg(full.bytes);
    if (!rendered) return null;
    return { mimeType: "image/jpeg", bytes: rendered };
  }

  const file = await readIrissOfferAttachmentBytes(att);
  if (!file || file.bytes.length === 0 || !isIrissOfferPublicImageMime(file.mimeType)) return null;
  const mimeType = file.mimeType.split(";")[0]?.trim() || "application/octet-stream";

  if (variant.kind === "display") {
    const sourceWidth = await readIrissOfferImageWidth(file.bytes);
    if (shouldServeOriginalOfferDisplay(sourceWidth, variant.width)) {
      return { mimeType, bytes: file.bytes };
    }
    const rendered = await renderIrissOfferDisplayImage(file.bytes, variant.width, variant.format);
    if (rendered) return { mimeType: irissOfferImageMimeForFormat(variant.format), bytes: rendered };
  }

  return { mimeType, bytes: file.bytes };
}
