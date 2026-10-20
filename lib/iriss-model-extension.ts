/**
 * Modeļa paplašinājums (S-line, M Sport, AMG Line).
 * `S line` = `S-line` = `Sline`.
 */

import { foldCriterion } from "@/lib/iriss-criteria-taxonomy";

export function foldModelExtension(raw: string): string {
  return foldCriterion(raw).replace(/[\s-]+/g, "");
}

export function splitModelExtensions(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;/\n]+/)) {
    const folded = foldModelExtension(part);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    out.push(part.trim());
  }
  return out;
}

export function titleHasModelExtension(hay: string, extension: string): boolean {
  const needle = foldModelExtension(extension);
  if (!needle) return true;
  const h = foldModelExtension(hay);
  if (!h) return true;
  return h.includes(needle);
}

export function titleHasAnyModelExtension(hay: string, extensions: readonly string[]): boolean {
  if (extensions.length === 0) return true;
  return extensions.some((item) => titleHasModelExtension(hay, item));
}
