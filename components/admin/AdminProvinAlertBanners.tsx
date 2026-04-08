"use client";

import type { ProvinAlertBanner } from "@/lib/provin-alert-banners";
import { AlertTriangle } from "lucide-react";

export function AdminProvinAlertBanners({ banners }: { banners: ProvinAlertBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" role="region" aria-label="Brīdinājumi">
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
          </div>
        );
      })}
    </div>
  );
}
