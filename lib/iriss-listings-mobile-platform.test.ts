import { describe, expect, it } from "vitest";
import { detectMobilePlatform } from "@/lib/iriss-listings-mobile-platform";

describe("detectMobilePlatform", () => {
  it("reads iOS, iPadOS and Android after mount-style UA checks", () => {
    expect(detectMobilePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectMobilePlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectMobilePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectMobilePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBeNull();
    expect(detectMobilePlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(detectMobilePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBeNull();
  });
});
