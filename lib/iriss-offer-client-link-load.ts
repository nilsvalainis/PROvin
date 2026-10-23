import "server-only";

import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { readIrissOfferAttachmentBytes, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
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

export async function readIrissOfferPublicPhoto(
  token: string,
  attachmentId: string,
  nowMs = Date.now(),
): Promise<{ mimeType: string; bytes: Buffer } | null> {
  if (!isSafeIrissOfferAttachmentId(attachmentId)) return null;
  const opened = await openUsableIrissOfferLink(token, nowMs);
  if (!opened) return null;
  const att = opened.offer.attachments.find((item) => item.id === attachmentId);
  if (!att || !isIrissOfferPublicImageMime(att.mimeType)) return null;
  const file = await readIrissOfferAttachmentBytes(att);
  if (!file || file.bytes.length === 0 || !isIrissOfferPublicImageMime(file.mimeType)) return null;
  return { mimeType: file.mimeType.split(";")[0]?.trim() || "application/octet-stream", bytes: file.bytes };
}
