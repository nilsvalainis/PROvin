"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useFineHover } from "@/hooks/use-viewport-capabilities";
import { useCallback, useRef, type ReactNode } from "react";

type MagneticSpringProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
};

/**
 * Magnētiskā „masa” — useSpring (stiffness 200, damping 25).
 */
export function MagneticSpring({ children, className = "", strength = 0.22 }: MagneticSpringProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFineHover();
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 200, damping: 25 });
  const y = useSpring(0, { stiffness: 200, damping: 25 });

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (!fine || reduce || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const tx = (e.clientX - cx) * strength;
      const ty = (e.clientY - cy) * strength;
      x.set(tx);
      y.set(ty);
    },
    [fine, reduce, strength, x, y],
  );

  const onLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      style={{ x, y, willChange: fine && !reduce ? "transform" : undefined }}
      onMouseMove={fine && !reduce ? onMove : undefined}
      onMouseLeave={fine && !reduce ? onLeave : undefined}
      className={`transform-gpu ${className}`}
    >
      {children}
    </motion.div>
  );
}
