/**
 * Admin login aizsarga krātuve: viens mazs JSON dokuments uz kontu (lietotājvārda hash) Blob ar CAS.
 * Krātuves kļūda nekad neaptur pieteikšanos (paliek atmiņas rate limit).
 */
import "server-only";

import { createHash } from "node:crypto";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  checkAdminLoginGuard,
  emptyAdminLoginGuardDoc,
  parseAdminLoginGuardDoc,
  recordAdminLoginFailure,
  type AdminLoginGuardCheck,
  type AdminLoginGuardDoc,
} from "@/lib/admin-login-guard";

const store = createJsonDocStore<AdminLoginGuardDoc>({
  blobPrefix: "admin-login-guard/",
  dirName: "admin-login-guard",
  isSafeKey: (key) => /^[a-f0-9]{32}$/.test(key),
  parse: parseAdminLoginGuardDoc,
  empty: emptyAdminLoginGuardDoc,
});

export function adminLoginGuardKey(username: string): string {
  return createHash("sha256").update(`admin-login:${username.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export async function readAdminLoginGuard(username: string): Promise<AdminLoginGuardCheck> {
  try {
    return checkAdminLoginGuard(await store.read(adminLoginGuardKey(username)), Date.now());
  } catch (err) {
    console.error("[admin-login-guard] read failed", err instanceof Error ? err.message : "unknown");
    return { allowed: true, delayMs: 0 };
  }
}

export async function noteAdminLoginFailure(username: string): Promise<void> {
  try {
    await store.update(adminLoginGuardKey(username), (cur) => {
      const next = recordAdminLoginFailure(cur, Date.now());
      return { value: undefined, next };
    });
  } catch (err) {
    console.error("[admin-login-guard] write failed", err instanceof Error ? err.message : "unknown");
  }
}

/** Pēc veiksmīgas pieteikšanās: notīra skaitītāju (raksta tikai, ja bija neveiksmes). */
export async function clearAdminLoginGuard(username: string): Promise<void> {
  try {
    await store.update(adminLoginGuardKey(username), (cur) =>
      cur.failures > 0 || cur.lockedUntil ? { value: undefined, next: emptyAdminLoginGuardDoc() } : { value: undefined },
    );
  } catch (err) {
    console.error("[admin-login-guard] clear failed", err instanceof Error ? err.message : "unknown");
  }
}
