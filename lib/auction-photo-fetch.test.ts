import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { AUCTION_PHOTO_FETCH_ATTEMPTS, fetchAuctionPhotoJpeg } from "@/lib/auction-photo-fetch";

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
