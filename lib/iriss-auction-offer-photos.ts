import { IRISS_MAX_OFFER_ATTACHMENTS, type IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

const MAX_AUCTION_PHOTO_URLS = IRISS_MAX_OFFER_ATTACHMENTS;

function cleanHttpUrl(raw: string): string {
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t) || t.length > 2000) return "";
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

export function auctionPhotoUrlsFromHit(hit: { imageUrl?: string; imageUrls?: readonly string[] }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [hit.imageUrl ?? "", ...(hit.imageUrls ?? [])]) {
    const href = cleanHttpUrl(raw);
    if (!href) continue;
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(href);
    if (out.length >= MAX_AUCTION_PHOTO_URLS) break;
  }
  return out;
}

export function attachmentsFromAuctionPhotoUrls(
  urls: readonly string[],
  existing: readonly IrissOfferAttachment[] = [],
): IrissOfferAttachment[] {
  const room = IRISS_MAX_OFFER_ATTACHMENTS - existing.length;
  if (room <= 0) return [...existing];
  const seen = new Set(
    existing
      .flatMap((a) => [a.blobUrl ?? "", a.dataUrl ?? ""])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const added: IrissOfferAttachment[] = [];
  for (const raw of urls) {
    if (added.length >= room) break;
    const href = cleanHttpUrl(raw);
    if (!href) continue;
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: crypto.randomUUID(),
      name: `izsole-${added.length + existing.length + 1}.jpg`,
      mimeType: "image/jpeg",
      size: 0,
      dataUrl: "",
      blobUrl: href,
    });
  }
  return [...existing, ...added];
}
