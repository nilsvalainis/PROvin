import { afterEach, describe, expect, it } from "vitest";
import { getPublicSiteOrigin } from "@/lib/site-url";

describe("getPublicSiteOrigin", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  });

  it("canonicalizes apex and www production hosts to https://www.provin.lv", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://provin.lv";
    expect(getPublicSiteOrigin()).toBe("https://www.provin.lv");
    process.env.NEXT_PUBLIC_SITE_URL = "http://www.provin.lv/";
    expect(getPublicSiteOrigin()).toBe("https://www.provin.lv");
    process.env.NEXT_PUBLIC_SITE_URL = "provin.lv";
    expect(getPublicSiteOrigin()).toBe("https://www.provin.lv");
  });

  it("keeps localhost and preview origins unchanged", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getPublicSiteOrigin()).toBe("http://localhost:3000");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getPublicSiteOrigin()).toBe("http://localhost:3000");
  });
});
