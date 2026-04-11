"use client";

import { useEffect } from "react";

/**
 * Viegls parallax slānim `.tech-bg` (scrollY * 0.1).
 */
export function TechBgLightParallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onScroll = () => {
      const y = window.scrollY * 0.1;
      document.querySelectorAll(".tech-bg").forEach((el) => {
        (el as HTMLElement).style.transform = `translateY(${y}px)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
