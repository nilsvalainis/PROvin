import { describe, expect, it } from "vitest";
import { shouldCloseModalBackdrop } from "@/lib/modal-backdrop-close";

describe("shouldCloseModalBackdrop", () => {
  it("closes when mousedown and mouseup are both on the backdrop", () => {
    expect(shouldCloseModalBackdrop({ mouseDownOnBackdrop: true, mouseUpOnBackdrop: true, enabled: true })).toBe(true);
  });

  it("does not close when mousedown started inside the dialog (text selection dragged out)", () => {
    expect(shouldCloseModalBackdrop({ mouseDownOnBackdrop: false, mouseUpOnBackdrop: true, enabled: true })).toBe(false);
  });

  it("does not close when mouseup ends inside the dialog (dragged from backdrop into content)", () => {
    expect(shouldCloseModalBackdrop({ mouseDownOnBackdrop: true, mouseUpOnBackdrop: false, enabled: true })).toBe(false);
  });

  it("does not close when neither event is on the backdrop", () => {
    expect(shouldCloseModalBackdrop({ mouseDownOnBackdrop: false, mouseUpOnBackdrop: false, enabled: true })).toBe(false);
  });

  it("does not close when disabled (e.g. busy/uploading), even if both on backdrop", () => {
    expect(shouldCloseModalBackdrop({ mouseDownOnBackdrop: true, mouseUpOnBackdrop: true, enabled: false })).toBe(false);
  });
});
