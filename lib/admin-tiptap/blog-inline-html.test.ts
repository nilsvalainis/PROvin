import { describe, expect, it } from "vitest";
import { safeBlogHref, sanitizeBlogInlineHtml } from "./blog-inline-html";

describe("sanitizeBlogInlineHtml", () => {
  it("keeps allowed formatting and strips attributes", () => {
    expect(sanitizeBlogInlineHtml('<p class="x" onclick="a()">Sveiki <strong>tu</strong><br/></p>')).toBe(
      "<p>Sveiki <strong>tu</strong><br></p>",
    );
  });

  it("does not let removed tags glue a new tag together", () => {
    const out = sanitizeBlogInlineHtml("<p><<x>script>alert(1)<</x>/script></p>");
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("&lt;");
  });

  it("drops dangerous links, also entity-encoded or with control chars", () => {
    for (const href of ["javascript:alert(1)", "&#x6A;avascript:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "//evil.example"]) {
      expect(sanitizeBlogInlineHtml(`<p><a href="${href}">x</a></p>`)).not.toContain("href");
    }
  });

  it("keeps safe links escaped", () => {
    expect(sanitizeBlogInlineHtml('<p><a href="https://www.provin.lv/lv?a=1&amp;b=2">x</a></p>')).toContain(
      'href="https://www.provin.lv/lv?a=1&amp;b=2"',
    );
    expect(safeBlogHref("/lv/blogs")).toBe("/lv/blogs");
    expect(safeBlogHref("mailto:info@example.com")).toBe("mailto:info@example.com");
  });

  it("returns empty string for non-rich input", () => {
    expect(sanitizeBlogInlineHtml("plain <img src=x onerror=1>")).toBe("");
  });
});
