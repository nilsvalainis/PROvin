/**
 * ASV cilnes AutoDNA USA PDF: tas pats Datu serv. AutoDNA augšupielādes
 * kanāls (`autodna` + Blob), bet ASV laukus šis ceļš nedrīkst pārrakstīt.
 */

export const ASV_AUTODNA_USA_PDF_TARGET = "autodna" as const;

export const ASV_AUTODNA_USA_PDF_LABELS = {
  section: "AutoDNA USA PDF",
  title: "Augšupielādēt AutoDNA USA PDF atskaiti",
  hint: "Nav obligāti. Velc PDF šeit vai klikšķini. Tabulas aizpildās tikai pēc pogas Ievietot. ASV laukus neaiztiek.",
  apply: "Ievietot AutoDNA tabulās",
  open: "Atvērt",
  collapse: "Sakļaut",
} as const;

/** Copilot ielāde no ASV cilnes nedrīkst aiztikt `asv` bloku. */
export function excludeAsvFromCopilotPatch<T extends Record<string, unknown>>(
  patched: T,
  changedKeys: readonly string[],
): { patched: Omit<T, "asv">; changedKeys: string[] } {
  const { asv: _drop, ...rest } = patched;
  return {
    patched: rest as Omit<T, "asv">,
    changedKeys: changedKeys.filter((key) => key !== "asv"),
  };
}
