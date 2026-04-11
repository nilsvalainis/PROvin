/**
 * Faint blueprint grid on silver paper only — no junction clutter.
 */
const GRID_STYLE = {
  backgroundImage: [
    "repeating-linear-gradient(0deg, transparent 0, transparent calc(100px - 0.5px), rgba(255,255,255,0.03) calc(100px - 0.5px), rgba(255,255,255,0.03) 100px)",
    "repeating-linear-gradient(90deg, transparent 0, transparent calc(100px - 0.5px), rgba(255,255,255,0.03) calc(100px - 0.5px), rgba(255,255,255,0.03) 100px)",
  ].join(","),
} as const;

export function SilverBlueprintPaper() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={GRID_STYLE}
      aria-hidden
    />
  );
}
