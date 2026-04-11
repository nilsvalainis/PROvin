"use client";

/**
 * Tehniskais režģis + HUD etiķetes — absolūti zem hero virsraksta (MarketingHero).
 */
export function MarketingHeroHudBackdrop() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 scale-[1.3]"
      aria-hidden
      style={{
        width: "min(108%, 48rem)",
        height: "clamp(8rem, 30vw, 15rem)",
      }}
    >
      <div className="tech-bg absolute inset-0" />
      <div className="data-label" style={{ top: "10%", left: "6%" }}>
        VIN_SCAN
      </div>
      <div className="data-label" style={{ top: "72%", left: "78%" }}>
        ECU_DATA
      </div>
      <div className="data-label" style={{ top: "38%", left: "48%" }}>
        MILEAGE_LOG
      </div>
      <div className="data-label" style={{ top: "82%", left: "12%" }}>
        REG_CHECK
      </div>
    </div>
  );
}
