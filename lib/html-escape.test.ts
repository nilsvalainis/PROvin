import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/html-escape";

describe("escapeHtml", () => {
  it("encodes markup and quotes so stored names cannot break HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(escapeHtml("O'Brien & Co")).toBe("O&#39;Brien &amp; Co");
    expect(escapeHtml("")).toBe("");
  });
});
