/** Fiksētas izvēlnes vieta pret enkuru (viewport), ar apvēršanu, ja apakšā nepietiek vietas. */

export type AnchoredPopoverAlign = "start" | "end";

export type AnchoredPopoverBox = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type PlaceAnchoredPopoverInput = {
  anchor: AnchoredPopoverBox;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  align?: AnchoredPopoverAlign;
  gap?: number;
  padding?: number;
};

export type PlacedAnchoredPopover = {
  top: number;
  left: number;
  placement: "below" | "above";
};

export const IRISS_ANCHORED_POPOVER_GAP = 6;
export const IRISS_ANCHORED_POPOVER_PADDING = 8;
export const IRISS_ANCHORED_POPOVER_Z = 200;

function clamp(n: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(min, n), max);
}

export function placeAnchoredPopover(input: PlaceAnchoredPopoverInput): PlacedAnchoredPopover {
  const gap = input.gap ?? IRISS_ANCHORED_POPOVER_GAP;
  const pad = input.padding ?? IRISS_ANCHORED_POPOVER_PADDING;
  const align = input.align ?? "end";
  const menuW = Math.max(0, input.menu.width);
  const menuH = Math.max(0, input.menu.height);
  const vw = Math.max(0, input.viewport.width);
  const vh = Math.max(0, input.viewport.height);

  let left = align === "start" ? input.anchor.left : input.anchor.right - menuW;
  left = clamp(left, pad, vw - menuW - pad);

  const below = input.anchor.bottom + gap;
  const above = input.anchor.top - gap - menuH;
  const spaceBelow = vh - pad - below;
  const spaceAbove = input.anchor.top - gap - pad;
  const placement: "below" | "above" = spaceBelow < menuH && spaceAbove > spaceBelow ? "above" : "below";
  const rawTop = placement === "above" ? above : below;
  const top = clamp(rawTop, pad, vh - menuH - pad);

  return { top, left, placement };
}
