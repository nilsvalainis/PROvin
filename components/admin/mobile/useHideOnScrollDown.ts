"use client";

import { useEffect, useState } from "react";

/** Cik pikseļu jāparitina vienā virzienā, lai josla mainītos (pret trīcēšanu). */
const STEP_PX = 6;
/** Lapas augšā josla vienmēr redzama. */
const TOP_PX = 24;

/**
 * Telefona apakšējā josla, variants A (Nils 26.10): ritinot uz leju paslēpjas, uz augšu vai lapas galā parādās.
 * Tīra funkcija: atgriež jauno «paslēpta» stāvokli.
 */
export function nextDockHidden(
  hidden: boolean,
  s: { y: number; lastY: number; viewport: number; height: number },
): boolean {
  if (s.y <= TOP_PX) return false;
  if (s.y + s.viewport >= s.height - 4) return false;
  if (s.y > s.lastY + STEP_PX) return true;
  if (s.y < s.lastY - STEP_PX) return false;
  return hidden;
}

/**
 * Klausās dokumenta un lielu ritināmo konteineru (main, saraksti) ritināšanu. Mazi iekšējie ritinātāji
 * (čipu rindas, logi) netiek ņemti vērā. Pārejot uz citu lapu (`resetKey`), josla atkal redzama.
 */
export function useHideOnScrollDown(enabled: boolean, resetKey?: string): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const last = new WeakMap<object, number>();
    const onScroll = (e: Event) => {
      const t = e.target;
      let y: number;
      let viewport: number;
      let height: number;
      let key: object;
      if (t === document || t === document.documentElement || t === document.body) {
        y = window.scrollY;
        viewport = window.innerHeight;
        height = document.documentElement.scrollHeight;
        key = document;
      } else if (t instanceof HTMLElement) {
        if (t.clientHeight < window.innerHeight * 0.5) return;
        if (t.closest("[role=dialog], [data-admin-list-sheet]")) return;
        y = t.scrollTop;
        viewport = t.clientHeight;
        height = t.scrollHeight;
        key = t;
      } else {
        return;
      }
      const lastY = last.get(key) ?? y;
      last.set(key, y);
      setHidden((prev) => nextDockHidden(prev, { y, lastY, viewport, height }));
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled]);

  return hidden;
}
