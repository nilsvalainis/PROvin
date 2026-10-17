import Image from "next/image";
import {
  DZINTARZEME_AUTO_LOGO_HEIGHT_PX,
  DZINTARZEME_AUTO_LOGO_PUBLIC_PATH,
  DZINTARZEME_AUTO_LOGO_WIDTH_PX,
} from "@/lib/dzintarzeme-logo";

/** Vienīgais Dzintarzeme Auto zīmols (oriģinālais PNG, bez rediģēšanas). */
export const DZINTARZEME_OFFER_LOGO_PATH = DZINTARZEME_AUTO_LOGO_PUBLIC_PATH;
export const DZINTARZEME_OFFER_PUBLIC_LOGO_PATH = DZINTARZEME_AUTO_LOGO_PUBLIC_PATH;

export function DzintarzemeOfferBrandLogo({
  className = "h-auto w-[160px] max-w-[min(160px,42vw)] object-contain",
}: {
  className?: string;
}) {
  return (
    <Image
      src={DZINTARZEME_AUTO_LOGO_PUBLIC_PATH}
      alt="Dzintarzeme Auto"
      width={DZINTARZEME_AUTO_LOGO_WIDTH_PX}
      height={DZINTARZEME_AUTO_LOGO_HEIGHT_PX}
      className={className}
      priority
      unoptimized
    />
  );
}
