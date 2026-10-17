import Image from "next/image";

/** Kopīgs ar PDF un admin: `public/brands/dzintarzeme-iriss-offer-pdf-logo.png` (JPEG saturs). */
export const DZINTARZEME_OFFER_LOGO_PATH = "/brands/dzintarzeme-iriss-offer-pdf-logo.png";

export function DzintarzemeOfferBrandLogo({ className = "h-auto w-[160px] max-w-[min(160px,42vw)] object-contain" }: { className?: string }) {
  return (
    <Image
      src={DZINTARZEME_OFFER_LOGO_PATH}
      alt="Dzintarzeme Auto"
      width={1024}
      height={612}
      className={className}
      priority
      unoptimized
    />
  );
}
