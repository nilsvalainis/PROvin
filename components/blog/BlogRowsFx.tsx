"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Bloga rindas: virsraksts izgaismojas vārds pa vārdam, kadrs seko pelei 3D. */
export function BlogRowsFx({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.add("is-js");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".blog-row"));
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (!e.isIntersecting) continue;
                const t = e.target as HTMLElement;
                t.querySelectorAll<HTMLElement>(".blog-w").forEach((w, k) => (w.style.transitionDelay = `${k * 40}ms`));
                t.classList.add("is-in");
                io?.unobserve(t);
              }
            },
            { threshold: 0.2 },
          )
        : null;
    const cleanups: (() => void)[] = [];
    rows.forEach((row) => {
      if (io) io.observe(row);
      else row.classList.add("is-in");
      const cover = row.querySelector<HTMLElement>(".blog-row__cover");
      if (!cover || reduce) return;
      const move = (e: PointerEvent) => {
        const r = cover.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          cover.style.transform = "";
          return;
        }
        cover.style.transform = `rotateY(${(x - 0.5) * 7}deg) rotateX(${(0.5 - y) * 7}deg) scale(1.015)`;
      };
      const leave = () => (cover.style.transform = "");
      row.addEventListener("pointermove", move);
      row.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        row.removeEventListener("pointermove", move);
        row.removeEventListener("pointerleave", leave);
      });
    });
    return () => {
      io?.disconnect();
      cleanups.forEach((c) => c());
    };
  }, []);

  return (
    <div ref={ref} className="blog-rows">
      {children}
    </div>
  );
}
