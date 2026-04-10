"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Viegla ienākšana — premium sajūtas pamats (lightweight.info iedvesma, bez smagiem efektiem). */
export function HomePageMotionShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="relative min-w-0"
      initial={{ opacity: 0.96 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
