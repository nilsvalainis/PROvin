/** IRISS projekta indikators: 6 px punkts + vārds, --acc. Tikai joslā / sānjoslā. */
export function IrissProjectIndicator({ className = "" }: { className?: string }) {
  return (
    <span className={`iriss-proj ${className}`.trim()} title="IRISS">
      IRISS
    </span>
  );
}
