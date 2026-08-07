import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { normalizeBlogSlug } from "@/lib/blog/post-store";

const RELATIVE_DIR = ".data/blog-views";
const FILENAME = "index.json";
const BLOB_PATHNAME = "blog-views/index.json";

export type BlogViewEntry = {
  views: number;
  lastViewedAt: string | null;
};

type BlogViewsDoc = {
  version: 1;
  updatedAt: string;
  bySlug: Record<string, BlogViewEntry>;
};

function emptyDoc(): BlogViewsDoc {
  return { version: 1, updatedAt: new Date().toISOString(), bySlug: {} };
}

function parseEntry(raw: unknown): BlogViewEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<BlogViewEntry>;
  const views =
    typeof o.views === "number" && Number.isFinite(o.views) && o.views >= 0
      ? Math.floor(o.views)
      : 0;
  const lastViewedAt =
    typeof o.lastViewedAt === "string" && o.lastViewedAt.trim() ? o.lastViewedAt.trim() : null;
  return { views, lastViewedAt };
}

function parseDoc(raw: string): BlogViewsDoc {
  try {
    const p = JSON.parse(raw) as Partial<BlogViewsDoc>;
    const bySlug: Record<string, BlogViewEntry> = {};
    if (p.bySlug && typeof p.bySlug === "object") {
      for (const [key, value] of Object.entries(p.bySlug)) {
        const slug = normalizeBlogSlug(key);
        const entry = parseEntry(value);
        if (slug && entry) bySlug[slug] = entry;
      }
    }
    return {
      version: 1,
      updatedAt:
        typeof p.updatedAt === "string" && p.updatedAt.trim()
          ? p.updatedAt.trim()
          : new Date().toISOString(),
      bySlug,
    };
  } catch {
    return emptyDoc();
  }
}

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, FILENAME);
}

async function readFromBlob(token: string): Promise<BlogViewsDoc | null> {
  try {
    const res = await get(BLOB_PATHNAME, {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseDoc(text);
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, doc: BlogViewsDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<BlogViewsDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseDoc(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: BlogViewsDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, fp);
}

async function readDoc(): Promise<BlogViewsDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  return fromFs ?? emptyDoc();
}

async function writeDoc(doc: BlogViewsDoc): Promise<void> {
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

/** Visu slug skatījumu karte admin sarakstam. */
export async function getBlogViewCounts(): Promise<Record<string, number>> {
  const doc = await readDoc();
  const out: Record<string, number> = {};
  for (const [slug, entry] of Object.entries(doc.bySlug)) {
    out[slug] = entry.views;
  }
  return out;
}

export async function getBlogViewEntry(slug: string): Promise<BlogViewEntry> {
  const s = normalizeBlogSlug(slug);
  if (!s) return { views: 0, lastViewedAt: null };
  const doc = await readDoc();
  return doc.bySlug[s] ?? { views: 0, lastViewedAt: null };
}

/** Atomiski-ish +1 (read → write). Serverless konkurence var zaudēt dažus skatījumus. */
export async function incrementBlogView(slug: string): Promise<BlogViewEntry> {
  const s = normalizeBlogSlug(slug);
  if (!s) return { views: 0, lastViewedAt: null };

  const now = new Date().toISOString();
  const doc = await readDoc();
  const current = doc.bySlug[s] ?? { views: 0, lastViewedAt: null };
  const next: BlogViewEntry = {
    views: current.views + 1,
    lastViewedAt: now,
  };
  doc.bySlug[s] = next;
  doc.updatedAt = now;
  await writeDoc(doc);
  return next;
}
