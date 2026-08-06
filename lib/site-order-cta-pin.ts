import { normalizeSitePath } from "@/lib/site-rail-sections";

/**
 * Globālais „Pasūtīt” pin — slēpts tur, kur jau ir sliede / headera izvēlne
 * (sākums, pasūtīt, pakalpojumi, BUJ) un demo / SELECT pieteikuma plūsmās.
 */
export function shouldHideSiteOrderCtaPin(pathname: string): boolean {
  const p = normalizeSitePath(pathname);
  return (
    p === "/" ||
    p === "" ||
    p === "/pasutit" ||
    p === "/pakalpojumi" ||
    p === "/blogs" ||
    p === "/biezi-jautajumi" ||
    p === "/provin-select-pieteikums" ||
    p.startsWith("/demo/")
  );
}
