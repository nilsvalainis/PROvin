import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAllBlogSlugs, getBlogPost, listBlogPosts } from "@/lib/blog/posts";

describe("blog posts", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists the mobile.de scam post first", async () => {
    const posts = await listBlogPosts();
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0]?.slug).toBe("krapsanas-shemas-mobile-de-48000");
    expect(await getAllBlogSlugs()).toContain("krapsanas-shemas-mobile-de-48000");
    const post = await getBlogPost("krapsanas-shemas-mobile-de-48000");
    expect(post?.lv.title).toMatch(/48 000/);
    expect(post?.coverImage?.src).toBe("/blog/auto-vestures-parbaude.jpg");
    expect(post?.coverImage?.alt).toMatch(/Auto vēstures pārbaude/i);
    expect(post?.tags).toContain("auto vēstures pārbaude");
  });
});
