/** AZ.VIN wordmark — AZ. + VIN in Azerbaijan flag colors (blue / red / green). */

type Props = {
  className?: string;
  /** Slightly larger for header use. */
  size?: "header" | "inline";
};

const FLAG_BLUE = "#00B5E2";
const FLAG_RED = "#E30A17";
const FLAG_GREEN = "#3F9C35";

export function AzvinBrandMark({ className, size = "inline" }: Props) {
  const azClass =
    size === "header"
      ? "text-inherit"
      : "text-white";

  return (
    <span className={className} aria-label="AZ.VIN">
      <span className={azClass}>AZ.</span>
      <span style={{ color: FLAG_BLUE }}>V</span>
      <span style={{ color: FLAG_RED }}>I</span>
      <span style={{ color: FLAG_GREEN }}>N</span>
    </span>
  );
}
