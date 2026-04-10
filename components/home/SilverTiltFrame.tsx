"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useFineHover } from "@/hooks/use-viewport-capabilities";

const SILVER_GRADIENT = "linear-gradient(45deg, #C0C0C0, #FFFFFF, #C0C0C0)";

type SilverTiltFrameProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * Investigation Lab-style silver gradient rāmis + viegls 3D tilt (tikai desktop / fine pointer).
 */
export function SilverTiltFrame({ children, className = "", innerClassName = "" }: SilverTiltFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFineHover();
  const reduceMotion = useReducedMotion();
  const tiltOn = fine && !reduceMotion;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 28 });
  const springY = useSpring(y, { stiffness: 280, damping: 28 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [5.5, -5.5]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-5.5, 5.5]);

  function onMove(e: React.MouseEvent) {
    if (!tiltOn || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={`rounded-2xl p-px will-change-transform ${className}`}
      style={
        tiltOn
          ? {
              background: SILVER_GRADIENT,
              rotateX,
              rotateY,
              transformStyle: "preserve-3d" as const,
            }
          : { background: SILVER_GRADIENT }
      }
      onMouseMove={tiltOn ? onMove : undefined}
      onMouseLeave={tiltOn ? onLeave : undefined}
    >
      <div
        className={`h-full min-h-0 rounded-2xl border border-white/[0.06] bg-zinc-950/45 backdrop-blur-md ${innerClassName}`}
      >
        {children}
      </div>
    </motion.div>
  );
}
