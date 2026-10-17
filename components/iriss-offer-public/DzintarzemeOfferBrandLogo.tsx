import Image from "next/image";

/** Kopīgs ar PDF un admin: `public/brands/dzintarzeme-iriss-offer-pdf-logo.png` (JPEG saturs). */
export const DZINTARZEME_OFFER_LOGO_PATH = "/brands/dzintarzeme-iriss-offer-pdf-logo.png";

export function DzintarzemeOfferBrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Image
      src={DZINTARZEME_OFFER_LOGO_PATH}
      alt="Dzintarzeme Auto"
      width={160}
      height={40}
      className={className}
      priority
      unoptimized
    />
  );
}
