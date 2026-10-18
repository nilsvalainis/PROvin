"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { applyMorphPill } from "@/lib/admin-motion";

type Props = {
  hostRef: RefObject<HTMLElement | null>;
  activeIndex: number;
  itemSelector?: string;
  height: number;
  top?: number;
  className?: string;
};

/**
 * Viena slīdoša kapsula esošā cilņu joslā. Mēra aktīvo vienumu un raksta tikai transform.
 */
export function AdminMotionPill({
  hostRef,
  activeIndex,
  itemSelector = ":scope > a, :scope > button",
  height,
  top = 0,
  className = "",
}: Props) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const placedRef = useRef(false);

  const apply = useCallback(() => {
    const host = hostRef.current;
    const pill = pillRef.current;
    if (!host || !pill) return;
    const items = host.querySelectorAll(itemSelector);
    const el = items.item(activeIndex) as HTMLElement | null;
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    applyMorphPill(pill, er.left - hr.left, er.width, height);
    if (!placedRef.current) {
      placedRef.current = true;
      pill.style.opacity = "1";
    }
  }, [activeIndex, height, hostRef, itemSelector]);

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => apply());
    ro.observe(host);
    return () => ro.disconnect();
  }, [apply, hostRef]);

  return (
    <span
      ref={pillRef}
      className={`admin-mp ${className}`.trim()}
      aria-hidden
      style={{ height, opacity: 0, top }}
    >
      <i className="l" />
      <i className="m" />
      <i className="r" />
    </span>
  );
}
