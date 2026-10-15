/**
 * Klienta PDF komentāri: lapas pārrāvums tikai starp rindkopām (virsraksts + teksts).
 * Fonta izmērs nemainās; starp rindkopām paliek viena tukša rinda (1em).
 */

const STRONG_SPLIT_RE = /<br\s*\/?>\s*(?=<strong>)/i;
const HEADING_PART_RE = /^<strong>([\s\S]*?)<\/strong>\s*(?:<br\s*\/?>)?\s*([\s\S]*)$/i;
const WORD_RE = /\S+/g;

function wordCount(html: string): number {
  return (html.replace(/<[^>]+>/g, " ").match(WORD_RE) ?? []).length;
}

function plainLength(html: string): number {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
}

function cmtParagraphClass(html: string): string {
  return wordCount(html) > 170 ? "pdf-cmt-p pdf-cmt-p--long" : "pdf-cmt-p";
}

/** Sadalā komentāra HTML rindkopās pie admin `<strong>` virsrakstiem. */
export function splitPdfCommentParagraphs(bodyHtml: string): string[] {
  const body = bodyHtml.trim();
  if (!body) return [];
  const parts = body.split(STRONG_SPLIT_RE);
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const heading = HEADING_PART_RE.exec(p);
    if (heading) {
      const title = heading[1] ?? "";
      const txt = heading[2] ?? "";
      out.push(`<div class="${cmtParagraphClass(txt)}"><span class="pdf-cmt-h">${title}</span>${txt}</div>`);
      continue;
    }
    if (plainLength(p) < 90 && !p.includes("pdf-cmt-h")) {
      out.push(`<div class="pdf-cmt-p"><span class="pdf-cmt-lead">${p}</span></div>`);
      continue;
    }
    out.push(`<div class="${cmtParagraphClass(p)}">${p}</div>`);
  }
  const merged: string[] = [];
  let pendingLead = "";
  for (const block of out) {
    if (block.includes("pdf-cmt-lead")) {
      pendingLead += block.replace(/^<div class="pdf-cmt-p">/, "").replace(/<\/div>$/, "");
      continue;
    }
    if (pendingLead) {
      merged.push(block.replace(/(<div class="pdf-cmt-p(?: pdf-cmt-p--long)?">)/, `$1${pendingLead}`));
      pendingLead = "";
      continue;
    }
    merged.push(block);
  }
  if (pendingLead) merged.push(`<div class="pdf-cmt-p">${pendingLead}</div>`);
  return merged;
}

const LONG_COMMENT_SPLIT_WORDS = 120;

export type PdfCommentBoxes = { first: string; rest: string };

/**
 * Komentāru kastes. Garš teksts aiz sadaļas galvas: 1. rindkopa paliek ar virsrakstu,
 * pārējais turpina tajā pašā rāmī (split-a / split-b).
 */
export function buildPdfCommentBoxes(bodyHtml: string, headHtml = ""): PdfCommentBoxes {
  const paragraphs = splitPdfCommentParagraphs(bodyHtml);
  if (paragraphs.length === 0) return { first: "", rest: "" };
  const totalWords = wordCount(paragraphs.join(" "));
  const splitLong = paragraphs.length >= 2 && totalWords > LONG_COMMENT_SPLIT_WORDS;
  const firstInner = splitLong ? paragraphs[0]! : paragraphs.join("");
  const restInner = splitLong ? paragraphs.slice(1).join("") : "";
  const first = noteBox(firstInner, headHtml, splitLong ? "pdf-cmt-split-a" : "");
  const rest = restInner ? noteBox(restInner, "", "pdf-cmt-split-b") : "";
  return { first, rest };
}

function noteBox(inner: string, headHtml: string, extraClass: string): string {
  const cls = ["pdf-report-comment-note", extraClass].filter(Boolean).join(" ");
  return `<div class="${cls}" role="note">${headHtml}<div class="pdf-report-comment-note-body">${inner}</div></div>`;
}
