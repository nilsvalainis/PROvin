import { describe, expect, it } from "vitest";
import { MenuIcon, menuIconBleed, menuIconLight, menuIconPadded } from "@/components/admin/mobile/MenuIcons";
import { renderHtml } from "@/lib/test-render";

describe("v11d-fix flīžu glifi (iepriekšējais krāsu komplekts, ne ikonas-v2)", () => {
  it("VIN ir stūri, CSDD full-bleed, Autoparks un Maps uz balta, Kravas kaste, Radars apļi", () => {
    expect(menuIconBleed("csdd")).toBe(true);
    expect(menuIconPadded("dz")).toBe(true);
    expect(menuIconLight("pin")).toBe(true);
    expect(menuIconLight("dz")).toBe(true);
    expect(menuIconLight("box")).toBe(false);
    const vin = renderHtml(<MenuIcon name="scan" size={26} />);
    expect(vin).toContain("M4 8V5a1 1 0 0 1 1-1h3");
    expect(vin).toContain("M8 12h8");
    expect(vin).toContain('width="26"');
    const pin = renderHtml(<MenuIcon name="pin" size={34} />);
    expect(pin).toContain("#ea4335");
    expect(pin).toContain("#4285f4");
    expect(pin).toContain("#fbbc04");
    expect(pin).toContain('viewBox="0 0 24 24"');
    expect(pin).not.toContain('viewBox="0 0 24 34"');
    const box = renderHtml(<MenuIcon name="box" size={26} />);
    expect(box).toContain("M3 7l9-4 9 4v10l-9 4-9-4z");
    const tag = renderHtml(<MenuIcon name="lst" size={26} />);
    expect(tag).toContain("M3 12V4h8l10 10-8 8z");
    const rad = renderHtml(<MenuIcon name="rad" size={26} />);
    expect(rad).toContain('r="8"');
    expect(rad).toContain('r="4"');
    const csdd = renderHtml(<MenuIcon name="csdd" size={58} />);
    expect(csdd).toContain("/admin/menu/csdd.png");
    const dz = renderHtml(<MenuIcon name="dz" size={40} />);
    expect(dz).toContain("/admin/menu/dz-trim.png");
  });
});
