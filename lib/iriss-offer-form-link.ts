/**
 * j61: piedāvājuma redaktora kājenes poga "Links" - atrod jau esošo klienta saiti vai pasaka,
 * vai jaunu var izveidot (termiņš obligāts, kā IrissOfferClientLinkBar).
 */

import type { IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import { IRISS_OFFER_DEADLINE_MIN_LEAD_MS, normalizeOfferValidUntilAt } from "@/lib/iriss-offer-valid-until";

/** Aktīva saite šim piedāvājumam (nav atsaukta, nav beigusies) - to atkārtoti izmanto, jaunu neveido. */
export function pickReusableOfferClientLink(
  links: readonly Pick<IrissOfferClientLinkAdminView, "offerId" | "status" | "path">[],
  offerId: string,
): Pick<IrissOfferClientLinkAdminView, "offerId" | "status" | "path"> | null {
  for (let i = links.length - 1; i >= 0; i -= 1) {
    const link = links[i]!;
    if (link.offerId !== offerId || !link.path) continue;
    if (link.status === "revoked" || link.status === "expired") continue;
    return link;
  }
  return null;
}

/** Jaunai saitei termiņš obligāts un vismaz 5 min nākotnē (tas pats noteikums kā API un saišu joslā). */
export function offerClientLinkDeadlineReady(validUntilAt: string | undefined, nowMs: number): boolean {
  const deadline = normalizeOfferValidUntilAt(validUntilAt ?? "");
  if (!deadline) return false;
  const ms = Date.parse(deadline);
  return Number.isFinite(ms) && ms >= nowMs + IRISS_OFFER_DEADLINE_MIN_LEAD_MS;
}

export const IRISS_OFFER_LINK_NEEDS_DEADLINE =
  "Saitei vajag piedāvājuma termiņu - iestatiet to cilnē Cenas un spiediet Links vēlreiz.";
