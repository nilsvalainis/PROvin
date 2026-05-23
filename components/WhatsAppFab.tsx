"use client";

import type { MouseEvent } from "react";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { whatsappAppUrl, whatsappWebUrl } from "@/lib/contact";

function WhatsAppIcon({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 24 24" className="provin-whatsapp-fab__svg" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M19.11 4.89A9.91 9.91 0 0 0 12.06 2a9.99 9.99 0 0 0-8.57 15.14L2 22l5-1.31A10 10 0 1 0 19.11 4.89ZM12.06 20a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-2.96.78.8-2.88-.19-.3A8 8 0 1 1 12.06 20Zm4.4-5.97c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.17-1.39-1.3-1.63-.14-.24-.01-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function isMobileHandset(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** Peldošā WhatsApp poga (SmartSupp vietā) — mobilajā atver lietotni. */
export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const webHref = whatsappWebUrl();
  const gradientId = useId().replace(/:/g, "");

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isMobileHandset()) return;
    e.preventDefault();
    window.location.href = whatsappAppUrl();
    window.setTimeout(() => {
      window.location.href = webHref;
    }, 700);
  };

  return (
    <a
      href={webHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={t("whatsappFab")}
      className="provin-whatsapp-fab"
    >
      <span className="provin-whatsapp-fab__ring" aria-hidden />
      <span className="provin-whatsapp-fab__icon">
        <WhatsAppIcon gradientId={gradientId} />
      </span>
    </a>
  );
}
