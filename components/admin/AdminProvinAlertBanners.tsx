"use client";

import type {
  ProvinAlertBanner,
  ProvinBannerKind,
  ProvinBannerPdfInclude,
  ProvinInfoBanner,
} from "@/lib/provin-alert-banners";
import { isProvinBannerIncludedInPdf } from "@/lib/provin-alert-banners";
import { AlertTriangle, Info } from "lucide-react";

export function AdminProvinAlertBanners({
  banners,
  infoBanners = [],
  pdfInclude = {},
  onPdfIncludeChange,
}: {
  banners: ProvinAlertBanner[];
  infoBanners?: ProvinInfoBanner[];
  pdfInclude?: ProvinBannerPdfInclude;
  onPdfIncludeChange?: (kind: ProvinBannerKind, included: boolean) => void;
}) {
  if (banners.length === 0 && infoBanners.length === 0) return null;

  const pdfToggle = (kind: ProvinBannerKind) => (
    <label
      className="inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[10px] font-medium text-[var(--color-provin-muted)] opacity-70 transition-opacity hover:opacity-100"
      title="Rādīt šo ierakstu PDF atskaitē"
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300/80 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]/25"
        checked={isProvinBannerIncludedInPdf(kind, pdfInclude)}
        disabled={!onPdfIncludeChange}
        onChange={(e) => onPdfIncludeChange?.(kind, e.target.checked)}
        aria-label={`Rādīt PDF: ${kind}`}
      />
      <span className="hidden sm:inline">Rādīt PDF</span>
    </label>
  );

  return (
    <div className="flex flex-col gap-2" role="region" aria-label="Brīdinājumi un informācija">
      {infoBanners.map((b, i) => (
        <div
          key={`info-${b.kind}-${i}`}
          role="note"
          data-provin-info={b.kind}
          className="flex items-center gap-3 rounded-lg border-l-2 border-[#8e8e93] bg-[#8e8e93]/[0.08] px-3 py-1.5 text-[11px] leading-snug text-[#3a3a3c] shadow-[0_2px_16px_rgba(15,23,42,0.04)]"
        >
          <Info className="h-4 w-4 shrink-0 text-[#8e8e93]" aria-hidden strokeWidth={1.5} />
          <p className="min-w-0 flex-1 font-normal">{b.text}</p>
          {pdfToggle(b.kind)}
        </div>
      ))}
      {banners.map((b, i) => {
        const isRed = b.severity === "red";
        const bar = isRed ? "border-l-[#FF4D4D] bg-[#FF4D4D]/[0.04]" : "border-l-[#FFC107] bg-[#FFC107]/[0.04]";
        const icoColor = isRed ? "text-[#FF4D4D]" : "text-[#FFC107]";
        return (
          <div
            key={`${b.kind}-${i}`}
            role="alert"
            data-provin-alert={b.kind}
            data-provin-severity={b.severity}
            className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-1.5 text-[11px] leading-snug text-[#1d1d1f] shadow-[0_2px_16px_rgba(15,23,42,0.06)] ${bar}`}
          >
            <AlertTriangle className={`h-4 w-4 shrink-0 ${icoColor} [stroke-width:1.5]`} aria-hidden strokeWidth={1.5} />
            <p className="min-w-0 flex-1 font-normal">{b.text}</p>
            {pdfToggle(b.kind)}
          </div>
        );
      })}
    </div>
  );
}
