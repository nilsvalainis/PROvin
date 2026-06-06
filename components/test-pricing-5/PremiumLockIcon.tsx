"use client";

import { motion } from "framer-motion";

type Props = {
  unlocked: boolean;
  unlocking?: boolean;
};

export function PremiumLockIcon({ unlocked, unlocking }: Props) {
  const open = unlocked || unlocking;

  return (
    <svg className="tp5-lock-svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <motion.path
        d={open ? "M8 11 V8.5 a4 4 0 0 1 8 0 V11" : "M8 11 V8 a4 4 0 0 1 8 0 V11"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        animate={{
          d: open ? "M8 11 V8.5 a4 4 0 0 1 8 0 V11" : "M8 11 V8 a4 4 0 0 1 8 0 V11",
        }}
        transition={{ type: "spring", stiffness: 520, damping: 28, mass: 0.55 }}
      />
      <circle cx="12" cy="15.5" r="1.15" fill="currentColor" />
    </svg>
  );
}
