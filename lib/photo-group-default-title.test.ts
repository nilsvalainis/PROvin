import { describe, expect, it } from "vitest";
import { defaultArchivePhotoGroupTitle } from "@/lib/photo-group-default-title";

describe("defaultArchivePhotoGroupTitle", () => {
  it("uses Arhīva fotogrāfijas + local YYYY-MM-DD", () => {
    expect(defaultArchivePhotoGroupTitle(new Date(2026, 9, 20))).toBe("Arhīva fotogrāfijas 2026-10-20");
    expect(defaultArchivePhotoGroupTitle(new Date(2024, 0, 5))).toBe("Arhīva fotogrāfijas 2024-01-05");
  });
});
