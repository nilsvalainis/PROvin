import { describe, expect, it } from "vitest";

import { ADMIN_RAIL_V1_ASIDE, ADMIN_RAIL_V1_BOX, ADMIN_RAIL_V1_GLYPH_INNER } from "@/lib/admin-sticky-rail-v1-styles";

describe("admin-sticky-rail-v1-styles", () => {
  it("uses borderless translucent rail box", () => {
    expect(ADMIN_RAIL_V1_BOX).toContain("bg-white/[0.08]");
    expect(ADMIN_RAIL_V1_BOX).not.toContain("border");
  });

  it("normalizes glyph frame to 20px in 28px box", () => {
    expect(ADMIN_RAIL_V1_GLYPH_INNER).toContain("h-5 w-5");
    expect(ADMIN_RAIL_V1_ASIDE).toContain("lg:flex");
  });
});
