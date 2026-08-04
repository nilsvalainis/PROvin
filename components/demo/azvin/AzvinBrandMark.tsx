/** AZ.VIN wordmark — white + PROVIN accent blue (same as PROVIN.VIN). */

type Props = {
  className?: string;
  /** Slightly larger for header use. */
  size?: "header" | "inline";
};

export function AzvinBrandMark({ className, size = "inline" }: Props) {
  const azClass = size === "header" ? "text-inherit" : "text-white";

  return (
    <span className={className} aria-label="AZ.VIN">
      <span className={azClass}>AZ.</span>
      <span className="text-provin-accent">VIN</span>
    </span>
  );
}
