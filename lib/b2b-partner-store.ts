import "server-only";

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  isSafeB2bPartnerId,
  isUsablePartnerPassword,
  normalizePartnerEmail,
  normalizePartnerWriteInput,
  parsePartnerRecord,
  partnerFieldError,
  toPublicPartner,
  type B2bPartnerPublicProfile,
  type B2bPartnerRecord,
  type B2bPartnerStatus,
  type B2bPartnerWriteInput,
} from "@/lib/b2b-partner-account";
import { hashB2bPartnerPassword, verifyB2bPartnerPassword } from "@/lib/b2b-partner-password";

const RELATIVE_DIR = ".data/b2b-partners";
const FILENAME = "index.json";
const BLOB_PATHNAME = "b2b-partners/index.json";

type PartnerDoc = {
  version: 1;
  updatedAt: string;
  partners: B2bPartnerRecord[];
};

function emptyDoc(): PartnerDoc {
  return { version: 1, updatedAt: new Date().toISOString(), partners: [] };
}

function parseDoc(raw: string): PartnerDoc {
  try {
    const p = JSON.parse(raw) as Partial<PartnerDoc>;
    const partners: B2bPartnerRecord[] = [];
    if (Array.isArray(p.partners)) {
      for (const item of p.partners) {
        const row = parsePartnerRecord(item);
        if (row) partners.push(row);
      }
    }
    return {
      version: 1,
      updatedAt:
        typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
      partners,
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

async function readFromBlob(token: string): Promise<PartnerDoc | null> {
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

async function writeToBlob(token: string, doc: PartnerDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<PartnerDoc | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseDoc(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: PartnerDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, fp);
}

async function readDoc(): Promise<PartnerDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  return fromFs ?? emptyDoc();
}

async function writeDoc(doc: PartnerDoc): Promise<void> {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const token = blobToken();
  if (token) {
    await writeToBlob(token, next);
    try {
      await writeToFilesystem(next);
    } catch {
      /* ignore */
    }
    return;
  }
  await writeToFilesystem(next);
}

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function newPartnerId(): string {
  return `ptr_${randomBytes(8).toString("hex")}`;
}

export async function listB2bPartners(): Promise<B2bPartnerPublicProfile[]> {
  const doc = await readDoc();
  return doc.partners
    .map(toPublicPartner)
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "lv"));
}

export async function getB2bPartnerById(id: string): Promise<B2bPartnerRecord | null> {
  if (!isSafeB2bPartnerId(id)) return null;
  const doc = await readDoc();
  return doc.partners.find((p) => p.id === id) ?? null;
}

export async function getB2bPartnerByEmail(email: string): Promise<B2bPartnerRecord | null> {
  const key = normalizePartnerEmail(email);
  if (!key) return null;
  const doc = await readDoc();
  return doc.partners.find((p) => p.email === key) ?? null;
}

export type CreateB2bPartnerResult =
  | { ok: true; partner: B2bPartnerPublicProfile }
  | { ok: false; error: "invalid_fields" | "email_taken" | "weak_password" };

export async function createB2bPartner(
  input: B2bPartnerWriteInput,
  password: string,
): Promise<CreateB2bPartnerResult> {
  return withLock(async () => {
    const normalized = normalizePartnerWriteInput(input);
    if (partnerFieldError(normalized)) return { ok: false, error: "invalid_fields" };
    if (!isUsablePartnerPassword(password)) return { ok: false, error: "weak_password" };
    const doc = await readDoc();
    if (doc.partners.some((p) => p.email === normalized.email)) {
      return { ok: false, error: "email_taken" };
    }
    const now = new Date().toISOString();
    const record: B2bPartnerRecord = {
      id: newPartnerId(),
      ...normalized,
      passwordHash: hashB2bPartnerPassword(password.trim()),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    doc.partners.push(record);
    await writeDoc(doc);
    return { ok: true, partner: toPublicPartner(record) };
  });
}

export type UpdateB2bPartnerResult =
  | { ok: true; partner: B2bPartnerPublicProfile }
  | { ok: false; error: "not_found" | "invalid_fields" | "email_taken" | "weak_password" };

export async function updateB2bPartner(
  id: string,
  patch: Partial<B2bPartnerWriteInput> & { status?: B2bPartnerStatus; password?: string },
): Promise<UpdateB2bPartnerResult> {
  return withLock(async () => {
    if (!isSafeB2bPartnerId(id)) return { ok: false, error: "not_found" };
    const doc = await readDoc();
    const idx = doc.partners.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false, error: "not_found" };
    const prev = doc.partners[idx]!;
    const nextInput = normalizePartnerWriteInput({
      companyName: patch.companyName ?? prev.companyName,
      companyReg: patch.companyReg ?? prev.companyReg,
      companyAddress: patch.companyAddress ?? prev.companyAddress,
      contactName: patch.contactName ?? prev.contactName,
      email: patch.email ?? prev.email,
      phone: patch.phone ?? prev.phone,
    });
    if (partnerFieldError(nextInput)) return { ok: false, error: "invalid_fields" };
    if (doc.partners.some((p) => p.id !== id && p.email === nextInput.email)) {
      return { ok: false, error: "email_taken" };
    }
    if (patch.password != null && patch.password.trim()) {
      if (!isUsablePartnerPassword(patch.password)) return { ok: false, error: "weak_password" };
    }
    const status: B2bPartnerStatus = patch.status === "disabled" || patch.status === "active" ? patch.status : prev.status;
    const record: B2bPartnerRecord = {
      ...prev,
      ...nextInput,
      status,
      passwordHash:
        patch.password != null && patch.password.trim()
          ? hashB2bPartnerPassword(patch.password.trim())
          : prev.passwordHash,
      updatedAt: new Date().toISOString(),
    };
    doc.partners[idx] = record;
    await writeDoc(doc);
    return { ok: true, partner: toPublicPartner(record) };
  });
}

export async function authenticateB2bPartner(
  email: string,
  password: string,
): Promise<B2bPartnerRecord | null> {
  const partner = await getB2bPartnerByEmail(email);
  if (!partner || partner.status !== "active") return null;
  if (!verifyB2bPartnerPassword(password, partner.passwordHash)) return null;
  return partner;
}
