export const IRISS_SWIPE_MIN_PX = 48;

export type IrissSwipeDirection = "next" | "prev";

/** Horizontāla vilkšana. Pa kreisi = nākamais, pa labi = iepriekšējais. Vertikāle paliek ritināšanai. */
export function irissHorizontalSwipeDirection(dx: number, dy: number, min = IRISS_SWIPE_MIN_PX): IrissSwipeDirection | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < min) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.2) return null;
  return dx < 0 ? "next" : "prev";
}

export function irissTabAfterSwipe<T>(tabs: readonly T[], current: T, direction: IrissSwipeDirection): T {
  const index = tabs.indexOf(current);
  if (index < 0) return current;
  if (direction === "next") return tabs[Math.min(tabs.length - 1, index + 1)] ?? current;
  return tabs[Math.max(0, index - 1)] ?? current;
}

export function irissGalleryIndexAfterSwipe(length: number, index: number, direction: IrissSwipeDirection): number {
  if (length <= 1) return 0;
  const safe = ((index % length) + length) % length;
  const delta = direction === "next" ? 1 : -1;
  return (safe + delta + length) % length;
}
