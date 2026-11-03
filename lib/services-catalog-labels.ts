/** Cena no CTA teksta („… 99,99 €” / „… €99.99”), lai tā vienmēr sakristu ar pogu. */
export function packagePriceLabel(buttonText: string): string | null {
  const m = buttonText.match(/€\s?\d+[.,]\d{2}|\d+[.,]\d{2}\s?€/);
  return m ? m[0] : null;
}

/** Īsais nosaukums segmentiem: „PROVIN AUDITS” -> „AUDITS”. */
export function packageShortLabel(title: string): string {
  return title.replace(/^PROVIN\s+/i, "");
}
