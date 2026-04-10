"use client";

import { useTranslations } from "next-intl";
import { useCinematicHomeFrame } from "@/components/home/cinematic-home-context";

/**
 * Kreisā procesa sliede — tikai desktop; zils „punkts” seko scroll progresam.
 */
export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");
  const { docProgress, silver01 } = useCinematicHomeFrame();

  const phase = docProgress < 0.28 ? 0 : docProgress < 0.62 ? 1 : 2;
  const dotTopPct = 8 + docProgress * 72;
  const labelColor =
    silver01 > 0.55 ? "rgba(10,10,12,0.92)" : "rgba(232,234,238,0.92)";
  const muted = silver01 > 0.55 ? "rgba(10,10,12,0.45)" : "rgba(232,234,238,0.45)";

  return (
    <aside
      className="pointer-events-none fixed left-[max(0.5rem,env(safe-area-inset-left))] top-1/2 z-[35] hidden w-[4.75rem] -translate-y-1/2 lg:block"
      aria-hidden
    >
      <div className="relative h-[min(52vh,420px)] w-full">
        <div
          className="absolute left-[7px] top-[6%] h-[88%] w-[0.5px] bg-[#b8bcc4]/40"
          style={{ boxShadow: "0 0 6px rgba(59,130,246,0.12)" }}
        />
        <div
          className="absolute left-[4px] h-2 w-2 rounded-full bg-[#0061d2] shadow-[0_0_12px_rgba(0,97,210,0.85)] will-change-transform"
          style={{ top: `calc(${dotTopPct}% - 4px)` }}
        />
        <div className="absolute left-[18px] top-[4%] space-y-6 text-[10px] font-medium uppercase tracking-[0.14em]">
          <p style={{ color: phase === 0 ? labelColor : muted }}>
            <span className="tabular-nums">01</span> / {t("rail01")}
          </p>
          <p style={{ color: phase === 1 ? labelColor : muted }}>
            <span className="tabular-nums">02</span> / {t("rail02")}
          </p>
          <p style={{ color: phase === 2 ? labelColor : muted }}>
            <span className="tabular-nums">03</span> / {t("rail03")}
          </p>
        </div>
      </div>
    </aside>
  );
}
