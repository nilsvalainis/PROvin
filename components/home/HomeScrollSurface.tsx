"use client";

import { type ReactNode, useEffect } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Pilna lapa — dziļš sudraba/tumšs fons ar plūstošu radiālo slāni; `--home-surface-t` 0→1 lineāri ritināšanā.
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
        const start = vh * 0.22;
        const span = vh * 1.05;
        const raw = (y - start) / span;
        const t = Math.min(1, Math.max(0, raw));
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

      {/* Plūstošs metāla tonis — vairāki radiālie slāņi + izplūšana, bez cietas „ovāla” kontūras */}
      <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden" aria-hidden>
        <div
          className="absolute left-1/2 top-[36%] h-[min(165vw,2000px)] w-[min(165vw,2000px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.92]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(236,238,242,0.16) 0%, rgba(200,204,212,0.09) 22%, rgba(100,104,116,0.22) 48%, rgba(28,30,36,0.72) 72%, rgba(8,8,10,0.96) 100%)",
            filter: "blur(72px)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.028) 20%, rgba(255,255,255,0.01) 38%, transparent 58%)",
              "radial-gradient(ellipse 100% 55% at 50% 0%, rgba(210,214,222,0.06) 0%, transparent 50%)",
              "radial-gradient(ellipse 90% 65% at 50% 100%, rgba(70,74,84,0.14) 0%, transparent 52%)",
              "linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0.35) 52%, rgba(5,5,5,0.78) 82%, #050505 100%)",
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
