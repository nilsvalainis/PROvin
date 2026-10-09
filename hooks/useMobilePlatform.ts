"use client";

import { useEffect, useState } from "react";
import { detectMobilePlatform, type IrissMobilePlatform } from "@/lib/iriss-listings-mobile-platform";

/** Pēc mount (nav hidratācijas nesakritības): ios / android / null. */
export function useMobilePlatform(): IrissMobilePlatform | null {
  const [platform, setPlatform] = useState<IrissMobilePlatform | null>(null);
  useEffect(() => {
    setPlatform(detectMobilePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
  }, []);
  return platform;
}
