import { describe, expect, it } from "vitest";

import {
  ADMIN_LOGIN_GUARD_LOCK_AFTER,
  ADMIN_LOGIN_GUARD_LOCK_MS,
  ADMIN_LOGIN_GUARD_WINDOW_MS,
  checkAdminLoginGuard,
  emptyAdminLoginGuardDoc,
  parseAdminLoginGuardDoc,
  recordAdminLoginFailure,
} from "@/lib/admin-login-guard";

describe("admin login aizsargs (kopīgs visām instancēm)", () => {
  const t0 = Date.parse("2026-11-23T10:00:00Z");

  it("pirmās 2 neveiksmes bez aiztures, tad aizture aug", () => {
    let doc = emptyAdminLoginGuardDoc();
    expect(checkAdminLoginGuard(doc, t0)).toEqual({ allowed: true, delayMs: 0 });
    doc = recordAdminLoginFailure(doc, t0);
    doc = recordAdminLoginFailure(doc, t0);
    expect(checkAdminLoginGuard(doc, t0)).toEqual({ allowed: true, delayMs: 0 });
    doc = recordAdminLoginFailure(doc, t0);
    expect(checkAdminLoginGuard(doc, t0)).toEqual({ allowed: true, delayMs: 500 });
    doc = recordAdminLoginFailure(doc, t0);
    expect(checkAdminLoginGuard(doc, t0)).toEqual({ allowed: true, delayMs: 1000 });
  });

  it("bloķē pēc 10 neveiksmēm uz 15 min, pēc tam atkal atļauj", () => {
    let doc = emptyAdminLoginGuardDoc();
    for (let i = 0; i < ADMIN_LOGIN_GUARD_LOCK_AFTER; i++) doc = recordAdminLoginFailure(doc, t0 + i);
    const locked = checkAdminLoginGuard(doc, t0 + 1000);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) expect(locked.retryAfterSec).toBeGreaterThan(800);
    const later = checkAdminLoginGuard(doc, t0 + ADMIN_LOGIN_GUARD_LOCK_MS + ADMIN_LOGIN_GUARD_WINDOW_MS);
    expect(later).toEqual({ allowed: true, delayMs: 0 });
  });

  it("vecas neveiksmes ārpus loga aizmirst", () => {
    let doc = recordAdminLoginFailure(emptyAdminLoginGuardDoc(), t0);
    doc = recordAdminLoginFailure(doc, t0);
    doc = recordAdminLoginFailure(doc, t0);
    const fresh = recordAdminLoginFailure(doc, t0 + ADMIN_LOGIN_GUARD_WINDOW_MS + 1);
    expect(fresh.failures).toBe(1);
  });

  it("bojāts dokuments -> tukšs", () => {
    expect(parseAdminLoginGuardDoc({ failures: "x" })).toEqual(emptyAdminLoginGuardDoc());
    expect(parseAdminLoginGuardDoc(null)).toEqual(emptyAdminLoginGuardDoc());
  });
});
