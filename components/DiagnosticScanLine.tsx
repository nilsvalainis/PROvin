type Props = {
  className?: string;
  /** Diskrētāks tracks + pulse — saskaņots ar kreisās malas navigācijas līniju. */
  variant?: "default" | "rail";
  /**
   * `along` — ping-pong (kreisā→labā→kreisā) — skat. `globals.css` bāzes impulsam.
   * `alongPingPong` — tā pati kustība kā `along` (saderība ar agrāko API).
   * `from-center-left` / `from-center-right` — no centra uz malu un atpakaļ (ping-pong).
   * `split` — divi impulsi: centrā → malas → centrā (ping-pong).
   * `sweepLtr` — viens cikls kreisā→labā, atkārtojas (pasūtījuma laukiem).
   * `none` — tikai līnija (bez skrejošā impulsa).
   */
  motion?: "along" | "alongPingPong" | "from-center-left" | "from-center-right" | "split" | "sweepLtr" | "none";
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
      ) : motion === "sweepLtr" ? (
        <span className={pulseClass("provin-diagnostic-scan-line__pulse--sweep-ltr")} />
      ) : (
        <span
          className={pulseClass(
            motion === "alongPingPong" ? "provin-diagnostic-scan-line__pulse--ping-pong" : outwardExtra,
          )}
        />
      )}
    </div>
  );
}
