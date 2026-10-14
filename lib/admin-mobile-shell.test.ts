import { describe, expect, it } from "vitest";
import { ADMIN_MOBILE_PTR_THRESHOLD_PX, adminMobilePtrLabel } from "@/lib/admin-mobile-shell";

describe("adminMobilePtrLabel", () => {
  it("rāda atjaunošanu, slieksni un vilkšanu", () => {
    expect(adminMobilePtrLabel(true, 10)).toBe("Atjauno sarakstu…");
    expect(adminMobilePtrLabel(false, ADMIN_MOBILE_PTR_THRESHOLD_PX)).toBe("Atlaid, lai atjaunotu");
    expect(adminMobilePtrLabel(false, 20)).toBe("Velc, lai atjaunotu");
    expect(adminMobilePtrLabel(false, 0)).toBe("");
  });
});
