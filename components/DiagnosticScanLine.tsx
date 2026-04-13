type Props = {
  className?: string;
  /** Diskrētāks tracks + pulse — saskaņots ar kreisās malas navigācijas līniju. */
  variant?: "default" | "rail";
  /**
   * `along` — impulss pa visu līniju (kreisā mala → labā).
   * `from-center-left` / `from-center-right` — no līnijas centra (pie virsraksta) uz attiecīgo malu.
   * `split` — divi impulsi sākumā kopā centrā, tad šķiras uz malām.
   */
  motion?: "along" | "from-center-left" | "from-center-right" | "split";
};

/**
 * Ļoti plāna līnija ar retu, lēnu gaismas impulsu — kā statusa / nolasīšanas indikators (ne rotācija).
 */
export function DiagnosticScanLine({
  className,
  variant = "default",
  motion = "along",
}: Props) {
  const rail = variant === "rail";
  const rootClass = ["provin-diagnostic-scan-line", rail && "provin-diagnostic-scan-line--rail", className]
    .filter(Boolean)
    .join(" ");

  const pulseClass = (...extras: string[]) =>
    ["provin-diagnostic-scan-line__pulse", ...extras.filter(Boolean)].join(" ");

  const outwardExtra =
    motion === "from-center-left"
      ? "provin-diagnostic-scan-line__pulse--out-left"
      : motion === "from-center-right"
        ? "provin-diagnostic-scan-line__pulse--out-right"
        : "";

  return (
    <div className={rootClass} role="presentation" aria-hidden>
      <span className="provin-diagnostic-scan-line__track" />
      {motion === "split" ? (
        <>
          <span className={pulseClass("provin-diagnostic-scan-line__pulse--split-left")} />
          <span className={pulseClass("provin-diagnostic-scan-line__pulse--split-right")} />
        </>
      ) : (
        <span className={pulseClass(outwardExtra)} />
      )}
    </div>
  );
}
