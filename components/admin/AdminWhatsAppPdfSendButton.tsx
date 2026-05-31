"use client";

import { useCallback, useMemo } from "react";
import { normalizeWhatsAppPhoneDigits, openWhatsAppChat } from "@/lib/admin-whatsapp-phone";

function WhatsAppIconGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path
        fill="currentColor"
        d="M19.11 4.89A9.91 9.91 0 0 0 12.06 2a9.99 9.99 0 0 0-8.57 15.14L2 22l5-1.31A10 10 0 1 0 19.11 4.89ZM12.06 20a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-2.96.78.8-2.88-.19-.3A8 8 0 1 1 12.06 20Zm4.4-5.97c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.17-1.39-1.3-1.63-.14-.24-.01-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

const btnActiveClass =
  "inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/80 bg-emerald-500 px-2 text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-1";

const btnDisabledClass =
  "inline-flex h-9 min-w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 text-[var(--color-provin-muted)] opacity-60";

/**
 * Ģenerē PDF, lejupielādē un atver WhatsApp ar iepriekš aizpildītu ziņu (kā audita VIN joslā).
 */
export function AdminWhatsAppPdfSendButton({
  phone,
  prefillMessage,
  generatePdf,
  className,
}: {
  phone: string | null | undefined;
  prefillMessage: string;
  generatePdf: () => Promise<File | null>;
  className?: string;
}) {
  const phoneDigits = useMemo(() => normalizeWhatsAppPhoneDigits(phone), [phone]);

  const handleClick = useCallback(async () => {
    if (!phoneDigits) return;
    const chatWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const pdfFile = await generatePdf();
      if (!pdfFile) {
        chatWindow?.close();
        return;
      }
      const objectUrl = URL.createObjectURL(pdfFile);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = pdfFile.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

      openWhatsAppChat(phoneDigits, prefillMessage, chatWindow);
      alert(
        "Atvērts WhatsApp čats. PDF konsultācija lejupielādēta automātiski — pievienojiet to kā pielikumu ziņai.",
      );
    } catch (error) {
      chatWindow?.close();
      alert(error instanceof Error ? error.message.slice(0, 220) : "Neizdevās sagatavot PDF WhatsApp nosūtīšanai.");
    }
  }, [generatePdf, phoneDigits, prefillMessage]);

  if (!phoneDigits) {
    return (
      <span
        className={className ? `${btnDisabledClass} ${className}` : btnDisabledClass}
        title="Nav klienta tālruņa WhatsApp atvēršanai"
        aria-hidden
      >
        <WhatsAppIconGlyph />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={className ? `${btnActiveClass} ${className}` : btnActiveClass}
      title={`WhatsApp: ${(phone ?? "").trim()}`}
      aria-label="Ģenerēt PDF un atvērt WhatsApp ar ziņu klientam"
    >
      <WhatsAppIconGlyph />
    </button>
  );
}
