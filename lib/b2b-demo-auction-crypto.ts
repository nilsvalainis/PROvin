import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import { canB2bDemoAccessIrissOwnSessions } from "@/lib/b2b-demo-paths";
import {
  isB2bDemoAuctionPlatform,
  type B2bDemoAuctionPlatform,
  type B2bDemoAuctionSessionStatus,
  type B2bDemoEncryptedAuctionSession,
} from "@/lib/b2b-demo-types";

const PASSWORD_KEYS = ["password", "parole", "passwd", "secret", "pwd", "username", "user", "login"] as const;

export class B2bDemoAuctionSessionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "B2bDemoAuctionSessionError";
    this.code = code;
  }
}

function deriveTenantWrapKey(masterSecret: string, tenantId: string): Buffer {
  if (!isSafeB2bDemoTenantId(tenantId)) {
    throw new B2bDemoAuctionSessionError("tenant", "Nederīgs tenant_id.");
  }
  return createHash("sha256")
    .update(`b2b-demo-tenant-wrap|${tenantId}|${masterSecret}`, "utf8")
    .digest();
}

function assertNoPasswordMaterial(payload: unknown): void {
  if (payload == null) return;
  if (typeof payload === "string") {
    const lower = payload.toLowerCase();
    if (PASSWORD_KEYS.some((k) => lower.includes(`"${k}"`) || lower.includes(`${k}=`))) {
      throw new B2bDemoAuctionSessionError("password_forbidden", "Izsoļu paroles netiek pieņemtas un netiek glabātas.");
    }
    return;
  }
  if (typeof payload !== "object") return;
  const rec = payload as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (PASSWORD_KEYS.includes(key.toLowerCase() as (typeof PASSWORD_KEYS)[number])) {
      throw new B2bDemoAuctionSessionError("password_forbidden", "Izsoļu paroles netiek pieņemtas un netiek glabātas.");
    }
  }
}

export type B2bDemoAuctionSessionPlaintext = {
  /** Opaque dealer browser session (cookies / tokens). Never a password. */
  sessionBlob: string;
  capturedAt: string;
};

export function encryptB2bDemoAuctionSession(input: {
  tenantId: string;
  platform: B2bDemoAuctionPlatform;
  sessionBlob: string;
  masterSecret: string;
  now?: string;
  expiresAt?: string | null;
}): B2bDemoEncryptedAuctionSession {
  if (!canB2bDemoAccessIrissOwnSessions()) {
    /* ĪRISS releja profili paliek ārpus šī API. */
  }
  if (!isB2bDemoAuctionPlatform(input.platform)) {
    throw new B2bDemoAuctionSessionError("platform", "Neatbalstīta izsoļu platforma.");
  }
  const blob = input.sessionBlob.trim();
  if (!blob || blob.length > 80_000) {
    throw new B2bDemoAuctionSessionError("session", "Sesijas dati ir tukši vai pārāk gari.");
  }
  assertNoPasswordMaterial(blob);
  assertNoPasswordMaterial({ sessionBlob: blob });

  const now = input.now ?? new Date().toISOString();
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const plain = Buffer.from(
    JSON.stringify({ sessionBlob: blob, capturedAt: now } satisfies B2bDemoAuctionSessionPlaintext),
    "utf8",
  );
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const tenantKey = deriveTenantWrapKey(input.masterSecret, input.tenantId);
  const wrapIv = randomBytes(12);
  const wrapCipher = createCipheriv("aes-256-gcm", tenantKey, wrapIv);
  const wrappedDek = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapAuthTag = wrapCipher.getAuthTag();

  return {
    tenantId: input.tenantId,
    platform: input.platform,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    wrappedDek: wrappedDek.toString("base64"),
    wrapIv: wrapIv.toString("base64"),
    wrapAuthTag: wrapAuthTag.toString("base64"),
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt ?? null,
  };
}

export function decryptB2bDemoAuctionSession(
  row: B2bDemoEncryptedAuctionSession,
  tenantId: string,
  masterSecret: string,
): B2bDemoAuctionSessionPlaintext {
  assertSameTenant(row, tenantId);
  const tenantKey = deriveTenantWrapKey(masterSecret, tenantId);
  const wrapDecipher = createDecipheriv("aes-256-gcm", tenantKey, Buffer.from(row.wrapIv, "base64"));
  wrapDecipher.setAuthTag(Buffer.from(row.wrapAuthTag, "base64"));
  const dek = Buffer.concat([
    wrapDecipher.update(Buffer.from(row.wrappedDek, "base64")),
    wrapDecipher.final(),
  ]);
  const decipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plain) as B2bDemoAuctionSessionPlaintext;
  if (typeof parsed.sessionBlob !== "string") {
    throw new B2bDemoAuctionSessionError("decrypt", "Sesijas saturs nav derīgs.");
  }
  assertNoPasswordMaterial(parsed.sessionBlob);
  return parsed;
}

export function auctionSessionStatus(
  row: B2bDemoEncryptedAuctionSession | null,
  tenantId: string,
  platform: B2bDemoAuctionPlatform,
): B2bDemoAuctionSessionStatus {
  if (!row) {
    return { tenantId, platform, connected: false, updatedAt: null, expiresAt: null };
  }
  assertSameTenant(row, tenantId);
  return {
    tenantId,
    platform,
    connected: Boolean(row.ciphertext),
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
  };
}

export function rejectAuctionPasswordPayload(body: unknown): void {
  assertNoPasswordMaterial(body);
}

export function parseAuctionSessionWrite(body: unknown): { platform: B2bDemoAuctionPlatform; sessionBlob: string } {
  rejectAuctionPasswordPayload(body);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new B2bDemoAuctionSessionError("body", "Nederīgs pieprasījums.");
  }
  const rec = body as Record<string, unknown>;
  const platform = typeof rec.platform === "string" ? rec.platform.trim() : "";
  const sessionBlob = typeof rec.sessionBlob === "string" ? rec.sessionBlob : "";
  if (!isB2bDemoAuctionPlatform(platform)) {
    throw new B2bDemoAuctionSessionError("platform", "platform: openlane | auto1 | autobid");
  }
  if (!sessionBlob.trim()) {
    throw new B2bDemoAuctionSessionError("session", "Trūkst sessionBlob (ne parole).");
  }
  return { platform, sessionBlob };
}
