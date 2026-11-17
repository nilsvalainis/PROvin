import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { AUCTION_PHOTO_FETCH_ATTEMPTS, AUCTION_PHOTO_MAX_REDIRECTS, fetchAuctionPhotoJpeg } from "@/lib/auction-photo-fetch";

describe("izsoļu foto lejupielāde", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("atkārto timeout un beidzot ielādē; host_not_allowed bez atkārtošanas", async () => {
    const jpeg = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#445566" },
    })
      .jpeg({ quality: 70 })
      .toBuffer();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls < 2) {
          const err = new Error("aborted");
          err.name = "TimeoutError";
          throw err;
        }
        return new Response(new Uint8Array(jpeg), { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }),
    );
    const ok = await fetchAuctionPhotoJpeg("https://cs.copart.com/lot/a.jpg", 320 * 1024);
    expect(ok.ok).toBe(true);
    expect(calls).toBe(2);
    if (ok.ok) expect(ok.contentHash).toHaveLength(64);

    const blocked = await fetchAuctionPhotoJpeg("https://evil.example/a.jpg", 320 * 1024);
    expect(blocked).toMatchObject({ ok: false, reason: "host_not_allowed" });
    expect(AUCTION_PHOTO_FETCH_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });
});

describe("izsoļu foto pāradresācijas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function jpegBytes(): Promise<Buffer> {
    return sharp({ create: { width: 32, height: 24, channels: 3, background: "#445566" } })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  /** `routes`: URL -> Location (pāradresācija) vai "jpeg" (attēls). Atgriež pieprasīto URL sarakstu. */
  function stubFetch(routes: Record<string, string>, jpeg: Buffer): { urls: string[]; redirectModes: string[] } {
    const seen = { urls: [] as string[], redirectModes: [] as string[] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        seen.urls.push(url);
        seen.redirectModes.push(String(init?.redirect));
        const target = routes[url];
        if (!target) return new Response("nav", { status: 404 });
        if (target === "jpeg") return new Response(new Uint8Array(jpeg), { status: 200, headers: { "Content-Type": "image/jpeg" } });
        return new Response(null, { status: 302, headers: { Location: target } });
      }),
    );
    return seen;
  }

  it("pāradresācija uz neatļautu hostu ir noraidīta un mērķis netiek pieprasīts", async () => {
    const seen = stubFetch(
      { "https://d111.cloudfront.net/a.jpg": "https://evil.example/a.jpg", "https://evil.example/a.jpg": "jpeg" },
      await jpegBytes(),
    );
    const out = await fetchAuctionPhotoJpeg("https://d111.cloudfront.net/a.jpg", 320 * 1024);
    expect(out).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
    expect(seen.urls).toEqual(["https://d111.cloudfront.net/a.jpg"]);
    expect(seen.redirectModes).toEqual(["manual"]);
  });

  it("pāradresācija uz iekšējo adresi vai http ir noraidīta", async () => {
    const jpeg = await jpegBytes();
    for (const target of ["http://169.254.169.254/latest/meta-data/", "https://127.0.0.1/a.jpg", "http://cs.copart.com/a.jpg"]) {
      const seen = stubFetch({ "https://cs.copart.com/lot/a.jpg": target, [target]: "jpeg" }, jpeg);
      const out = await fetchAuctionPhotoJpeg("https://cs.copart.com/lot/a.jpg", 320 * 1024);
      expect(out).toMatchObject({ ok: false, reason: "redirect_not_allowed" });
      expect(seen.urls).toEqual(["https://cs.copart.com/lot/a.jpg"]);
    }
  });

  it("ķēde atļauto hostu robežās strādā, arī ar relatīvu Location", async () => {
    const seen = stubFetch(
      {
        "https://cs.copart.com/lot/a.jpg": "https://g-static.copart.com/b.jpg",
        "https://g-static.copart.com/b.jpg": "/c.jpg",
        "https://g-static.copart.com/c.jpg": "https://d111.cloudfront.net/d.jpg",
        "https://d111.cloudfront.net/d.jpg": "jpeg",
      },
      await jpegBytes(),
    );
    const out = await fetchAuctionPhotoJpeg("https://cs.copart.com/lot/a.jpg", 320 * 1024);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.url).toBe("https://cs.copart.com/lot/a.jpg");
      expect(out.contentHash).toHaveLength(64);
    }
    expect(seen.urls).toHaveLength(AUCTION_PHOTO_MAX_REDIRECTS + 1);
    expect(seen.urls.at(-1)).toBe("https://d111.cloudfront.net/d.jpg");
  });

  it("vairāk par 3 pāradresācijām ir noraidīts bez atkārtošanas", async () => {
    const seen = stubFetch(
      {
        "https://cs.copart.com/0.jpg": "https://cs.copart.com/1.jpg",
        "https://cs.copart.com/1.jpg": "https://cs.copart.com/2.jpg",
        "https://cs.copart.com/2.jpg": "https://cs.copart.com/3.jpg",
        "https://cs.copart.com/3.jpg": "https://cs.copart.com/4.jpg",
        "https://cs.copart.com/4.jpg": "jpeg",
      },
      await jpegBytes(),
    );
    const out = await fetchAuctionPhotoJpeg("https://cs.copart.com/0.jpg", 320 * 1024);
    expect(out).toMatchObject({ ok: false, reason: "too_many_redirects" });
    expect(seen.urls).toHaveLength(AUCTION_PHOTO_MAX_REDIRECTS + 1);
    expect(seen.urls).not.toContain("https://cs.copart.com/4.jpg");
  });
});
