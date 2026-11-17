/**
 * Bloga ierakstu tipogrāfiskie melnbaltie kadri (03.11, Nils: nevis video thumbnails).
 * Lielais teksts un apakšvirsraksts pēc ieraksta slug; jaunam ierakstam pievieno rindu šeit.
 */
const COVERS: Record<string, { big: string; small: string }> = {
  "ka-pirkt-lietotu-auto-bez-tabu": { big: "BEZ TABU", small: "7 padomi" },
  "krapsanas-shemas-mobile-de-48000": { big: "48 000 €", small: "mobile.de" },
};

export function blogTypeCover(slug: string, title: string): { big: string; small: string } {
  const c = COVERS[slug];
  if (c) return c;
  const words = title.split(/\s+/).filter(Boolean);
  return { big: words.slice(0, 2).join(" "), small: "" };
}
