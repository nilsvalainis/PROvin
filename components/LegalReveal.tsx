/**
 * Pakalpojuma sniedzēja rekvizīti paslēpti: neuzkrītoša poga «PROVIN», uzspiežot - rekvizītu rinda.
 * Rekvizīti nekur publiski nav redzami atklāti (Nila prasība 05.11.2026). Bez JS (`<details>`), der serverī un klientā.
 */
export function LegalReveal({
  line,
  tone = "dark",
  align = "left",
  className = "",
}: {
  /** Rekvizītu rinda; tukša - poga netiek rādīta. */
  line: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
  className?: string;
}) {
  if (!line.trim()) return null;
  const summary =
    tone === "dark"
      ? "text-white/25 hover:text-white/40 focus-visible:outline-white/20"
      : "text-black/25 hover:text-black/40 focus-visible:outline-black/20";
  const body = tone === "dark" ? "text-white/20" : "text-black/25";
  return (
    <details className={`group ${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <summary
        className={`inline-flex cursor-pointer list-none select-none text-[10px] font-medium tracking-[0.06em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${summary}`}
      >
        PROVIN
      </summary>
      <p className={`mt-1 text-[9px] leading-relaxed ${body}`}>{line}</p>
    </details>
  );
}

export function companyLegalLine(
  legal: { legalName: string; regNo: string; legalAddress: string; isComplete: boolean },
  regLabel = "Reģ. nr.",
): string {
  if (!legal.isComplete) return "";
  return `${legal.legalName}, ${regLabel} ${legal.regNo}, ${legal.legalAddress}`;
}
