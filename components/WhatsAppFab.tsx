"use client";

import { useTranslations } from "next-intl";
import { whatsappChatUrl } from "@/lib/contact";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";

export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const className =
    "provin-btn fixed z-50 flex h-14 w-14 min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-white shadow-[0_8px_28px_rgba(0,102,214,0.4)] active:scale-95 bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))]";

  return (
    <a
      href={whatsappChatUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={t("whatsappFab")}
    >
      <WhatsAppBrandIcon className="h-[1.65rem] w-[1.65rem]" />
    </a>
  );
}
