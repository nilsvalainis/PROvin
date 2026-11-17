import { describe, expect, it } from "vitest";
import {
  IRISS_ANCHORED_POPOVER_GAP,
  IRISS_ANCHORED_POPOVER_Z,
  placeAnchoredPopover,
} from "@/lib/iriss-anchored-popover";

const menu = { width: 136, height: 168 };
const viewport = { width: 390, height: 844 };

function anchorAt(top: number, right = 370): Parameters<typeof placeAnchoredPopover>[0]["anchor"] {
  return { top, left: right - 88, right, bottom: top + 36, width: 88, height: 36 };
}

describe("placeAnchoredPopover", () => {
  it("opens below an in-list status pill and stays inside the phone viewport", () => {
    const placed = placeAnchoredPopover({
      anchor: anchorAt(120),
      menu,
      viewport,
      align: "end",
    });
    expect(placed.placement).toBe("below");
    expect(placed.top).toBe(120 + 36 + IRISS_ANCHORED_POPOVER_GAP);
    expect(placed.left).toBe(370 - 136);
    expect(placed.top + menu.height).toBeLessThanOrEqual(viewport.height);
    expect(placed.left + menu.width).toBeLessThanOrEqual(viewport.width);
  });

  it("flips above when the next rows would leave no room below", () => {
    const placed = placeAnchoredPopover({
      anchor: anchorAt(720),
      menu,
      viewport,
      align: "end",
    });
    expect(placed.placement).toBe("above");
    expect(placed.top).toBe(720 - IRISS_ANCHORED_POPOVER_GAP - menu.height);
    expect(placed.top).toBeGreaterThanOrEqual(8);
  });

  it("clamps a start-aligned menu that would overflow the left edge", () => {
    const placed = placeAnchoredPopover({
      anchor: { top: 80, left: 2, right: 40, bottom: 116, width: 38, height: 36 },
      menu: { width: 248, height: 160 },
      viewport: { width: 360, height: 640 },
      align: "start",
    });
    expect(placed.left).toBe(8);
    expect(placed.placement).toBe("below");
  });
});

describe("IRISS anchored popover chrome", () => {
  it("keeps the list menu above overflow-hidden rows", () => {
    expect(IRISS_ANCHORED_POPOVER_Z).toBe(200);
  });
});
