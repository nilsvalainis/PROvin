import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { randomUUID } from "crypto";

const RELATIVE_DIR = ".data/listing-peeks";
const FILENAME = "index.json";
const BLOB_PATHNAME = "listing-peeks/index.json";

/** Legacy field — jauni ieraksti bez lokācijas. */
export type ListingPeekLocation = "lv" | "abroad";

export type ListingPeekStatus = "new" | "in_progress" | "completed" | "rejected";

export type ListingPeekEntry = {
  id: string;
  email: string;
  phone: string;
  listingUrl: string;
  /** @deprecated Nav formā; vecie ieraksti var saturēt. */
  location?: ListingPeekLocation;
  createdAt: string;
  status: ListingPeekStatus;
  source: "risk_audit_guide" | "listing_peek";
};

type ListingPeekDoc = {
  version: 1;
  updatedAt: string;
  entries: ListingPeekEntry[];
};

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

/** Operatora testkontakti — bez 7 dienu / kontaktlimits. */
const LISTING_PEEK_RATE_LIMIT_EXEMPT_EMAILS = new Set(["nils.valainis@gmail.com"]);
const LISTING_PEEK_RATE_LIMIT_EXEMPT_PHONE_KEYS = new Set(["26123193"]);

export function normalizePeekEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Salīdzināšanai: tikai cipari, pēdējie 8 (+371 / atstarpes nesvarīgas). */
export function normalizePeekPhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 8) return digits;
  return digits.slice(-8);
}

export function isListingPeekRateLimitExempt(email: string, phone: string): boolean {
  if (LISTING_PEEK_RATE_LIMIT_EXEMPT_EMAILS.has(normalizePeekEmail(email))) return true;
  const phoneKey = normalizePeekPhoneKey(phone);
  return phoneKey.length > 0 && LISTING_PEEK_RATE_LIMIT_EXEMPT_PHONE_KEYS.has(phoneKey);
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
  if (!id || !email || !listingUrl || !createdAt || !isStatus(o.status)) {
    return null;
  }
  const source =
    o.source === "listing_peek" || o.source === "risk_audit_guide" ? o.source : "listing_peek";
  return {
    id,
    email,
    phone,
    listingUrl,
    ...(isLocation(o.location) ? { location: o.location } : {}),
    createdAt,
    status: o.status,
    source,
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
      reason: "contact_rate_limited";
      retryAfterSec: number;
    };

export async function createListingPeek(input: {
  email: string;
  phone: string;
  listingUrl: string;
}): Promise<CreateListingPeekResult> {
  const email = normalizePeekEmail(input.email);
  const phone = input.phone.trim();
  const phoneKey = normalizePeekPhoneKey(phone);
  const listingUrl = input.listingUrl.trim();
  const now = Date.now();
  const doc = await readDoc();
  const exempt = isListingPeekRateLimitExempt(email, phone);

  if (!exempt) {
    const lastForEmail = doc.entries
      .filter((e) => e.email === email)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

    if (lastForEmail) {
      const lastMs = Date.parse(lastForEmail.createdAt);
      if (Number.isFinite(lastMs) && now - lastMs < COOLDOWN_MS) {
        return {
          ok: false,
          reason: "contact_rate_limited",
          retryAfterSec: cooldownRetryAfterSec(lastMs, now),
        };
      }
    }

    if (phoneKey.length >= 8) {
      const lastForPhone = doc.entries
        .filter((e) => e.phone && normalizePeekPhoneKey(e.phone) === phoneKey)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

      if (lastForPhone) {
        const lastMs = Date.parse(lastForPhone.createdAt);
        if (Number.isFinite(lastMs) && now - lastMs < COOLDOWN_MS) {
          return {
            ok: false,
            reason: "contact_rate_limited",
            retryAfterSec: cooldownRetryAfterSec(lastMs, now),
          };
        }
      }
    }
  }

  const entry: ListingPeekEntry = {
    id: randomUUID(),
    email,
    phone,
    listingUrl,
    createdAt: new Date(now).toISOString(),
    status: "new",
    source: "listing_peek",
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

export async function getListingPeekById(id: string): Promise<ListingPeekEntry | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const doc = await readDoc();
  return doc.entries.find((e) => e.id === trimmed) ?? null;
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
