"use client";

import type { ProvinAlertBanner } from "@/lib/provin-alert-banners";

const alertCircle = (
  <svg
    className="h-4 w-4 shrink-0 text-red-600"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const alertTriangle = (
  <svg
    className="h-4 w-4 shrink-0 text-amber-500"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M12 3 2 20h20L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 9v5M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function AdminProvinAlertBanners({ banners }: { banners: ProvinAlertBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" role="region" aria-label="Brīdinājumi">
      {banners.map((b, i) => {
        const isRed = b.severity === "red";
        const ico = isRed ? alertCircle : alertTriangle;
        const bar = isRed
          ? "border-l-red-600 bg-rose-50"
          : "border-l-amber-500 bg-amber-50";
        return (
          <div
            key={`${b.kind}-${i}`}
            role="alert"
            data-provin-alert={b.kind}
            data-provin-severity={b.severity}
            className={`flex items-center gap-2.5 rounded-r-md border-l-[5px] px-3 py-2 text-[11px] leading-snug text-slate-800 ${bar}`}
          >
            {ico}
            <p className="min-w-0 flex-1">{b.text}</p>
            {ico}
          </div>
        );
      })}
    </div>
  );
}
