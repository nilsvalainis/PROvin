"use client";

import { useTranslations } from "next-intl";
import { whatsappChatUrl } from "@/lib/contact";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";

export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const className =
    "provin-btn provin-btn--compact fixed z-50 flex h-[50px] w-[50px] min-h-[43px] min-w-[43px] items-center justify-center rounded-full text-white shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95 bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))]";

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
