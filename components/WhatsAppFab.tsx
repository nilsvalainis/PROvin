"use client";

import { useTranslations } from "next-intl";
import { whatsappChatUrl } from "@/lib/contact";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";

export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const className =
    "provin-home-pill-cta provin-home-pill-cta--fab fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))] z-50 touch-manipulation shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95";

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
