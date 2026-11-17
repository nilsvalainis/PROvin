import { describe, expect, it } from "vitest";
import { blogToc } from "@/lib/blog/toc";

describe("blogToc", () => {
  it("numbers headings and strips the leading number", () => {
    const toc = blogToc([
      { type: "p", text: "Ievads" },
      { type: "h2", text: "1. Likums: <strong>vēss</strong> prāts" },
      { type: "p", text: "..." },
      { type: "h2", text: "Uzdevums" },
    ]);
    expect(toc).toEqual([
      { id: "sadala-1", num: "1", title: "Likums: vēss prāts" },
      { id: "sadala-2", num: "2", title: "Uzdevums" },
    ]);
  });
});
