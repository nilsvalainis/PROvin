"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { computeHomeSurfaceT } from "@/lib/home-surface";

/** Home route only: mirrors `--home-surface-t` for React (e.g. header). */
export function useHomeSurfaceT(): number {
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "";
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!isHome) {
      setT(0);
      return;
    }
    const tick = () => setT(computeHomeSurfaceT());
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [isHome]);

  return isHome ? t : 0;
}
