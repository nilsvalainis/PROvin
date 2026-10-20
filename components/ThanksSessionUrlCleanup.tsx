"use client";

import { useLayoutEffect } from "react";
import { applyThanksSessionUrlCleanup } from "@/lib/thanks-session";

/** Otrais slānis pēc layout inline skripta: replaceState pirms useEffect pikseļiem. */
export function ThanksSessionUrlCleanup() {
  useLayoutEffect(() => {
    applyThanksSessionUrlCleanup(window.location.href);
  }, []);
  return null;
}
