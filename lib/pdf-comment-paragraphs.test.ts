import { describe, expect, it } from "vitest";
import { buildPdfCommentBoxes, splitPdfCommentParagraphs } from "@/lib/pdf-comment-paragraphs";

describe("splitPdfCommentParagraphs", () => {
  it("splits at strong headings and keeps one blank-line gap between paragraphs", () => {
    const parts = splitPdfCommentParagraphs(
      "Ievads īss.<br /><strong>Servisa vēsture</strong><br />Dīleris ir dokumentējis apkopes.",
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain("pdf-cmt-lead");
    expect(parts[0]).toContain("pdf-cmt-h");
    expect(parts[0]).toContain("Servisa vēsture");
    expect(parts[0]).toContain("Dīleris ir dokumentējis apkopes.");
  });

  it("keeps a long comment as separate heading paragraphs", () => {
    const parts = splitPdfCommentParagraphs(
      "<strong>Nobraukums</strong><br />Pirmais teksts.<br /><strong>Negadījumi</strong><br />Otrais teksts.",
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("Nobraukums");
    expect(parts[1]).toContain("Negadījumi");
  });
});

describe("buildPdfCommentBoxes", () => {
  it("splits a long first comment so the heading can stay with the first paragraph", () => {
    const longA = Array.from({ length: 80 }, () => "vārds").join(" ");
    const longB = Array.from({ length: 50 }, () => "cits").join(" ");
    const boxes = buildPdfCommentBoxes(
      `<strong>Virsraksts viens</strong><br />${longA}<br /><strong>Virsraksts divi</strong><br />${longB}`,
    );
    expect(boxes.first).toContain("pdf-cmt-split-a");
    expect(boxes.first).toContain("Virsraksts viens");
    expect(boxes.first).not.toContain("Virsraksts divi");
    expect(boxes.rest).toContain("pdf-cmt-split-b");
    expect(boxes.rest).toContain("Virsraksts divi");
  });
});
