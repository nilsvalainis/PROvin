type Props = {
  className?: string;
  /** Diskrētāks tracks + pulse — saskaņots ar kreisās malas navigācijas līniju. */
  variant?: "default" | "rail";
  /**
   * `along` — impulss pa visu līniju (kreisā mala → labā).
   * `from-center-left` / `from-center-right` — no līnijas centra (pie virsraksta) uz attiecīgo malu.
   * `split` — divi impulsi sākumā kopā centrā, tad šķiras uz malām.
   * `none` — tikai līnija (bez skrejošā impulsa).
   */
  /**
   * `alongContinuous` — divi nobīdīti impulsi (fāze 50 %), lai zilais vienmēr būtu redzams un cikls bez „lēciena”.
   */
  motion?: "along" | "alongContinuous" | "from-center-left" | "from-center-right" | "split" | "none";
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
  const continuous = motion === "alongContinuous";
  const rootClass = [
    "provin-diagnostic-scan-line",
    rail && "provin-diagnostic-scan-line--rail",
    continuous && "provin-diagnostic-scan-line--continuous",
    className,
  ]
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

  if (motion === "none") {
    return (
      <div className={rootClass} role="presentation" aria-hidden>
        <span className="provin-diagnostic-scan-line__track" />
      </div>
    );
  }

  return (
    <div className={rootClass} role="presentation" aria-hidden>
      <span className="provin-diagnostic-scan-line__track" />
      {motion === "split" ? (
        <>
          <span className={pulseClass("provin-diagnostic-scan-line__pulse--split-left")} />
          <span className={pulseClass("provin-diagnostic-scan-line__pulse--split-right")} />
        </>
      ) : motion === "alongContinuous" ? (
        <>
          <span className={pulseClass()} />
          <span className={pulseClass("provin-diagnostic-scan-line__pulse--phase-b")} />
        </>
      ) : (
        <span className={pulseClass(outwardExtra)} />
      )}
    </div>
  );
}
