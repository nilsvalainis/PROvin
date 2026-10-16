"use client";

import { useEffect, useSyncExternalStore } from "react";

let covers = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function adminOverlayCoverDepth(): number {
  return covers;
}

export function resetAdminOverlayCoverForTests(): void {
  covers = 0;
  emit();
}

/** Kamēr dziļums > 0, pasūtījuma doks ir paslēpts un `inert`. */
export function acquireAdminOverlayCover(): () => void {
  covers += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    covers = Math.max(0, covers - 1);
    emit();
  };
}

export function useAdminOverlayCover(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => covers > 0,
    () => false,
  );
}

export function useHoldAdminOverlayCover(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return acquireAdminOverlayCover();
  }, [active]);
}
