/**
 * Liels VIN šoferim (Nils 18.11): pie izsoles vārtiem ātri pārbaudīt īsto auto.
 * Pēdējās 6 zīmes izceltas - tās parasti salīdzina ar uzlīmi / dokumentu.
 */
export function splitVinTail(vin: string): { head: string; tail: string } {
  const v = vin.trim().toUpperCase();
  if (v.length <= 6) return { head: "", tail: v };
  return { head: v.slice(0, -6), tail: v.slice(-6) };
}

export function BigVin({ vin, className }: { vin: string; className?: string }) {
  const { head, tail } = splitVinTail(vin);
  if (!tail) return null;
  return (
    <p className={className} data-vin={head + tail} aria-label={`VIN ${head}${tail}`}>
      {head ? <span className="vin-head">{head}</span> : null}
      <span className="vin-tail">{tail}</span>
    </p>
  );
}
