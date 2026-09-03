"use client";

import { useCallback, useRef } from "react";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

const TIER_ORDER: TestPricingPlanId[] = ["mini", "plus", "premium"];
const SWIPE_THRESHOLD_PX = 48;

export function useTierSwipe<T extends string>(
  selectedId: T,
  setSelectedId: (id: T) => void,
  tierOrder: readonly T[],
) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axisLock = useRef<"none" | "horizontal" | "vertical">("none");

  const reset = useCallback(() => {
    startX.current = null;
    startY.current = null;
    axisLock.current = "none";
  }, []);

  const selectTierByOffset = useCallback(
    (offset: -1 | 1) => {
      const idx = tierOrder.indexOf(selectedId);
      if (idx < 0) return;
      const next = idx + offset;
      if (next < 0 || next >= tierOrder.length) return;
      setSelectedId(tierOrder[next]!);
    },
    [selectedId, setSelectedId, tierOrder],
  );

  const onSwipeAreaTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    axisLock.current = "none";
  }, []);

  const onSwipeAreaTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return;
    if (axisLock.current === "none") {
      const dx = Math.abs(t.clientX - startX.current);
      const dy = Math.abs(t.clientY - startY.current);
      if (dx < 10 && dy < 10) return;
      axisLock.current = dx >= dy ? "horizontal" : "vertical";
    }
  }, []);

  const finishSwipe = useCallback(
    (endX: number | undefined) => {
      if (startX.current === null || endX === undefined) {
        reset();
        return;
      }
      if (axisLock.current === "vertical") {
        reset();
        return;
      }
      const delta = endX - startX.current;
      if (delta <= -SWIPE_THRESHOLD_PX) selectTierByOffset(1);
      else if (delta >= SWIPE_THRESHOLD_PX) selectTierByOffset(-1);
      reset();
    },
    [reset, selectTierByOffset],
  );

  const onSwipeAreaTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      finishSwipe(e.changedTouches[0]?.clientX);
    },
    [finishSwipe],
  );

  const onSwipeAreaTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    onSwipeAreaTouchStart,
    onSwipeAreaTouchMove,
    onSwipeAreaTouchEnd,
    onSwipeAreaTouchCancel,
  };
}

/** Desktop home pricing hero three-tier swipe helper. */
export function useTestPricingTierSwipe(
  selectedId: TestPricingPlanId,
  setSelectedId: (id: TestPricingPlanId) => void,
  tierOrder: readonly TestPricingPlanId[] = TIER_ORDER,
) {
  return useTierSwipe(selectedId, setSelectedId, tierOrder);
}

export { TIER_ORDER as TEST_PRICING_TIER_ORDER };
