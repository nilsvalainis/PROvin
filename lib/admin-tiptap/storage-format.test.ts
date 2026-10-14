import { describe, expect, it } from "vitest";
import {
  adminTiptapHtmlToStorage,
  adminTiptapPlainPreview,
  isAdminTiptapRichStorage,
  plainTextToAdminTiptapHtml,
  storageToAdminTiptapHtml,
} from "@/lib/admin-tiptap/storage-format";

describe("admin tiptap storage round-trip", () => {
  it("detects rich vs plain angle brackets", () => {
    expect(isAdminTiptapRichStorage("Hello")).toBe(false);
    expect(isAdminTiptapRichStorage("A <b>B</b>")).toBe(false);
    expect(isAdminTiptapRichStorage("<p>Hi</p>")).toBe(true);
    expect(isAdminTiptapRichStorage("<ul><li>x</li></ul>")).toBe(true);
  });

  it("round-trips plain text with placeholders unchanged", () => {
    const plain = "Labdien {{vards}}!\n\nOtrā rinda {{#bloks}}iekšā{{/bloks}}.";
    const html = storageToAdminTiptapHtml(plain);
    expect(html).toContain("{{vards}}");
    expect(html).toContain("{{#bloks}}");
    const back = adminTiptapHtmlToStorage(html, "rich");
    expect(back).toBe(plain);
  });

  it("stores trivial rich as plain for migration parity", () => {
    const plain = "Vienkāršs teksts\n\nOtra rinda.";
    const html = plainTextToAdminTiptapHtml(plain);
    expect(adminTiptapHtmlToStorage(html, "rich")).toBe(plain);
  });

  it("preserves bold lists as rich storage", () => {
    const html = "<p><strong>Svarīgi</strong></p><ul><li>Viens</li><li>Divi</li></ul>";
    const stored = adminTiptapHtmlToStorage(html, "rich");
    expect(isAdminTiptapRichStorage(stored)).toBe(true);
    expect(stored).toContain("<strong>");
    expect(stored).toContain("<ul>");
    const reload = storageToAdminTiptapHtml(stored);
    expect(reload).toContain("<strong>");
  });

  it("plain mode export strips all tags", () => {
    const html = "<p><strong>X</strong></p>";
    expect(adminTiptapHtmlToStorage(html, "plain")).toBe("X");
  });

  it("preview flattens rich to readable plain", () => {
    const html = "<p>A</p><p><strong>B</strong></p>";
    expect(adminTiptapPlainPreview(html)).toContain("A");
    expect(adminTiptapPlainPreview(html)).toContain("B");
  });
});
