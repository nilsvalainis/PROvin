/**
 * Publiskās /p/[token] galerijas URL un sīktēlu joslas vilkšana.
 * Bez `sharp` - drīkst importēt "use client" komponentē.
 */

export const IRISS_OFFER_DISPLAY_WIDTHS = [480, 800, 1280] as const;
export const IRISS_OFFER_DISPLAY_DEFAULT_WIDTH = 800;

/** Hero konteiners: max-w 720px minus padding. */
export const IRISS_OFFER_HERO_SIZES = "(min-width: 640px) 688px, 100vw";

export const IRISS_OFFER_STRIP_DRAG_THRESHOLD_PX = 8;
export const IRISS_OFFER_THUMB_EAGER_COUNT = 8;

export const IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL = "public, max-age=86400, immutable";

export type IrissOfferPublicPhotoUrlVariant = "full" | "thumb" | "display";

export type IrissOfferStripDrag = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  dragged: boolean;
};

export function pickIrissOfferDisplayWidth(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return IRISS_OFFER_DISPLAY_DEFAULT_WIDTH;
  return (IRISS_OFFER_DISPLAY_WIDTHS as readonly number[]).includes(n) ? n : IRISS_OFFER_DISPLAY_DEFAULT_WIDTH;
}

export function irissOfferPublicPhotoUrl(
  token: string,
  id: string,
  variant: IrissOfferPublicPhotoUrlVariant = "full",
  width?: number,
): string {
  const base = `/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(id)}`;
  if (variant === "thumb") return `${base}?v=thumb`;
  if (variant === "display") return `${base}?v=display&w=${width ?? IRISS_OFFER_DISPLAY_DEFAULT_WIDTH}`;
  return base;
}

/** Hero: gatavais pilnais JPEG (bez on-the-fly AVIF). Maziem ekrāniem - 480 display. */
export function irissOfferPublicHeroSrcSet(token: string, id: string): string {
  return [
    `${irissOfferPublicPhotoUrl(token, id, "display", 480)} 480w`,
    `${irissOfferPublicPhotoUrl(token, id, "full")} 1600w`,
  ].join(", ");
}

/**
 * Avots jau ietilpst pieprasītajā platumā: Sharp `withoutEnlargement` tāpat neat palielinātu,
 * bet AVIF/WebP pārkodēšana uz Vercel funkcijas aizņem sekundes. Dodam oriģinālu.
 */
export function shouldServeOriginalOfferDisplay(sourceWidth: number, requestedWidth: number): boolean {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return false;
  if (!Number.isFinite(requestedWidth) || requestedWidth <= 0) return false;
  return sourceWidth <= requestedWidth;
}

export function isOfferHeroImageReady(img: { complete: boolean; naturalWidth: number }): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function irissOfferThumbLoadingMode(
  index: number,
  activeIndex: number,
  eagerCount = IRISS_OFFER_THUMB_EAGER_COUNT,
): "eager" | "lazy" {
  if (index === activeIndex) return "eager";
  if (Math.abs(index - activeIndex) <= 2) return "eager";
  if (index < eagerCount) return "eager";
  return "lazy";
}

export function beginIrissOfferStripDrag(input: {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
}): IrissOfferStripDrag {
  return { pointerId: input.pointerId, startX: input.startX, startScrollLeft: input.startScrollLeft, dragged: false };
}

export function moveIrissOfferStripDrag(
  drag: IrissOfferStripDrag,
  input: { pointerId: number; clientX: number; buttons: number; pointerType: string },
):
  | { action: "ignore" }
  | { action: "hold" }
  | { action: "end"; suppressClick: boolean }
  | { action: "scroll"; scrollLeft: number; capture: boolean; drag: IrissOfferStripDrag } {
  if (input.pointerId !== drag.pointerId) return { action: "ignore" };
  if (input.pointerType === "mouse" && input.buttons === 0) {
    return { action: "end", suppressClick: drag.dragged };
  }
  const dx = input.clientX - drag.startX;
  if (!drag.dragged && Math.abs(dx) <= IRISS_OFFER_STRIP_DRAG_THRESHOLD_PX) {
    return { action: "hold" };
  }
  return {
    action: "scroll",
    scrollLeft: drag.startScrollLeft - dx,
    capture: !drag.dragged,
    drag: { ...drag, dragged: true },
  };
}

export function endIrissOfferStripDrag(drag: IrissOfferStripDrag | null): { suppressClick: boolean } {
  return { suppressClick: Boolean(drag?.dragged) };
}
