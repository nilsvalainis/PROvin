import { describe, expect, it } from "vitest";
import { AZVIN_PUBLIC_PATH, isAzvinPublicPath } from "@/lib/azvin-public-path";

describe("AZ.VIN unlisted public path", () => {
  it("matches locale-prefixed and bare product URLs", () => {
    expect(AZVIN_PUBLIC_PATH).toBe("/view/n7k4xw9q");
    expect(isAzvinPublicPath("/view/n7k4xw9q")).toBe(true);
    expect(isAzvinPublicPath("/lv/view/n7k4xw9q")).toBe(true);
    expect(isAzvinPublicPath("/en/view/n7k4xw9q/")).toBe(true);
  });

  it("does not match the closed demo URL or live PROVIN routes", () => {
    expect(isAzvinPublicPath("/demo/azvin")).toBe(false);
    expect(isAzvinPublicPath("/lv/demo/azvin")).toBe(false);
    expect(isAzvinPublicPath("/lv")).toBe(false);
    expect(isAzvinPublicPath("/lv/pakalpojumi")).toBe(false);
  });
});
