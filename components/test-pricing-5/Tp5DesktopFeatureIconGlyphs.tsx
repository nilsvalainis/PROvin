import Image from "next/image";
import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";

const GLYPH_CLASS = "h-6 w-6 shrink-0";
const BRAND_LOGO_CLASS =
  "h-6 w-6 shrink-0 object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0";

type GlyphProps = { className?: string };

function IconHandshake({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        d="m11 17-2 2a2.5 2.5 0 0 1-3.5-3.5l2.8-2.8M7.5 13.5 4 10a2.5 2.5 0 1 1 3.5-3.5l2.2 2.2M13.5 10.5 17 7a2.5 2.5 0 1 1 3.5 3.5l-2.8 2.8M10.5 16.5 14 20a2.5 2.5 0 0 0 3.5-3.5l-2.2-2.2"
      />
      <path strokeLinecap="round" strokeWidth="1.6" d="m8 12 2-2m4 0 2 2" />
    </svg>
  );
}

function IconListingAnalysis({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M14 3v6h6" />
      <circle cx="10.5" cy="14.5" r="2.25" strokeWidth="1.6" />
      <path strokeLinecap="round" strokeWidth="1.6" d="m12.2 16.2 2.3 2.3" />
    </svg>
  );
}

function IconEuRegistry({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        d="M5 14h11l1.5 3H6.5L5 14zm2.5-2 1.2-3.5h6.6L16.5 12"
      />
      <circle cx="18.5" cy="8.5" r="3.25" strokeWidth="1.5" />
      <path
        fill="currentColor"
        stroke="none"
        d="M18.5 6.1l.28.57.63.09-.45.44.11.63-.57-.3-.57.3.11-.63-.45-.44.63-.09zM17.1 8.9l.2.4.44.06-.31.3.08.44-.41-.22-.41.22.08-.44-.31-.3.44-.06zM19.9 8.9l.2.4.44.06-.31.3.08.44-.41-.22-.41.22.08-.44-.31-.3.44-.06z"
      />
    </svg>
  );
}

function IconInspectionTips({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M8.5 15.5h7" />
    </svg>
  );
}

function IconCarVertical() {
  return (
    <Image
      src="/brand/carvertical-logo.png"
      alt=""
      width={24}
      height={24}
      className={BRAND_LOGO_CLASS}
      aria-hidden
    />
  );
}

function IconAutoDna() {
  return (
    <Image
      src="/brand/autodna-logo.png"
      alt=""
      width={24}
      height={24}
      className={BRAND_LOGO_CLASS}
      aria-hidden
    />
  );
}

function IconDealerData({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M3 10h18v9H3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7 10V7.5A2.5 2.5 0 0 1 9.5 5h5A2.5 2.5 0 0 1 17 7.5V10" />
      <path strokeLinecap="round" strokeWidth="1.6" d="M9 14h6M12 14v3" />
    </svg>
  );
}

function IconInternational({ className = GLYPH_CLASS }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="8.25" strokeWidth="1.6" />
      <path strokeWidth="1.4" d="M3.75 12h16.5M12 3.75c2.2 2.6 3.35 5.45 3.35 8.25S14.2 17.65 12 20.25" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        d="M8.5 15.5h5.5l1-2h-4l1.2-2.8h4.3"
      />
    </svg>
  );
}

export function Tp5DesktopFeatureIconGlyph({
  icon,
  className = GLYPH_CLASS,
}: {
  icon: Tp5DesktopHeroFeatureIcon;
  className?: string;
}) {
  switch (icon) {
    case "consultation":
      return <IconHandshake className={className} />;
    case "listing-analysis":
      return <IconListingAnalysis className={className} />;
    case "eu-registry":
      return <IconEuRegistry className={className} />;
    case "inspection-tips":
      return <IconInspectionTips className={className} />;
    case "carvertical":
      return <IconCarVertical />;
    case "autodna":
      return <IconAutoDna />;
    case "dealer-data":
      return <IconDealerData className={className} />;
    case "international":
      return <IconInternational className={className} />;
    default:
      return null;
  }
}
