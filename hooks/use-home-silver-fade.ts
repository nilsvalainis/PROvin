"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { computeHomeSilverFadeProgress } from "@/lib/home-surface";

/** Raw silver fade 0…1 from scroll (20vh → 120vh). Off-home routes always 0. */
export function useHomeSilverFadeProgress(): number {
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "";
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!isHome) {
      setP(0);
      return;
    }
    const tick = () => setP(computeHomeSilverFadeProgress());
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [isHome]);

  return isHome ? p : 0;
}
