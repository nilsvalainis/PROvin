/**
 * `/listings/health` ir publisks caur Caddy. Bez derīga Bearer atdodam tikai `{ ok: true }`
 * (uptime pārbaudēm pietiek), ar derīgu tokenu pilno skatu (skaitītāji, lastError, discoveredApis).
 * Tīras funkcijas bez tīkla, testējamas ar node:test.
 */
import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <token>` salīdzinājums konstantā laikā. Tukšs gaidītais tokens nekad neder. */
export function bearerTokenMatches(authorizationHeader, expectedToken) {
  const expected = String(expectedToken ?? "");
  if (!expected) return false;
  const header = String(authorizationHeader ?? "");
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Health atbildes ķermenis. `buildFull` izsauc tikai autorizētam pieprasījumam, lai detaļas
 * (un to aprēķins) neaiziet publiski.
 */
export async function healthResponseBody(authorized, buildFull) {
  if (!authorized) return { ok: true };
  return await buildFull();
}
