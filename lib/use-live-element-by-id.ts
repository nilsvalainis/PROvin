"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Vai portāla mērķis jānomaina: nav atrasts, atvienots no lapas (React to izveidoja no jauna) vai ar šo id tagad ir cits mezgls.
 * Tīra funkcija, lai uzvedību var pārbaudīt bez pārlūka.
 */
export function nextLiveElement<T extends { isConnected: boolean }>(current: T | null, lookup: () => T | null): T | null {
  const found = lookup();
  if (found && found.isConnected) return found;
  if (current && current.isConnected) return current;
  return null;
}

/**
 * Elements pēc id, kas seko līdzi lapai (17.11): ja vecāks mērķa <div> izveido no jauna (cilnes maiņa, telefona
 * izkārtojums, sakļauts bloks), atgriež jauno mezglu. Agrāk mērķi meklēja vienreiz - portāla saturs palika atvienotā
 * mezglā un "Pielikumi" parādījās tikai pēc lapas pārlādes.
 */
export function useLiveElementById(id: string | undefined, resetKey?: unknown): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!id || typeof document === "undefined") {
      setEl(null);
      return;
    }
    const sync = () => setEl((cur) => nextLiveElement(cur, () => document.getElementById(id)));
    sync();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id, resetKey]);
  return el;
}
