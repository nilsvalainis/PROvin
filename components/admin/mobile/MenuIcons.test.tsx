import { describe, expect, it } from "vitest";
import { MenuIcon, menuIconBleed, menuIconPadded } from "@/components/admin/mobile/MenuIcons";
import { renderHtml } from "@/lib/test-render";

describe("ikonas-v2 flīžu glifi", () => {
  it("VIN ir vecā tipa Scan, CSDD full-bleed, Autoparks ar atkāpi, Loģistika Maps pin", () => {
    expect(menuIconBleed("csdd")).toBe(true);
    expect(menuIconPadded("dz")).toBe(true);
    expect(menuIconBleed("pin")).toBe(false);
    const vin = renderHtml(<MenuIcon name="scan" size={40} />);
    expect(vin).toContain("M4 8V5h3");
    expect(vin).toContain("M7 12h10");
    expect(vin).toContain('width="40"');
    const pin = renderHtml(<MenuIcon name="pin" size={40} />);
    expect(pin).toContain("#ea4335");
    expect(pin).toContain("#4285f4");
    expect(pin).toContain("viewBox=\"0 0 24 34\"");
    const csdd = renderHtml(<MenuIcon name="csdd" size={64} />);
    expect(csdd).toContain("/admin/menu/csdd.png");
    const dz = renderHtml(<MenuIcon name="dz" size={40} />);
    expect(dz).toContain("/admin/menu/dz-trim.png");
  });
});
