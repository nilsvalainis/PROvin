import type { ReactNode } from "react";

/** IRISS sadaļas virsraksts: gaiši zilpelēka josla, bez kreisās akcenta līnijas. */
export function IrissSectionHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`iriss-section-heading ${className}`.trim()}>{children}</h2>;
}
