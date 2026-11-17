import type { BlogBlock } from "@/lib/blog/types";

export type BlogTocItem = { id: string; num: string; title: string };

/** Virsraksta enkurs: `sadala-1`, `sadala-2`… (secībā pēc h2). */
export function blogHeadingId(index: number): string {
  return `sadala-${index + 1}`;
}

function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Satura rādītājs no h2 blokiem; „1. Likums: …” -> num „1”, title „Likums: …”. */
export function blogToc(blocks: BlogBlock[]): BlogTocItem[] {
  const items: BlogTocItem[] = [];
  for (const block of blocks) {
    if (block.type !== "h2") continue;
    const text = plain(block.text);
    const m = text.match(/^(\d+)\.\s*(.+)$/);
    items.push({
      id: blogHeadingId(items.length),
      num: m ? m[1]! : String(items.length + 1),
      title: m ? m[2]! : text,
    });
  }
  return items;
}
