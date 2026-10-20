import { describe, expect, it } from "vitest";
import { logisticsGoogleMapsDirUrl } from "@/lib/iriss-logistics-maps-dir";

describe("google maps dir url", () => {
  it("uses selection order and caps waypoints at 9", () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ lat: 50 + i / 10, lng: 8 + i / 10 }));
    const url = logisticsGoogleMapsDirUrl(pts)!;
    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("origin=50%2C8");
    expect(url).toContain("destination=51.1%2C9.1");
    const waypoints = new URL(url).searchParams.get("waypoints")!.split("|");
    expect(waypoints).toHaveLength(9);
  });
});
