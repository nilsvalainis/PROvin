import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyIrissSwRequest, irissSwResponseCacheable, isIrissStaticAsset } from "../public/admin/iriss/sw-core.js";
import {
  IRISS_PWA_MANIFEST_PATH,
  IRISS_PWA_NAME,
  IRISS_PWA_SCOPE,
  IRISS_PWA_START_URL,
  IRISS_PWA_SW_PATH,
  IRISS_PWA_THEME_COLOR,
  IRISS_PWA_THEME_COLOR_DARK,
} from "@/lib/iriss-pwa";

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

describe("IRISS service worker policy", () => {
  it("never caches admin API or auth", () => {
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/api/admin/iriss-pasutijumi" })).toBe("network-only");
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/api/admin/session" })).toBe("network-only");
    expect(classifyIrissSwRequest({ method: "POST", url: "https://provin.lv/admin/iriss/pasutijumi" })).toBe("network-only");
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/admin/login?next=/admin/iriss" })).toBe("network-only");
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/api/auth/session" })).toBe("network-only");
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/admin/iriss/pasutijumi?_rsc=1", mode: "cors" })).toBe(
      "network-only",
    );
  });

  it("uses network-first for IRISS pages and cache-first for static files", () => {
    expect(
      classifyIrissSwRequest({
        method: "GET",
        url: "https://provin.lv/admin/iriss/pasutijumi",
        mode: "navigate",
        destination: "document",
      }),
    ).toBe("network-first-page");
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/admin/iriss/sludinajumi", destination: "document" })).toBe(
      "network-first-page",
    );
    expect(classifyIrissSwRequest({ method: "GET", url: "https://provin.lv/_next/static/chunks/app.js", destination: "script" })).toBe(
      "cache-first-static",
    );
    expect(isIrissStaticAsset("/admin/iriss/icon-192.png")).toBe(true);
    expect(isIrissStaticAsset("/api/admin/iriss-pasutijumi")).toBe(false);
  });

  it("does not store Set-Cookie or JSON responses", () => {
    expect(irissSwResponseCacheable(headers({ "set-cookie": "admin=1", "content-type": "text/html" }), "network-first-page")).toBe(
      false,
    );
    expect(irissSwResponseCacheable(headers({ "content-type": "application/json" }), "cache-first-static")).toBe(false);
    expect(irissSwResponseCacheable(headers({ "content-type": "text/html; charset=utf-8" }), "network-first-page")).toBe(true);
    expect(irissSwResponseCacheable(headers({ "content-type": "text/css", "cache-control": "no-store" }), "cache-first-static")).toBe(
      false,
    );
  });

  it("ships an installable IRISS manifest and module worker", () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/admin/iriss/manifest.webmanifest", import.meta.url), "utf8")) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe(IRISS_PWA_NAME);
    expect(manifest.short_name).toBe("IRISS");
    expect(manifest.start_url).toBe(IRISS_PWA_START_URL);
    expect(manifest.scope).toBe(IRISS_PWA_SCOPE);
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe(IRISS_PWA_THEME_COLOR);
    expect(manifest.background_color).toBe(IRISS_PWA_THEME_COLOR);
    expect(IRISS_PWA_THEME_COLOR).toBe("#E9ECF1");
    expect(IRISS_PWA_THEME_COLOR_DARK).toBe("#060607");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    const sw = readFileSync(new URL("../public/admin/iriss/sw.js", import.meta.url), "utf8");
    expect(sw).toContain("network-only");
    expect(sw).toContain('from "./sw-core.js"');
    expect(IRISS_PWA_SW_PATH).toBe("/admin/iriss/sw.js");
    expect(IRISS_PWA_MANIFEST_PATH).toBe("/admin/iriss/manifest.webmanifest");
  });
});
