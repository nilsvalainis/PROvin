import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 18 bytes = 144 bit entropy; URL-safe base64url (~24 chars). */
const TOKEN_BYTES = 18;

export function newClientLinkToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashClientLinkToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function clientLinkHashesEqual(storedHash: string, candidateHash: string): boolean {
  const a = Buffer.from(storedHash.trim(), "hex");
  const b = Buffer.from(candidateHash.trim(), "hex");
  return a.length === 32 && a.length === b.length && timingSafeEqual(a, b);
}
