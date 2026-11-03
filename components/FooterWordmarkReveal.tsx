"use client";

import { useEffect, useRef } from "react";

/** Kājenes apakšā nogriezta PROVIN vārdzīme, kas ritinot lēni paceļas (M2). */
export function FooterWordmarkReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      el?.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="provin-footer-wordmark" aria-hidden>
      <span>
        PRO<b>VIN</b>
      </span>
    </div>
  );
}
