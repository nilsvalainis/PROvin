import { describe, expect, it } from "vitest";

import { isUserscriptUnsupportedBrowser } from "@/lib/provin-userscript-presence";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";
const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/131.0.0.0`;

describe("isUserscriptUnsupportedBrowser", () => {
  it("Chrome uz Mac/Windows un Edge - skripts var strādāt", () => {
    expect(isUserscriptUnsupportedBrowser({ userAgent: CHROME_MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isUserscriptUnsupportedBrowser({ userAgent: CHROME_WIN, platform: "Win32", maxTouchPoints: 0 })).toBe(false);
    expect(isUserscriptUnsupportedBrowser({ userAgent: EDGE_WIN, platform: "Win32", maxTouchPoints: 10 })).toBe(false);
  });

  it("iPhone (arī guļus) un Chrome uz iPhone", () => {
    expect(isUserscriptUnsupportedBrowser({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
    expect(isUserscriptUnsupportedBrowser({ userAgent: IPHONE_CHROME, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
  });

  it("iPad ar iPad UA un ar «desktop» Macintosh UA", () => {
    expect(isUserscriptUnsupportedBrowser({ userAgent: IPAD_UA, platform: "iPad", maxTouchPoints: 5 })).toBe(true);
    expect(isUserscriptUnsupportedBrowser({ userAgent: SAFARI_MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isUserscriptUnsupportedBrowser({ userAgent: CHROME_MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  });

  it("Safari uz Mac bez Chrome", () => {
    expect(isUserscriptUnsupportedBrowser({ userAgent: SAFARI_MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe(true);
  });

  it("bez navigator (SSR) - false", () => {
    expect(isUserscriptUnsupportedBrowser({})).toBe(false);
  });
});
