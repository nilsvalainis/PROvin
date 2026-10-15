import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 18 baiti = 144 bit. base64url ir 24 rakstzīmes, vairāk nekā 16. */
const TOKEN_BYTES = 18;

export function newIrissOfferLinkToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashIrissOfferLinkToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function irissOfferLinkHashesEqual(storedHash: string, candidateHash: string): boolean {
  const a = Buffer.from(storedHash.trim(), "hex");
  const b = Buffer.from(candidateHash.trim(), "hex");
  return a.length === 32 && a.length === b.length && timingSafeEqual(a, b);
}

export function irissOfferLinkTokensEqual(stored: string, candidate: string): boolean {
  const a = Buffer.from(stored.trim(), "utf8");
  const b = Buffer.from(candidate.trim(), "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
