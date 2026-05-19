"use client";

import { useCallback, useMemo } from "react";
import { adminCompactCopyBtnClass } from "@/components/admin/AdminClipboardButton";
import { normalizeWhatsAppPhoneDigits, openWhatsAppChat } from "@/lib/admin-whatsapp-phone";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

const whatsappBtnClass = `${adminCompactCopyBtnClass} border-emerald-200/90 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/80 hover:text-emerald-800`;

/** Blakus klienta tālrunim — atver WhatsApp sarunu (desktop app, tad wa.me). */
export function AdminWhatsAppOpenButton({ phone }: { phone: string }) {
  const digits = useMemo(() => normalizeWhatsAppPhoneDigits(phone), [phone]);

  const onClick = useCallback(() => {
    if (!digits) return;
    openWhatsAppChat(digits);
  }, [digits]);

  if (!digits) {
    return (
      <span
        className={`${adminCompactCopyBtnClass} cursor-not-allowed text-slate-400 opacity-50`}
        title="Nav derīga tālruņa numura WhatsApp atvēršanai"
        aria-hidden
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={whatsappBtnClass}
      title={`Atvērt WhatsApp: ${phone.trim()}`}
      aria-label="Atvērt WhatsApp sarunu ar klientu"
    >
      <WhatsAppIcon className="h-3.5 w-3.5" />
    </button>
  );
}
