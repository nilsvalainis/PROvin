type Props = {
  className?: string;
};

/**
 * Ļoti plāna līnija ar retu, lēnu gaismas impulsu — kā statusa / nolasīšanas indikators (ne rotācija).
 */
export function DiagnosticScanLine({ className }: Props) {
  return (
    <div
      className={["provin-diagnostic-scan-line", className].filter(Boolean).join(" ")}
      role="presentation"
      aria-hidden
    >
      <span className="provin-diagnostic-scan-line__track" />
      <span className="provin-diagnostic-scan-line__pulse" />
    </div>
  );
}
