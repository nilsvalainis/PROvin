import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { B2bDemoIsolationError, assertSameTenant, rejectForeignTenantId } from "@/lib/b2b-demo-isolation";
import {
  applyB2bDemoOrderPatch,
  createB2bDemoOrder,
  type B2bDemoOrderInput,
} from "@/lib/b2b-demo-orders";
import {
  B2B_DEMO_INDEX_PATH,
  assertB2bDemoStoragePath,
  b2bDemoTenantDataPath,
} from "@/lib/b2b-demo-paths";
import {
  createMemoryB2bDemoRepository,
  emptyB2bDemoIndex,
  emptyB2bDemoTenantDocument,
  parseB2bDemoIndex,
  parseB2bDemoTenantDocument,
  type B2bDemoRepository,
} from "@/lib/b2b-demo-repository";
import { applyB2bDemoSettingsPatch, type B2bDemoSettingsPatch } from "@/lib/b2b-demo-settings";
import {
  canManageB2bDemoUsers,
  canWriteB2bDemoSettings,
  createB2bDemoUser,
  listPublicB2bDemoUsers,
  newB2bDemoTenantId,
} from "@/lib/b2b-demo-users";
import { isSafeB2bDemoSlug, isSafeB2bDemoTenantId, normalizeB2bDemoEmail, normalizeB2bDemoSlug } from "@/lib/b2b-demo-ids";
import { toPublicB2bDemoUser, type B2bDemoEncryptedAuctionSession, type B2bDemoIndex, type B2bDemoOrder, type B2bDemoRole, type B2bDemoSettings, type B2bDemoTenant, type B2bDemoTenantDocument, type B2bDemoUser, type B2bDemoUserPublic } from "@/lib/b2b-demo-types";

const RELATIVE_DIR = ".data/b2b-demo";

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

async function readBlobText(pathname: string, token: string): Promise<string | null> {
  const safe = assertB2bDemoStoragePath(pathname);
  try {
    const res = await get(safe, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return await new Response(res.stream).text();
  } catch {
    return null;
  }
}

async function writeBlobText(pathname: string, token: string, body: string): Promise<void> {
  const safe = assertB2bDemoStoragePath(pathname);
  await put(safe, body, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function filesystemPath(pathname: string): string {
  const safe = assertB2bDemoStoragePath(pathname);
  return path.join(process.cwd(), RELATIVE_DIR, safe);
}

async function readFsText(pathname: string): Promise<string | null> {
  try {
    return await fs.readFile(filesystemPath(pathname), "utf8");
  } catch {
    return null;
  }
}

async function writeFsText(pathname: string, body: string): Promise<void> {
  const fp = filesystemPath(pathname);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, fp);
}

export function createFsBlobB2bDemoRepository(): B2bDemoRepository {
  return {
    async readIndex() {
      const token = blobToken();
      if (token) {
        const fromBlob = await readBlobText(B2B_DEMO_INDEX_PATH, token);
        if (fromBlob) return parseB2bDemoIndex(fromBlob);
      }
      const fromFs = await readFsText(B2B_DEMO_INDEX_PATH);
      return fromFs ? parseB2bDemoIndex(fromFs) : emptyB2bDemoIndex();
    },
    async writeIndex(doc) {
      const next = { ...doc, updatedAt: new Date().toISOString() };
      const body = JSON.stringify(next);
      const token = blobToken();
      if (token) {
        await writeBlobText(B2B_DEMO_INDEX_PATH, token, body);
        try {
          await writeFsText(B2B_DEMO_INDEX_PATH, body);
        } catch {
          /* ignore local mirror */
        }
        return;
      }
      await writeFsText(B2B_DEMO_INDEX_PATH, body);
    },
    async readTenant(tenantId) {
      if (!isSafeB2bDemoTenantId(tenantId)) return null;
      const pathname = b2bDemoTenantDataPath(tenantId);
      const token = blobToken();
      if (token) {
        const fromBlob = await readBlobText(pathname, token);
        if (fromBlob) return parseB2bDemoTenantDocument(fromBlob, tenantId);
      }
      const fromFs = await readFsText(pathname);
      return fromFs ? parseB2bDemoTenantDocument(fromFs, tenantId) : null;
    },
    async writeTenant(doc) {
      const pathname = b2bDemoTenantDataPath(doc.tenant.tenantId);
      const body = JSON.stringify(doc);
      const token = blobToken();
      if (token) {
        await writeBlobText(pathname, token, body);
        try {
          await writeFsText(pathname, body);
        } catch {
          /* ignore */
        }
        return;
      }
      await writeFsText(pathname, body);
    },
  };
}

let defaultRepo: B2bDemoRepository | null = null;

export function getB2bDemoRepository(): B2bDemoRepository {
  if (!defaultRepo) defaultRepo = createFsBlobB2bDemoRepository();
  return defaultRepo;
}

/** Tests only. */
export function setB2bDemoRepositoryForTests(repo: B2bDemoRepository | null): void {
  defaultRepo = repo;
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

function repo(explicit?: B2bDemoRepository): B2bDemoRepository {
  return explicit ?? getB2bDemoRepository();
}

export async function readB2bDemoTenant(
  tenantId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoTenantDocument | null> {
  const doc = await repo(r).readTenant(tenantId);
  if (!doc) return null;
  assertSameTenant(doc.tenant, tenantId);
  return doc;
}

export async function lookupB2bDemoUserByEmail(
  email: string,
  r?: B2bDemoRepository,
): Promise<{ tenant: B2bDemoTenantDocument; user: B2bDemoUser } | null> {
  const key = normalizeB2bDemoEmail(email);
  const index = await repo(r).readIndex();
  const hit = index.emailIndex[key];
  if (!hit) return null;
  const doc = await readB2bDemoTenant(hit.tenantId, r);
  if (!doc) return null;
  const user = doc.users.find((u) => u.userId === hit.userId && u.email === key);
  if (!user || user.tenantId !== doc.tenant.tenantId) return null;
  return { tenant: doc, user };
}

export async function createB2bDemoTenantWithOwner(
  input: {
    name: string;
    slug?: string;
    ownerEmail: string;
    ownerName: string;
    ownerPassword: string;
  },
  r?: B2bDemoRepository,
): Promise<{ tenant: B2bDemoTenant; owner: B2bDemoUser }> {
  return withLock(async () => {
    const store = repo(r);
    const index = await store.readIndex();
    const ownerEmail = normalizeB2bDemoEmail(input.ownerEmail);
    if (index.emailIndex[ownerEmail]) {
      throw new Error("Šis e-pasts jau ir reģistrēts.");
    }
    const now = new Date().toISOString();
    const tenantId = newB2bDemoTenantId();
    const slug = normalizeB2bDemoSlug(input.slug || input.name || tenantId);
    if (!isSafeB2bDemoSlug(slug) && slug.length < 3) {
      throw new Error("Nederīgs dīlera slugs.");
    }
    if (index.tenants.some((t) => t.slug === slug)) {
      throw new Error("Šāds dīlera identifikators jau pastāv.");
    }
    const tenant: B2bDemoTenant = {
      tenantId,
      slug: isSafeB2bDemoSlug(slug) ? slug : tenantId.replace("tnt_", "d-"),
      name: input.name.trim().slice(0, 160) || "Dīleris",
      createdAt: now,
      updatedAt: now,
    };
    const owner = createB2bDemoUser({
      tenantId,
      email: ownerEmail,
      name: input.ownerName,
      role: "owner",
      password: input.ownerPassword,
      now,
    });
    const doc = emptyB2bDemoTenantDocument(tenant);
    doc.users = [owner];
    await store.writeTenant(doc);
    const nextIndex: B2bDemoIndex = {
      ...index,
      updatedAt: now,
      tenants: [...index.tenants, { tenantId, slug: tenant.slug, name: tenant.name }],
      emailIndex: { ...index.emailIndex, [ownerEmail]: { tenantId, userId: owner.userId } },
    };
    await store.writeIndex(nextIndex);
    return { tenant, owner };
  });
}

export async function listB2bDemoTenantOrders(
  tenantId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoOrder[]> {
  const doc = await readB2bDemoTenant(tenantId, r);
  if (!doc) return [];
  return [...doc.orders]
    .filter((o) => o.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getB2bDemoTenantOrder(
  tenantId: string,
  orderId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoOrder | null> {
  const doc = await readB2bDemoTenant(tenantId, r);
  if (!doc) return null;
  const order = doc.orders.find((o) => o.orderId === orderId) ?? null;
  if (!order) return null;
  return assertSameTenant(order, tenantId);
}

export async function addB2bDemoTenantOrder(
  tenantId: string,
  input: B2bDemoOrderInput,
  r?: B2bDemoRepository,
): Promise<B2bDemoOrder> {
  return withLock(async () => {
    const store = repo(r);
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    assertSameTenant(doc.tenant, tenantId);
    const order = createB2bDemoOrder(tenantId, input);
    doc.orders.push(order);
    doc.tenant.updatedAt = order.updatedAt;
    await store.writeTenant(doc);
    return order;
  });
}

export async function patchB2bDemoTenantOrder(
  tenantId: string,
  orderId: string,
  patch: Partial<B2bDemoOrderInput>,
  r?: B2bDemoRepository,
): Promise<B2bDemoOrder> {
  return withLock(async () => {
    const store = repo(r);
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    const idx = doc.orders.findIndex((o) => o.orderId === orderId);
    if (idx < 0) throw new Error("Pasūtījums nav atrasts.");
    const next = applyB2bDemoOrderPatch(doc.orders[idx]!, tenantId, patch);
    doc.orders[idx] = next;
    doc.tenant.updatedAt = next.updatedAt;
    await store.writeTenant(doc);
    return next;
  });
}

export async function readB2bDemoTenantSettings(
  tenantId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoSettings | null> {
  const doc = await readB2bDemoTenant(tenantId, r);
  if (!doc) return null;
  return assertSameTenant(doc.settings, tenantId);
}

export async function writeB2bDemoTenantSettings(
  tenantId: string,
  role: B2bDemoRole,
  patch: B2bDemoSettingsPatch,
  requestedTenantId?: unknown,
  r?: B2bDemoRepository,
): Promise<B2bDemoSettings> {
  if (!canWriteB2bDemoSettings(role)) {
    throw new B2bDemoIsolationError("Tikai īpašnieks var mainīt iestatījumus.");
  }
  rejectForeignTenantId(requestedTenantId, tenantId);
  return withLock(async () => {
    const store = repo(r);
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    doc.settings = applyB2bDemoSettingsPatch(doc.settings, tenantId, patch);
    doc.tenant.updatedAt = doc.settings.updatedAt;
    await store.writeTenant(doc);
    return doc.settings;
  });
}

export async function listB2bDemoTenantUsers(
  tenantId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoUserPublic[]> {
  const doc = await readB2bDemoTenant(tenantId, r);
  if (!doc) return [];
  return listPublicB2bDemoUsers(doc.users, tenantId);
}

export async function addB2bDemoTenantEmployee(
  tenantId: string,
  role: B2bDemoRole,
  input: { email: string; name: string; password: string },
  r?: B2bDemoRepository,
): Promise<B2bDemoUserPublic> {
  if (!canManageB2bDemoUsers(role)) {
    throw new B2bDemoIsolationError("Tikai īpašnieks var pievienot lietotājus.");
  }
  return withLock(async () => {
    const store = repo(r);
    const index = await store.readIndex();
    const email = normalizeB2bDemoEmail(input.email);
    if (index.emailIndex[email]) throw new Error("Šis e-pasts jau ir reģistrēts.");
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    const user = createB2bDemoUser({
      tenantId,
      email,
      name: input.name,
      role: "employee",
      password: input.password,
    });
    doc.users.push(user);
    doc.tenant.updatedAt = user.updatedAt;
    await store.writeTenant(doc);
    index.emailIndex[email] = { tenantId, userId: user.userId };
    index.updatedAt = user.updatedAt;
    await store.writeIndex(index);
    return toPublicB2bDemoUser(user);
  });
}

export async function upsertB2bDemoAuctionSession(
  tenantId: string,
  row: B2bDemoEncryptedAuctionSession,
  r?: B2bDemoRepository,
): Promise<B2bDemoEncryptedAuctionSession> {
  assertSameTenant(row, tenantId);
  return withLock(async () => {
    const store = repo(r);
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    const rest = doc.auctionSessions.filter((s) => s.platform !== row.platform);
    doc.auctionSessions = [...rest, row];
    doc.tenant.updatedAt = row.updatedAt;
    await store.writeTenant(doc);
    return row;
  });
}

export async function clearB2bDemoAuctionSession(
  tenantId: string,
  platform: B2bDemoEncryptedAuctionSession["platform"],
  r?: B2bDemoRepository,
): Promise<void> {
  return withLock(async () => {
    const store = repo(r);
    const doc = await store.readTenant(tenantId);
    if (!doc) throw new Error("Tenants nav atrasts.");
    doc.auctionSessions = doc.auctionSessions.filter((s) => s.platform !== platform);
    doc.tenant.updatedAt = new Date().toISOString();
    await store.writeTenant(doc);
  });
}

export async function listB2bDemoAuctionSessions(
  tenantId: string,
  r?: B2bDemoRepository,
): Promise<B2bDemoEncryptedAuctionSession[]> {
  const doc = await readB2bDemoTenant(tenantId, r);
  if (!doc) return [];
  return doc.auctionSessions.filter((s) => s.tenantId === tenantId);
}

export async function tenantCount(r?: B2bDemoRepository): Promise<number> {
  const index = await repo(r).readIndex();
  return index.tenants.length;
}

export { createMemoryB2bDemoRepository };
