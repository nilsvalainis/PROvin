"use client";

import { MarketingHeroSpeedometer } from "@/components/home/MarketingHeroSpeedometer";

/**
 * Tehniskais režģis + HUD + spidometrs — tieši zem / aiz hero galvenā virsraksta.
 */
export function MarketingHeroHudBackdrop() {
  return (
    <div
      className="marketing-hero-hud pointer-events-none absolute left-1/2 top-[50%] z-0 -translate-x-1/2 -translate-y-1/2 scale-[1.28]"
      aria-hidden
      style={{
        width: "min(100%, 46rem)",
        height: "clamp(12.5rem, 42vw, 21rem)",
      }}
    >
      <div className="tech-bg absolute inset-0" />
      <MarketingHeroSpeedometer />
      <div className="data-label" style={{ top: "8%", left: "4%" }}>
        VIN_SCAN
      </div>
      <div className="data-label" style={{ top: "68%", left: "82%" }}>
        ECU_DATA
      </div>
      <div className="data-label" style={{ top: "34%", left: "50%", transform: "translateX(-50%)" }}>
        MILEAGE_LOG
      </div>
      <div className="data-label" style={{ top: "78%", left: "8%" }}>
        REG_CHECK
      </div>
    </div>
  );
}
