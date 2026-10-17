import {
  BRAND_LOGO_ADMIN_LIST_MARK_H_PX,
  BRAND_LOGO_ADMIN_LIST_SLOT_W_PX,
} from "@/lib/brand-logo-display";
import { irissBrandFallbackLabel, irissBrandLogoSrc } from "@/lib/iriss-brand-logo";

const slotPx = {
  width: BRAND_LOGO_ADMIN_LIST_SLOT_W_PX,
  height: BRAND_LOGO_ADMIN_LIST_MARK_H_PX,
};

type Props = {
  brandModel: string;
  className?: string;
  fallbackClassName?: string;
  imgLoading?: "lazy" | "eager";
};

/** Fixed-width OEM mark column so IRISS list rows and headers share one title alignment. */
export function IrissBrandLogoSlot({ brandModel, className = "", fallbackClassName = "", imgLoading = "lazy" }: Props) {
  const src = irissBrandLogoSrc(brandModel);
  const shell = `inline-flex shrink-0 items-center justify-center ${className}`.trim();

  if (!src) {
    return (
      <span
        className={`${shell} text-[11px] font-bold text-slate-600 ${fallbackClassName}`.trim()}
        style={slotPx}
        aria-hidden
      >
        {irissBrandFallbackLabel(brandModel)}
      </span>
    );
  }

  return (
    <span className={shell} style={slotPx} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={BRAND_LOGO_ADMIN_LIST_SLOT_W_PX}
        height={BRAND_LOGO_ADMIN_LIST_MARK_H_PX}
        loading={imgLoading}
        decoding="async"
        className="max-h-full w-full object-contain"
      />
    </span>
  );
}
