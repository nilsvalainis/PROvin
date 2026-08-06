import { describe, expect, it } from "vitest";
import { getAllBlogSlugs, getBlogPost, listBlogPosts } from "@/lib/blog/posts";

describe("blog posts", () => {
  it("lists the mobile.de scam post first", () => {
    const posts = listBlogPosts();
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0]?.slug).toBe("krapsanas-shemas-mobile-de-48000");
    expect(getAllBlogSlugs()).toContain("krapsanas-shemas-mobile-de-48000");
    expect(getBlogPost("krapsanas-shemas-mobile-de-48000")?.lv.title).toMatch(/48 000/);
  });
});
