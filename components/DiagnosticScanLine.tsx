type Props = {
  className?: string;
  /** Diskrētāks tracks + pulse — saskaņots ar kreisās malas navigācijas līniju. */
  variant?: "default" | "rail";
};

/**
 * Ļoti plāna līnija ar retu, lēnu gaismas impulsu — kā statusa / nolasīšanas indikators (ne rotācija).
 */
export function DiagnosticScanLine({ className, variant = "default" }: Props) {
  const rail = variant === "rail";
  return (
    <div
      className={["provin-diagnostic-scan-line", rail && "provin-diagnostic-scan-line--rail", className]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
      aria-hidden
    >
      <span className="provin-diagnostic-scan-line__track" />
      <span className="provin-diagnostic-scan-line__pulse" />
    </div>
  );
}
