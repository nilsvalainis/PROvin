"use client";

import { useLayoutEffect, useRef } from "react";

type Props = { edge: "left" | "right" };

/**
 * Straight horizontal spoke from column center to 20px from viewport edge, + at termination.
 */
export function BlueprintExplodedConnector({ edge }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const anchor = anchorRef.current;
    if (!root || !anchor) return;

    const measure = () => {
      if (window.innerWidth < 1024) {
        root.style.setProperty("--spoke-w", "0px");
        return;
      }
      const a = anchor.getBoundingClientRect();
      if (edge === "right") {
        const w = Math.max(0, window.innerWidth - 20 - a.left);
        root.style.setProperty("--spoke-w", `${w}px`);
      } else {
        const w = Math.max(0, a.left - 20);
        root.style.setProperty("--spoke-w", `${w}px`);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      mq.removeEventListener("change", measure);
    };
  }, [edge]);

  if (edge === "right") {
    return (
      <div ref={rootRef} className="relative mt-5 hidden h-5 w-full max-w-[min(100%,26rem)] lg:block lg:max-w-none">
        <div
          ref={anchorRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-1/2 h-[0.5px] -translate-y-1/2 bg-black/[0.05]"
          style={{ width: "var(--spoke-w, 0px)" }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-light leading-none text-[#050505]/35 select-none"
          style={{ left: "calc(50% + var(--spoke-w, 0px))" }}
          aria-hidden
        >
          +
        </span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative mt-5 hidden h-5 w-full max-w-[min(100%,26rem)] lg:block lg:max-w-none">
      <div
        ref={anchorRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      />
      <div
        className="absolute top-1/2 h-[0.5px] -translate-y-1/2 bg-black/[0.05]"
        style={{
          width: "var(--spoke-w, 0px)",
          left: "calc(50% - var(--spoke-w, 0px))",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-light leading-none text-[#050505]/35 select-none"
        style={{ left: "calc(50% - var(--spoke-w, 0px))" }}
        aria-hidden
      >
        +
      </span>
    </div>
  );
}
