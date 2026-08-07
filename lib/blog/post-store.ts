import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { postMobileDeScam48000 } from "@/lib/blog/posts/mobile-de-scam-48000";
import type { BlogBlock, BlogPost, BlogPostLocale } from "@/lib/blog/types";

const RELATIVE_DIR = ".data/blog-posts";
const BLOB_PATHNAME = "blog-posts/index.json";

type PostsIndexDoc = {
  version: 1;
  updatedAt: string;
  posts: BlogPost[];
};

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, "index.json");
}

function emptyDoc(): PostsIndexDoc {
  return { version: 1, updatedAt: new Date().toISOString(), posts: [] };
}

export function normalizeBlogSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function isBlogBlock(raw: unknown): raw is BlogBlock {
  if (!raw || typeof raw !== "object") return false;
  const b = raw as Record<string, unknown>;
  if (b.type === "p" || b.type === "h2" || b.type === "callout") {
    return typeof b.text === "string";
  }
  if (b.type === "stats") {
    return (
      Array.isArray(b.rows) &&
      b.rows.every(
        (r) =>
          !!r &&
          typeof r === "object" &&
          typeof (r as { label?: unknown }).label === "string" &&
          typeof (r as { value?: unknown }).value === "string",
      )
    );
  }
  return false;
}

function normalizeLocale(raw: unknown): BlogPostLocale | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const excerpt = typeof o.excerpt === "string" ? o.excerpt.trim() : "";
  if (!title) return null;
  const body = Array.isArray(o.body) ? o.body.filter(isBlogBlock) : [];
  const socialExcerpt =
    typeof o.socialExcerpt === "string" && o.socialExcerpt.trim() ? o.socialExcerpt.trim() : undefined;
  return { title, excerpt, body, ...(socialExcerpt ? { socialExcerpt } : {}) };
}

function normalizePost(raw: unknown): BlogPost | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slug = normalizeBlogSlug(typeof o.slug === "string" ? o.slug : "");
  if (!slug) return null;
  const lv = normalizeLocale(o.lv);
  if (!lv) return null;
  const publishedAt =
    typeof o.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.publishedAt.trim())
      ? o.publishedAt.trim()
      : new Date().toISOString().slice(0, 10);
  const category = typeof o.category === "string" && o.category.trim() ? o.category.trim() : "Vispārīgi";
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
    : [];
  const en = normalizeLocale(o.en) ?? undefined;
  return { slug, publishedAt, category, tags, lv, ...(en ? { en } : {}) };
}

function parseDoc(raw: string): PostsIndexDoc {
  try {
    const p = JSON.parse(raw) as Partial<PostsIndexDoc>;
    const posts = Array.isArray(p.posts)
      ? p.posts.map(normalizePost).filter((x): x is BlogPost => !!x)
      : [];
    return {
      version: 1,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
      posts,
    };
  } catch {
    return emptyDoc();
  }
}

async function readFromBlob(token: string): Promise<PostsIndexDoc | null> {
  try {
    const res = await get(BLOB_PATHNAME, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseDoc(text);
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, doc: PostsIndexDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc, null, 2), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<PostsIndexDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseDoc(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: PostsIndexDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
  await fs.rename(tmp, fp);
}

async function writeDoc(doc: PostsIndexDoc): Promise<void> {
  const token = blobToken();
  if (token) {
    await writeToBlob(token, doc);
    try {
      await writeToFilesystem(doc);
    } catch {
      /* ignore */
    }
    return;
  }
  await writeToFilesystem(doc);
}

function seedDoc(): PostsIndexDoc {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    posts: [postMobileDeScam48000],
  };
}

async function readDoc(): Promise<PostsIndexDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob && fromBlob.posts.length > 0) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  if (fromFs && fromFs.posts.length > 0) return fromFs;

  /* Pirmo reizi — iesējam esošo static ierakstu un saglabājam. */
  const seeded = seedDoc();
  try {
    await writeDoc(seeded);
  } catch {
    /* ja rakstīšana neizdodas, tomēr atgriežam seed lasīšanai */
  }
  return seeded;
}

export async function listStoredBlogPosts(): Promise<BlogPost[]> {
  const doc = await readDoc();
  return [...doc.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getStoredBlogPost(slug: string): Promise<BlogPost | null> {
  const s = normalizeBlogSlug(slug);
  if (!s) return null;
  const doc = await readDoc();
  return doc.posts.find((p) => p.slug === s) ?? null;
}

export async function upsertStoredBlogPost(input: BlogPost): Promise<BlogPost> {
  const post = normalizePost(input);
  if (!post) throw new Error("Nederīgs bloga ieraksts.");
  const doc = await readDoc();
  const idx = doc.posts.findIndex((p) => p.slug === post.slug);
  if (idx >= 0) doc.posts[idx] = post;
  else doc.posts.push(post);
  doc.updatedAt = new Date().toISOString();
  await writeDoc(doc);
  return post;
}

export async function deleteStoredBlogPost(slug: string): Promise<boolean> {
  const s = normalizeBlogSlug(slug);
  if (!s) return false;
  const doc = await readDoc();
  const before = doc.posts.length;
  doc.posts = doc.posts.filter((p) => p.slug !== s);
  if (doc.posts.length === before) return false;
  doc.updatedAt = new Date().toISOString();
  await writeDoc(doc);
  return true;
}

export function emptyBlogPostDraft(partial?: Partial<BlogPost>): BlogPost {
  const today = new Date().toISOString().slice(0, 10);
  return {
    slug: normalizeBlogSlug(partial?.slug ?? `jauns-ieraksts-${Date.now()}`) || `jauns-ieraksts-${Date.now()}`,
    publishedAt: partial?.publishedAt ?? today,
    category: partial?.category ?? "Vispārīgi",
    tags: partial?.tags ?? [],
    lv: {
      title: partial?.lv?.title ?? "Jauns ieraksts",
      excerpt: partial?.lv?.excerpt ?? "",
      body: partial?.lv?.body?.length
        ? partial.lv.body
        : [{ type: "p", text: "" }],
    },
  };
}
