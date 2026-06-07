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
  const touchStartX = useRef<number | null>(null);

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
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }, []);

  const onSwipeAreaTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX === undefined) return;
      const delta = endX - touchStartX.current;
      if (delta <= -SWIPE_THRESHOLD_PX) selectTierByOffset(1);
      else if (delta >= SWIPE_THRESHOLD_PX) selectTierByOffset(-1);
      touchStartX.current = null;
    },
    [selectTierByOffset],
  );

  return { onSwipeAreaTouchStart, onSwipeAreaTouchEnd };
}

/** Desktop `/test-pricing-5` three-tier swipe helper. */
export function useTestPricingTierSwipe(
  selectedId: TestPricingPlanId,
  setSelectedId: (id: TestPricingPlanId) => void,
  tierOrder: readonly TestPricingPlanId[] = TIER_ORDER,
) {
  return useTierSwipe(selectedId, setSelectedId, tierOrder);
}

export { TIER_ORDER as TEST_PRICING_TIER_ORDER };
