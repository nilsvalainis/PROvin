import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAllBlogSlugs, getBlogPost, listBlogPosts } from "@/lib/blog/posts";

describe("blog posts", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists seeded posts with newest first", async () => {
    const posts = await listBlogPosts();
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(posts[0]?.slug).toBe("ka-pirkt-lietotu-auto-bez-tabu");
    expect(await getAllBlogSlugs()).toEqual(
      expect.arrayContaining([
        "ka-pirkt-lietotu-auto-bez-tabu",
        "krapsanas-shemas-mobile-de-48000",
      ]),
    );
    const buying = await getBlogPost("ka-pirkt-lietotu-auto-bez-tabu");
    expect(buying?.lv.title).toMatch(/BEZ TABU/);
    expect(buying?.coverImage).toBeUndefined();
    const scam = await getBlogPost("krapsanas-shemas-mobile-de-48000");
    expect(scam?.lv.title).toMatch(/48 000/);
    expect(scam?.coverImage).toBeUndefined();
  });
});
