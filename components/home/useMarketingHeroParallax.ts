"use client";

import { useEffect, useRef } from "react";

const LERP = 0.13;
const EPS = 0.06;

/**
 * Scroll-driven parallax for Hero depth layers (thread / glow / glass / text).
 * Settles when idle — no perpetual requestAnimationFrame.
 */
export function useMarketingHeroParallax() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const glassRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const smoothRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;

    const apply = (scrollY: number) => {
      const t = threadRef.current;
      const g = glowRef.current;
      const gl = glassRef.current;
      const tx = textRef.current;
      if (reducedMotionRef.current) {
        const y = 0;
        const tf = `translate3d(0,${y}px,0)`;
        if (t) t.style.transform = tf;
        if (g) g.style.transform = tf;
        if (gl) gl.style.transform = tf;
        if (tx) tx.style.transform = tf;
        return;
      }
      const s = scrollY;
      if (t) t.style.transform = `translate3d(0,${(-s * 0.02).toFixed(2)}px,0)`;
      if (g) g.style.transform = `translate3d(0,${(-s * 0.024).toFixed(2)}px,0)`;
      if (gl) gl.style.transform = `translate3d(0,${(-s * 0.048).toFixed(2)}px,0)`;
      if (tx) tx.style.transform = `translate3d(0,${(-s * 0.074).toFixed(2)}px,0)`;
    };

    const tick = () => {
      const target = targetRef.current;
      const prev = smoothRef.current;
      const next = prev + (target - prev) * LERP;
      smoothRef.current = Math.abs(target - next) < EPS ? target : next;
      apply(smoothRef.current);

      if (Math.abs(smoothRef.current - target) < EPS) {
        smoothRef.current = target;
        apply(target);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const kick = () => {
      targetRef.current = window.scrollY;
      if (reducedMotionRef.current) {
        smoothRef.current = targetRef.current;
        apply(smoothRef.current);
        return;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      targetRef.current = window.scrollY;
      if (reducedMotionRef.current) {
        smoothRef.current = targetRef.current;
        apply(smoothRef.current);
        return;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    targetRef.current = window.scrollY;
    smoothRef.current = targetRef.current;
    apply(smoothRef.current);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", kick, { passive: true });

    const onMq = () => {
      reducedMotionRef.current = mq.matches;
      kick();
    };
    mq.addEventListener("change", onMq);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", kick);
      mq.removeEventListener("change", onMq);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { sectionRef, threadRef, glowRef, glassRef, textRef };
}
