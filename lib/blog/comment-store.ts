import "server-only";

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import type { BlogCommentPublic } from "@/lib/blog/types";

const RELATIVE_DIR = ".data/blog-comments";
const BLOB_PREFIX = "blog-comments/";

type StoredComment = BlogCommentPublic & {
  /** Honeypot / spam — never shown. */
  hidden?: boolean;
};

type CommentsDoc = {
  slug: string;
  comments: StoredComment[];
  updatedAt: string;
};

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function blobPathname(slug: string): string {
  return `${BLOB_PREFIX}${slug}.json`;
}

function filesystemPath(slug: string): string {
  return path.join(process.cwd(), RELATIVE_DIR, `${slug}.json`);
}

function emptyDoc(slug: string): CommentsDoc {
  return { slug, comments: [], updatedAt: new Date().toISOString() };
}

function parseDoc(raw: string, slug: string): CommentsDoc {
  try {
    const p = JSON.parse(raw) as Partial<CommentsDoc>;
    const comments = Array.isArray(p.comments)
      ? p.comments.filter(
          (c): c is StoredComment =>
            !!c &&
            typeof c === "object" &&
            typeof (c as StoredComment).id === "string" &&
            typeof (c as StoredComment).authorName === "string" &&
            typeof (c as StoredComment).body === "string" &&
            typeof (c as StoredComment).createdAt === "string",
        )
      : [];
    return {
      slug,
      comments,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
    };
  } catch {
    return emptyDoc(slug);
  }
}

async function readFromBlob(token: string, slug: string): Promise<CommentsDoc | null> {
  try {
    const res = await get(blobPathname(slug), {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseDoc(text, slug);
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, slug: string, doc: CommentsDoc): Promise<void> {
  await put(blobPathname(slug), JSON.stringify(doc, null, 2), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(slug: string): Promise<CommentsDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(slug), "utf8");
    return parseDoc(raw, slug);
  } catch {
    return null;
  }
}

async function writeToFilesystem(slug: string, doc: CommentsDoc): Promise<void> {
  const fp = filesystemPath(slug);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
  await fs.rename(tmp, fp);
}

async function readDoc(slug: string): Promise<CommentsDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token, slug);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem(slug);
  return fromFs ?? emptyDoc(slug);
}

async function writeDoc(slug: string, doc: CommentsDoc): Promise<void> {
  const token = blobToken();
  if (token) {
    await writeToBlob(token, slug, doc);
    try {
      await writeToFilesystem(slug, doc);
    } catch {
      /* ignore */
    }
    return;
  }
  await writeToFilesystem(slug, doc);
}

export async function listPublicBlogComments(slug: string): Promise<BlogCommentPublic[]> {
  const doc = await readDoc(slug);
  return doc.comments
    .filter((c) => !c.hidden)
    .map(({ id, authorName, body, createdAt }) => ({ id, authorName, body, createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function appendBlogComment(input: {
  slug: string;
  authorName: string;
  body: string;
}): Promise<BlogCommentPublic> {
  const slug = input.slug.trim().toLowerCase();
  const authorName = input.authorName.trim().slice(0, 80);
  const body = input.body.trim().slice(0, 4000);
  const comment: StoredComment = {
    id: randomUUID(),
    authorName,
    body,
    createdAt: new Date().toISOString(),
  };

  const doc = await readDoc(slug);
  doc.comments.push(comment);
  doc.updatedAt = comment.createdAt;
  await writeDoc(slug, doc);

  return {
    id: comment.id,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}
