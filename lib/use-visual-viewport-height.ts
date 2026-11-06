"use client";

import { useEffect, useState } from "react";

/**
 * Redzamā loga augstums (px). iOS/Android ar atvērtu tastatūru `100dvh` nesamazinās,
 * bet `visualViewport.height` samazinās - modāļa pogas paliek sasniedzamas.
 * `null`, ja pārlūks to neatbalsta (tad lieto CSS `dvh`).
 */
export function useVisualViewportHeight(active = true): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setH(Math.round(vv.height));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return h;
}
