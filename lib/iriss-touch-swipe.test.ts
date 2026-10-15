import { describe, expect, it } from "vitest";
import { IRISS_ORDER_ROOM_TABS } from "@/lib/iriss-order-room";
import { irissGalleryIndexAfterSwipe, irissHorizontalSwipeDirection, irissTabAfterSwipe } from "@/lib/iriss-touch-swipe";

describe("IRISS horizontal swipe", () => {
  it("ignores short and vertical moves", () => {
    expect(irissHorizontalSwipeDirection(10, 4)).toBeNull();
    expect(irissHorizontalSwipeDirection(20, 80)).toBeNull();
  });

  it("maps left to next and right to previous", () => {
    expect(irissHorizontalSwipeDirection(-60, 8)).toBe("next");
    expect(irissHorizontalSwipeDirection(70, -10)).toBe("prev");
  });

  it("steps order-room tabs without wrapping and cycles gallery photos", () => {
    expect(irissTabAfterSwipe(IRISS_ORDER_ROOM_TABS, "overview", "prev")).toBe("overview");
    expect(irissTabAfterSwipe(IRISS_ORDER_ROOM_TABS, "overview", "next")).toBe("search");
    expect(irissTabAfterSwipe(IRISS_ORDER_ROOM_TABS, "documents", "next")).toBe("documents");
    expect(irissGalleryIndexAfterSwipe(4, 0, "prev")).toBe(3);
    expect(irissGalleryIndexAfterSwipe(4, 1, "next")).toBe(2);
    expect(irissGalleryIndexAfterSwipe(1, 0, "next")).toBe(0);
  });
});
