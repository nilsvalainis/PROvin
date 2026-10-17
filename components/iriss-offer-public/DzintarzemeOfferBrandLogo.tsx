import Image from "next/image";

/** PDF / tumšs fons: `public/brands/dzintarzeme-iriss-offer-pdf-logo.png` */
export const DZINTARZEME_OFFER_LOGO_PATH = "/brands/dzintarzeme-iriss-offer-pdf-logo.png";
/** Publiskā /p/ lapa (gaišs fons): SVG, tumšs teksts + oranžs zīmols */
export const DZINTARZEME_OFFER_PUBLIC_LOGO_PATH = "/brands/dzintarzeme-iriss-offer-light.svg";

export function DzintarzemeOfferBrandLogo({ className = "h-auto w-[160px] max-w-[min(160px,42vw)] object-contain pt-1" }: { className?: string }) {
  return (
    <Image
      src={DZINTARZEME_OFFER_PUBLIC_LOGO_PATH}
      alt="Dzintarzeme Auto"
      width={320}
      height={150}
      className={className}
      priority
      unoptimized
    />
  );
}
