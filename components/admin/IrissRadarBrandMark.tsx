import { irissBrandFallbackLabel, irissBrandLogoSrcForSlug, irissBrandMarksForTitle } from "@/lib/iriss-brand-logo";

type Props = {
  brandModel: string;
};

/** 40x40 OEM mark for Radars list rows. Dual slugs (Lexus / Toyota) share the square. */
export function IrissRadarBrandMark({ brandModel }: Props) {
  const slugs = irissBrandMarksForTitle(brandModel);
  const srcs = slugs.map((slug) => irissBrandLogoSrcForSlug(slug)).filter((src): src is string => Boolean(src));
  const known = srcs.length > 0;
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] ${
        known ? "bg-white" : "bg-[var(--fill)]"
      }`}
      aria-hidden
      data-admin-brand-logo="1"
    >
      {known ? (
        <span className={`flex items-center ${srcs.length > 1 ? "gap-0.5" : ""}`}>
          {srcs.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              width={srcs.length > 1 ? 18 : 32}
              height={srcs.length > 1 ? 18 : 32}
              loading="lazy"
              decoding="async"
              className={srcs.length > 1 ? "h-[18px] w-[18px] object-contain" : "h-8 w-8 object-contain"}
            />
          ))}
        </span>
      ) : (
        <span className="text-[11px] font-bold text-[var(--ink2)]">{irissBrandFallbackLabel(brandModel)}</span>
      )}
    </span>
  );
}
