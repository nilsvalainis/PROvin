import { irissOrderRoomListingLinkCount, irissOrderRoomOfferStatus } from "@/lib/iriss-order-room";
import type { IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import type { IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_OFFERS_LINKS_TITLE = "Sludinājumu saites";
export const IRISS_OFFERS_NEW = "Jauns piedāvājums";
export const IRISS_OFFERS_NEW_NO_CLIENT = "Jauns piedāvājums bez klienta datiem";
export const IRISS_OFFERS_OPEN = "Atvērt piedāvājumu";
export const IRISS_OFFERS_CONTINUE = "Turpināt rediģēt";
export const IRISS_OFFERS_SEND = "Nosūtīt";
export const IRISS_OFFERS_PDF = "PDF";
export const IRISS_OFFERS_PDF_NO_IMAGES = "PDF bez attēliem";

export function formatIrissOffersLinksSummary(rec: IrissPasutijumsRecord): string {
  const n = irissOrderRoomListingLinkCount(rec);
  return n === 1 ? `${IRISS_OFFERS_LINKS_TITLE} · 1` : `${IRISS_OFFERS_LINKS_TITLE} · ${n}`;
}

export function irissOfferCardPrimary(
  offer: IrissOfferRecord,
  link: IrissOfferClientLinkAdminView | null,
): { id: "edit" | "open"; label: string } {
  if (irissOrderRoomOfferStatus(offer) !== "ready") {
    return { id: "edit", label: IRISS_OFFERS_CONTINUE };
  }
  if (link && link.status !== "revoked") {
    return { id: "open", label: IRISS_OFFERS_OPEN };
  }
  return { id: "edit", label: IRISS_OFFERS_SEND };
}
