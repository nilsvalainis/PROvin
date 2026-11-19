import { describe, expect, it } from "vitest";

import { buildPaintMapSvg, paintMapSlotOf } from "@/lib/paint-map-svg";
import { PAINT_MAP_SIDE, PAINT_MAP_SIDE_X, PAINT_MAP_ZONES } from "@/lib/paint-map-geometry";

describe("lakas shēma (kopīga ģeometrija ar IRISS PdPaintMap)", () => {
  it("ģeometrija nemainīta pret apstiprināto maketu (17.11)", () => {
    expect(PAINT_MAP_ZONES.front).toEqual({ label: [121, 250], area: [42, 180, 200, 460] });
    expect(PAINT_MAP_ZONES.left).toEqual({ label: [390, 612], area: [70, 415, 700, 485] });
    expect([...PAINT_MAP_SIDE_X]).toEqual([150, 320, 470, 620]);
    expect(PAINT_MAP_SIDE.right).toEqual({ dot: 192, chip: 122 });
  });

  it("avota detaļu nosaukumi -> vieta shēmā", () => {
    expect(paintMapSlotOf("hood")).toEqual({ zone: "front", slot: 0 });
    expect(paintMapSlotOf("bonnet")).toEqual({ zone: "front", slot: 0 });
    expect(paintMapSlotOf("front-left-fender")).toEqual({ zone: "left", slot: 0 });
    expect(paintMapSlotOf("front-right-door")).toEqual({ zone: "right", slot: 1 });
    expect(paintMapSlotOf("rear-left-door")).toEqual({ zone: "left", slot: 2 });
    expect(paintMapSlotOf("global.paint.rearRightSidePanel")).toEqual({ zone: "right", slot: 3 });
    expect(paintMapSlotOf("roof")).toEqual({ zone: "roof", slot: 0 });
    expect(paintMapSlotOf("tailgate")).toEqual({ zone: "rear", slot: 0 });
    expect(paintMapSlotOf("rear bumper")).toEqual({ zone: "rear", slot: 1 });
    expect(paintMapSlotOf("left mirror")).toBeNull();
    expect(paintMapSlotOf("something")).toBeNull();
  });

  it("SVG: tonis zonai pēc sliktākā mērījuma, aizņemta vieta netiek zīmēta otrreiz", () => {
    const svg = buildPaintMapSvg(
      [
        { slot: { zone: "left", slot: 1 }, text: "120 µm", tone: "ok" },
        { slot: { zone: "left", slot: 2 }, text: "350 µm", tone: "alert" },
        { slot: { zone: "left", slot: 2 }, text: "999 µm", tone: "alert" },
      ],
      { carHref: "car.jpg" },
    );
    expect(svg).toContain('data-zone="left" data-tone="alert"');
    expect(svg).toContain('data-zone="front" data-tone="neutral"');
    expect(svg).toContain(">120 µm<");
    expect(svg).toContain(">350 µm<");
    expect(svg).not.toContain(">999 µm<");
    expect(svg).toContain('href="car.jpg"');
    expect(svg).toContain(">Kreisā puse<");
  });
});
