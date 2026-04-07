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

export function AdminProvinAlertBanners({ banners }: { banners: ProvinAlertBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="space-y-2" role="region" aria-label="Brīdinājumi">
      {banners.map((b) => (
        <div
          key={b.kind}
          role="alert"
          data-provin-alert={b.kind}
          className="flex items-center gap-2.5 rounded-r-md border-l-[5px] border-red-600 bg-rose-50 px-3 py-2 text-[11px] leading-snug text-slate-800"
        >
          {alertCircle}
          <p className="min-w-0 flex-1">{b.text}</p>
          {alertCircle}
        </div>
      ))}
    </div>
  );
}
