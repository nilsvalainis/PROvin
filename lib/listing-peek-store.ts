import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { randomUUID } from "crypto";

const RELATIVE_DIR = ".data/listing-peeks";
const FILENAME = "index.json";
const BLOB_PATHNAME = "listing-peeks/index.json";

export type ListingPeekLocation = "lv" | "abroad";

export type ListingPeekStatus = "new" | "in_progress" | "completed" | "rejected";

export type ListingPeekEntry = {
  id: string;
  email: string;
  phone: string;
  listingUrl: string;
  location: ListingPeekLocation;
  createdAt: string;
  status: ListingPeekStatus;
  source: "risk_audit_guide";
};

type ListingPeekDoc = {
  version: 1;
  updatedAt: string;
  entries: ListingPeekEntry[];
};

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizePeekEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Salīdzināšanai: host lowercase, bez hash, bez tipiskiem tracking parametriem. */
export function normalizePeekListingUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

function cooldownRetryAfterSec(lastMs: number, now: number): number {
  return Math.max(1, Math.ceil((COOLDOWN_MS - (now - lastMs)) / 1000));
}

function emptyDoc(): ListingPeekDoc {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function isLocation(v: unknown): v is ListingPeekLocation {
  return v === "lv" || v === "abroad";
}

function isStatus(v: unknown): v is ListingPeekStatus {
  return v === "new" || v === "in_progress" || v === "completed" || v === "rejected";
}

function parseEntry(raw: unknown): ListingPeekEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ListingPeekEntry>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null;
  const email = typeof o.email === "string" ? normalizePeekEmail(o.email) : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : "";
  const listingUrl = typeof o.listingUrl === "string" ? o.listingUrl.trim() : "";
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : null;
  if (!id || !email || !listingUrl || !createdAt || !isLocation(o.location) || !isStatus(o.status)) {
    return null;
  }
  return {
    id,
    email,
    phone,
    listingUrl,
    location: o.location,
    createdAt,
    status: o.status,
    source: "risk_audit_guide",
  };
}

function parseDoc(raw: string): ListingPeekDoc {
  try {
    const p = JSON.parse(raw) as Partial<ListingPeekDoc>;
    const entries: ListingPeekEntry[] = [];
    if (Array.isArray(p.entries)) {
      for (const item of p.entries) {
        const entry = parseEntry(item);
        if (entry) entries.push(entry);
      }
    }
    return {
      version: 1,
      updatedAt:
        typeof p.updatedAt === "string" && p.updatedAt.trim()
          ? p.updatedAt.trim()
          : new Date().toISOString(),
      entries,
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

async function readFromBlob(token: string): Promise<ListingPeekDoc | null> {
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

async function writeToBlob(token: string, doc: ListingPeekDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<ListingPeekDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseDoc(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: ListingPeekDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, fp);
}

async function readDoc(): Promise<ListingPeekDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  return fromFs ?? emptyDoc();
}

async function writeDoc(doc: ListingPeekDoc): Promise<void> {
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

export type CreateListingPeekResult =
  | { ok: true; entry: ListingPeekEntry }
  | {
      ok: false;
      reason: "email_rate_limited" | "listing_rate_limited";
      retryAfterSec: number;
    };

export async function createListingPeek(input: {
  email: string;
  phone: string;
  listingUrl: string;
  location: ListingPeekLocation;
}): Promise<CreateListingPeekResult> {
  const email = normalizePeekEmail(input.email);
  const phone = input.phone.trim();
  const listingUrl = input.listingUrl.trim();
  const listingKey = normalizePeekListingUrl(listingUrl);
  const now = Date.now();
  const doc = await readDoc();

  const lastForEmail = doc.entries
    .filter((e) => e.email === email)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  if (lastForEmail) {
    const lastMs = Date.parse(lastForEmail.createdAt);
    if (Number.isFinite(lastMs) && now - lastMs < COOLDOWN_MS) {
      return {
        ok: false,
        reason: "email_rate_limited",
        retryAfterSec: cooldownRetryAfterSec(lastMs, now),
      };
    }
  }

  const lastForListing = doc.entries
    .filter((e) => normalizePeekListingUrl(e.listingUrl) === listingKey)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  if (lastForListing) {
    const lastMs = Date.parse(lastForListing.createdAt);
    if (Number.isFinite(lastMs) && now - lastMs < COOLDOWN_MS) {
      return {
        ok: false,
        reason: "listing_rate_limited",
        retryAfterSec: cooldownRetryAfterSec(lastMs, now),
      };
    }
  }

  const entry: ListingPeekEntry = {
    id: randomUUID(),
    email,
    phone,
    listingUrl,
    location: input.location,
    createdAt: new Date(now).toISOString(),
    status: "new",
    source: "risk_audit_guide",
  };

  doc.entries = [entry, ...doc.entries].slice(0, MAX_ENTRIES);
  doc.updatedAt = entry.createdAt;
  await writeDoc(doc);
  return { ok: true, entry };
}

export async function listListingPeeks(limit = 100): Promise<ListingPeekEntry[]> {
  const doc = await readDoc();
  return doc.entries
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

export async function updateListingPeekStatus(
  id: string,
  status: ListingPeekStatus,
): Promise<ListingPeekEntry | null> {
  const trimmed = id.trim();
  if (!trimmed || !isStatus(status)) return null;
  const doc = await readDoc();
  const idx = doc.entries.findIndex((e) => e.id === trimmed);
  if (idx < 0) return null;
  const next = { ...doc.entries[idx], status };
  doc.entries[idx] = next;
  doc.updatedAt = new Date().toISOString();
  await writeDoc(doc);
  return next;
}
