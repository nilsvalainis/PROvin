import type { HTMLAttributes } from "react";

import { pdfCountryCodeLetters, pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";

export type CountryFlagWithCodeProps = {
  countryLabel: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Karoga emocijzīme + ISO alpha-2 (PDF un admin tabulām — vienota kartēšana).
 */
export function CountryFlagWithCode({
  countryLabel,
  className,
  title,
  ...rest
}: CountryFlagWithCodeProps) {
  const flag = pdfCountryFlagEmoji(countryLabel);
  const code = pdfCountryCodeLetters(countryLabel);
  const label = countryLabel.trim() || "—";
  const base =
    "inline-flex items-center justify-end gap-2 text-[11px] font-medium text-[var(--color-provin-muted)]";
  return (
    <span {...rest} className={className ? `${base} ${className}` : base} title={title ?? label}>
      <span className="select-none text-[1.2075em] leading-none" aria-hidden>
        {flag}
      </span>
      <span className="uppercase tracking-wide">{code}</span>
    </span>
  );
}
