"use client";

import { useCallback, useRef } from "react";
import type React from "react";
import { shouldCloseModalBackdrop } from "@/lib/modal-backdrop-close";

/**
 * Spred uz modāla fona (backdrop) elementu: `onMouseDown`/`onMouseUp` aizver logu TIKAI, ja
 * abi notikumi ir tieši uz fona (nevis uz loga satura). Sk. `shouldCloseModalBackdrop`.
 */
export function useModalBackdropClose(onClose: () => void, enabled = true) {
  const mouseDownOnBackdrop = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const closeNow = shouldCloseModalBackdrop({
        mouseDownOnBackdrop: mouseDownOnBackdrop.current,
        mouseUpOnBackdrop: e.target === e.currentTarget,
        enabled,
      });
      mouseDownOnBackdrop.current = false;
      if (closeNow) onClose();
    },
    [onClose, enabled],
  );

  return { onMouseDown, onMouseUp };
}
