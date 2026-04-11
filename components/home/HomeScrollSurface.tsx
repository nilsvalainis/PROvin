"use client";

import { type ReactNode, useEffect } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";
import { ORDER_SECTION_ID } from "@/lib/order-section";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/** ease-in-out — garāka „titanium” līkne bez krasām robežām */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Pilna lapa — dziļš #050505 + „brushed titanium” sudrabs; `--home-surface-t` sākas pie pasūtījuma bloka un aug līdz lapas beigām.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  useEffect(() => {
    const root = document.documentElement;

    let raf = 0;
    const updateT = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const vh = window.innerHeight || 1;
        const docMax = Math.max(document.documentElement.scrollHeight - vh, 1);

        const anchor =
          document.getElementById(ORDER_SECTION_ID) ?? document.getElementById("order-form");
        let start: number;
        if (anchor) {
          const top = anchor.getBoundingClientRect().top + y;
          start = Math.max(0, top - vh * 0.04);
        } else {
          start = vh * 0.2;
        }

        const span = Math.max(docMax - start, vh * 1.65);
        const raw = (y - start) / span;
        const clamped = Math.min(1, Math.max(0, raw));
        const t = easeInOutCubic(clamped);
        root.style.setProperty("--home-surface-t", t.toFixed(4));
      });
    };

    updateT();
    window.addEventListener("scroll", updateT, { passive: true });
    document.addEventListener("scroll", updateT, { passive: true, capture: true });
    window.addEventListener("resize", updateT);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateT);
      document.removeEventListener("scroll", updateT, true);
      window.removeEventListener("resize", updateT);
      root.style.removeProperty("--home-surface-t");
    };
  }, []);

  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      {/* Tumšāks „titanium” sudrabs (~#a0a0a0 virsotne), izplūdis bloom + daudzslāņu pāreja */}
      <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden" aria-hidden>
        <div
          className="absolute left-1/2 top-[38%] h-[min(175vw,2200px)] w-[min(175vw,2200px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.88]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(160,160,164,0.14) 0%, rgba(118,120,126,0.075) 24%, rgba(72,74,80,0.2) 50%, rgba(26,28,32,0.78) 74%, rgba(6,6,8,0.97) 100%)",
            filter: "blur(88px)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(circle at 50% 42%, rgba(148,148,152,0.055) 0%, rgba(100,102,108,0.028) 22%, transparent 52%)",
              "radial-gradient(ellipse 105% 58% at 50% 0%, rgba(130,132,138,0.05) 0%, transparent 48%)",
              "radial-gradient(ellipse 95% 70% at 50% 100%, rgba(55,58,64,0.12) 0%, transparent 54%)",
              "linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0.28) 48%, rgba(5,5,5,0.72) 80%, #050505 100%)",
            ].join(", "),
          }}
        />
      </div>

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
