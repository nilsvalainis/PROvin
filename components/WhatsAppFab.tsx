"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { whatsappChatUrl } from "@/lib/contact";
import { normalizeSitePath } from "@/lib/site-rail-sections";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";

export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const pathname = usePathname() ?? "";
  const p = normalizeSitePath(pathname);
  const isHome = p === "/" || p === "";

  /** Mājas hero: mobilajā — tieši virs 4 pīlāru augšējās malas (~minimāla sprauga); citur / desktop — apakšējā stūris. */
  const className = [
    "provin-home-pill-cta provin-home-pill-cta--fab fixed right-[max(1.25rem,env(safe-area-inset-right,0px))] z-50 touch-manipulation shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95",
    isHome
      ? "max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+7.125rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
      : "bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]",
  ].join(" ");

  return (
    <a
      href={whatsappChatUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={t("whatsappFab")}
    >
      <WhatsAppBrandIcon className="h-[1.49rem] w-[1.49rem]" />
    </a>
  );
}
