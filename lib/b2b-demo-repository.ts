import { emptyB2bDemoSettings, parseB2bDemoSettings } from "@/lib/b2b-demo-settings";
import { parseB2bDemoOrder } from "@/lib/b2b-demo-orders";
import { parseB2bDemoUser } from "@/lib/b2b-demo-users";
import { assertB2bDemoStoragePath, b2bDemoTenantDataPath } from "@/lib/b2b-demo-paths";
import { isSafeB2bDemoTenantId, isSafeB2bDemoUserId, normalizeB2bDemoEmail } from "@/lib/b2b-demo-ids";
import { isB2bDemoAuctionPlatform, type B2bDemoEncryptedAuctionSession, type B2bDemoIndex, type B2bDemoTenant, type B2bDemoTenantDocument } from "@/lib/b2b-demo-types";

export type B2bDemoRepository = {
  readIndex(): Promise<B2bDemoIndex>;
  writeIndex(doc: B2bDemoIndex): Promise<void>;
  readTenant(tenantId: string): Promise<B2bDemoTenantDocument | null>;
  writeTenant(doc: B2bDemoTenantDocument): Promise<void>;
  deleteTenantStorage(tenantId: string): Promise<void>;
};

export function removeTenantFromB2bDemoIndex(
  index: B2bDemoIndex,
  tenantId: string,
  now = new Date().toISOString(),
): B2bDemoIndex {
  if (!isSafeB2bDemoTenantId(tenantId)) {
    throw new Error("Nederīgs tenant_id.");
  }
  const emailIndex: B2bDemoIndex["emailIndex"] = {};
  for (const [email, entry] of Object.entries(index.emailIndex)) {
    if (entry.tenantId === tenantId) continue;
    emailIndex[email] = entry;
  }
  return {
    version: 1,
    updatedAt: now,
    tenants: index.tenants.filter((t) => t.tenantId !== tenantId),
    emailIndex,
  };
}

export function emptyB2bDemoIndex(now = new Date().toISOString()): B2bDemoIndex {
  return { version: 1, updatedAt: now, tenants: [], emailIndex: {} };
}

export function emptyB2bDemoTenantDocument(tenant: B2bDemoTenant): B2bDemoTenantDocument {
  return {
    version: 1,
    tenant,
    users: [],
    settings: emptyB2bDemoSettings(tenant.tenantId, tenant.updatedAt),
    orders: [],
    auctionSessions: [],
  };
}

function parseAuctionRow(raw: unknown, tenantId: string): B2bDemoEncryptedAuctionSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  const platform = o.platform;
  if (recordTenant !== tenantId || !isB2bDemoAuctionPlatform(platform)) return null;
  const ciphertext = typeof o.ciphertext === "string" ? o.ciphertext : "";
  const iv = typeof o.iv === "string" ? o.iv : "";
  const authTag = typeof o.authTag === "string" ? o.authTag : "";
  const wrappedDek = typeof o.wrappedDek === "string" ? o.wrappedDek : "";
  const wrapIv = typeof o.wrapIv === "string" ? o.wrapIv : "";
  const wrapAuthTag = typeof o.wrapAuthTag === "string" ? o.wrapAuthTag : "";
  if (!ciphertext || !iv || !authTag || !wrappedDek || !wrapIv || !wrapAuthTag) return null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!createdAt) return null;
  return {
    tenantId: recordTenant,
    platform,
    ciphertext,
    iv,
    authTag,
    wrappedDek,
    wrapIv,
    wrapAuthTag,
    createdAt,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : createdAt,
    expiresAt: typeof o.expiresAt === "string" ? o.expiresAt : null,
  };
}

export function parseB2bDemoIndex(raw: string): B2bDemoIndex {
  try {
    const p = JSON.parse(raw) as Partial<B2bDemoIndex>;
    const tenants = Array.isArray(p.tenants)
      ? p.tenants.filter(
          (t): t is B2bDemoIndex["tenants"][number] =>
            Boolean(t && isSafeB2bDemoTenantId(t.tenantId) && typeof t.slug === "string" && typeof t.name === "string"),
        )
      : [];
    const emailIndex: B2bDemoIndex["emailIndex"] = {};
    if (p.emailIndex && typeof p.emailIndex === "object") {
      for (const [email, entry] of Object.entries(p.emailIndex)) {
        if (!entry || typeof entry !== "object") continue;
        const tenantId = typeof entry.tenantId === "string" ? entry.tenantId : "";
        const userId = typeof entry.userId === "string" ? entry.userId : "";
        const key = normalizeB2bDemoEmail(email);
        if (key && isSafeB2bDemoTenantId(tenantId) && isSafeB2bDemoUserId(userId)) {
          emailIndex[key] = { tenantId, userId };
        }
      }
    }
    return {
      version: 1,
      updatedAt: typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
      tenants,
      emailIndex,
    };
  } catch {
    return emptyB2bDemoIndex();
  }
}

export function parseB2bDemoTenantDocument(raw: string, tenantId: string): B2bDemoTenantDocument | null {
  try {
    const p = JSON.parse(raw) as Partial<B2bDemoTenantDocument>;
    const tenant = p.tenant;
    if (!tenant || tenant.tenantId !== tenantId || !isSafeB2bDemoTenantId(tenant.tenantId)) return null;
    const users = Array.isArray(p.users)
      ? p.users.map((u) => parseB2bDemoUser(u, tenantId)).filter((u): u is NonNullable<typeof u> => Boolean(u))
      : [];
    const orders = Array.isArray(p.orders)
      ? p.orders.map((o) => parseB2bDemoOrder(o, tenantId)).filter((o): o is NonNullable<typeof o> => Boolean(o))
      : [];
    const auctionSessions = Array.isArray(p.auctionSessions)
      ? p.auctionSessions
          .map((s) => parseAuctionRow(s, tenantId))
          .filter((s): s is B2bDemoEncryptedAuctionSession => Boolean(s))
      : [];
    return {
      version: 1,
      tenant: {
        tenantId: tenant.tenantId,
        slug: typeof tenant.slug === "string" ? tenant.slug : tenant.tenantId,
        name: typeof tenant.name === "string" ? tenant.name : "",
        createdAt: typeof tenant.createdAt === "string" ? tenant.createdAt : new Date().toISOString(),
        updatedAt: typeof tenant.updatedAt === "string" ? tenant.updatedAt : new Date().toISOString(),
      },
      users,
      settings: parseB2bDemoSettings(p.settings, tenantId),
      orders,
      auctionSessions,
    };
  } catch {
    return null;
  }
}

export function createMemoryB2bDemoRepository(): B2bDemoRepository {
  let index = emptyB2bDemoIndex();
  const tenants = new Map<string, string>();
  return {
    async readIndex() {
      return structuredClone(index);
    },
    async writeIndex(doc) {
      index = structuredClone(doc);
    },
    async readTenant(tenantId) {
      const raw = tenants.get(tenantId);
      if (!raw) return null;
      const path = b2bDemoTenantDataPath(tenantId);
      assertB2bDemoStoragePath(path);
      return parseB2bDemoTenantDocument(raw, tenantId);
    },
    async writeTenant(doc) {
      const path = b2bDemoTenantDataPath(doc.tenant.tenantId);
      assertB2bDemoStoragePath(path);
      tenants.set(doc.tenant.tenantId, JSON.stringify(doc));
    },
    async deleteTenantStorage(tenantId) {
      const path = b2bDemoTenantDataPath(tenantId);
      assertB2bDemoStoragePath(path);
      tenants.delete(tenantId);
    },
  };
}
