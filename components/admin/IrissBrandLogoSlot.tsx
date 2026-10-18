import {
  BRAND_LOGO_ADMIN_LIST_SLOT_H_PX,
  BRAND_LOGO_ADMIN_LIST_SLOT_W_PX,
  BRAND_LOGO_ADMIN_ROUND_SCALE,
  BRAND_LOGO_ADMIN_ROUND_VISIBLE_H_PX,
  BRAND_LOGO_ADMIN_WIDE_VISIBLE_W_PX,
} from "@/lib/brand-logo-display";
import { irissBrandFallbackLabel, irissBrandLogoSrc, irissBrandLogoUsesWideLayout } from "@/lib/iriss-brand-logo";

const slotPx = {
  width: BRAND_LOGO_ADMIN_LIST_SLOT_W_PX,
  height: BRAND_LOGO_ADMIN_LIST_SLOT_H_PX,
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
  const wide = irissBrandLogoUsesWideLayout(brandModel);
  const shell = `inline-flex shrink-0 items-center justify-center overflow-visible ${className}`.trim();
  const brandLogoAttr = { "data-admin-brand-logo": "1" } as const;

  if (!src) {
    return (
      <span
        className={`${shell} text-[11px] font-bold text-slate-600 ${fallbackClassName}`.trim()}
        style={slotPx}
        aria-hidden
        {...brandLogoAttr}
      >
        {irissBrandFallbackLabel(brandModel)}
      </span>
    );
  }

  return (
    <span className={shell} style={slotPx} aria-hidden {...brandLogoAttr}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={wide ? BRAND_LOGO_ADMIN_WIDE_VISIBLE_W_PX : BRAND_LOGO_ADMIN_ROUND_VISIBLE_H_PX}
        height={BRAND_LOGO_ADMIN_LIST_SLOT_H_PX}
        loading={imgLoading}
        decoding="async"
        className="max-h-full object-contain"
        style={
          wide
            ? { width: BRAND_LOGO_ADMIN_WIDE_VISIBLE_W_PX, maxWidth: "100%" }
            : {
                height: BRAND_LOGO_ADMIN_ROUND_VISIBLE_H_PX,
                width: BRAND_LOGO_ADMIN_ROUND_VISIBLE_H_PX,
                transform: `scale(${BRAND_LOGO_ADMIN_ROUND_SCALE})`,
                transformOrigin: "center",
              }
        }
      />
    </span>
  );
}
