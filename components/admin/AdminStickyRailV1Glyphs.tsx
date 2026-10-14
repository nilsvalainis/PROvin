import type { ReactNode } from "react";

import { WHATSAPP_BRAND_HEX } from "@/lib/admin-whatsapp-ui";
import { ADMIN_RAIL_V1_GLYPH, ADMIN_RAIL_V1_GLYPH_INNER } from "@/lib/admin-sticky-rail-v1-styles";

function GlyphBox({ children }: { children: React.ReactNode }) {
  return <span className={ADMIN_RAIL_V1_GLYPH}>{children}</span>;
}

export function RailVinBarcodeGlyph() {
  return (
    <GlyphBox>
      <svg className={ADMIN_RAIL_V1_GLYPH_INNER} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M4 6h2v12H4zM7 6h1v12H7zM9 6h2v12H9zM12 6h1v12h-1zM14 6h2v12h-2zM17 6h1v12h-1zM19 6h1v12h-1z" />
      </svg>
    </GlyphBox>
  );
}

export function RailPlateLvGlyph() {
  return (
    <GlyphBox>
      <span
        className="relative box-border flex h-3 w-5 max-h-5 max-w-5 shrink-0 items-center justify-center overflow-hidden rounded-[2px] border-[1.5px] border-slate-800 bg-white"
        aria-hidden
      >
        <span className="absolute bottom-0 left-0 top-0 w-[5px] bg-[#003399]" />
        <span className="relative ml-1 text-[5.5px] font-extrabold leading-none text-slate-900">LV</span>
      </span>
    </GlyphBox>
  );
}

export function RailWhatsAppGlyph() {
  return (
    <GlyphBox>
      <svg className={ADMIN_RAIL_V1_GLYPH_INNER} viewBox="0 0 24 24" aria-hidden>
        <path
          fill={WHATSAPP_BRAND_HEX}
          d="M19.11 4.89A9.91 9.91 0 0 0 12.06 2a9.99 9.99 0 0 0-8.57 15.14L2 22l5-1.31A10 10 0 1 0 19.11 4.89Zm-7.05 15.1a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-2.96.78.8-2.88-.19-.3A8 8 0 1 1 12.06 20Zm4.4-5.97c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.17-1.39-1.3-1.63-.14-.24-.01-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
        />
      </svg>
    </GlyphBox>
  );
}

export function RailSsLvLogoGlyph() {
  return (
    <GlyphBox>
      {/* Oficiālais ss.lv header SVG (i.ss.lv) */}
      <img
        src="/admin-brand/ss-lv-green.svg"
        alt="ss.lv"
        width={20}
        height={20}
        className={`${ADMIN_RAIL_V1_GLYPH_INNER} opacity-90`}
      />
    </GlyphBox>
  );
}

export function RailCopilotGlyph() {
  return (
    <GlyphBox>
      <svg className={ADMIN_RAIL_V1_GLYPH_INNER} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="provin-rail-copilot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="35%" stopColor="#8b5cf6" />
            <stop offset="70%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path
          fill="url(#provin-rail-copilot)"
          d="M12 2.5c2.2 3.1 5.8 4.2 5.8 7.8 0 2.2-1.4 3.6-3.2 4.1 2.5.6 4.4 2.4 4.4 5.1 0 3.4-3.1 5.5-6.5 4.8-1.2-.2-2.2-.8-3-1.6-.8.8-1.8 1.4-3 1.6-3.4.7-6.5-1.4-6.5-4.8 0-2.7 1.9-4.5 4.4-5.1-1.8-.5-3.2-1.9-3.2-4.1 0-3.6 3.6-4.7 5.8-7.8.6-.8 1.4-.8 2 0z"
        />
      </svg>
    </GlyphBox>
  );
}

export function RailFlashGlyph() {
  return (
    <GlyphBox>
      <svg className={ADMIN_RAIL_V1_GLYPH_INNER} viewBox="0 0 24 24" aria-hidden>
        <path
          d="M13 2L4 14h7l-1 8 10-14h-7V2z"
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </GlyphBox>
  );
}
