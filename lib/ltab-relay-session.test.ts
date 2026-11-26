import { describe, expect, it } from "vitest";

import { createLtabSessionState } from "@/relay/provin-ltab/lib/session-state.mjs";

describe("LTAB releja Smart-ID sesijas stāvoklis (GET /ltab/session)", () => {
  it("pēc starta - logged_out (bez login), aktīvs tikai pēc veiksmīga uzdevuma", () => {
    let t = Date.parse("2026-11-26T10:00:00Z");
    const s = createLtabSessionState({ ttlMs: 20 * 60_000, now: () => t });
    expect(s.view().state).toBe("logged_out");
    s.onProgress("awaiting_smartid", { verificationCode: "1234" });
    expect(s.view()).toMatchObject({ state: "awaiting_smartid", verificationCode: "1234" });
    s.onProgress("searching", {});
    s.onSuccess();
    expect(s.view().state).toBe("active");
    expect(s.view().verificationCode).toBeUndefined();
    t += 21 * 60_000;
    expect(s.view().state).toBe("expired");
  });

  it("Smart-ID atteikts / taimauts vai /logout - logged_out; citas kļūdas sesiju nenoņem", () => {
    const s = createLtabSessionState({ ttlMs: 20 * 60_000 });
    s.onSuccess();
    s.onError("page_changed");
    expect(s.view().state).toBe("active");
    s.onError("smartid_timeout");
    expect(s.view()).toMatchObject({ state: "logged_out", lastError: "smartid_timeout" });
    s.onSuccess();
    s.onLogout();
    expect(s.view().state).toBe("logged_out");
  });

  it("skatā nav personas koda vai citu noslēpumu, tikai e.csdd formas lauki", () => {
    const s = createLtabSessionState({});
    s.onProgress("awaiting_smartid", { verificationCode: "12345", personalCode: "010101-12345" });
    const keys = Object.keys(s.view()).sort();
    expect(keys.every((k) => ["state", "verificationCode", "activeSince", "lastOkAt", "lastLookupAt", "lastError", "updatedAt"].includes(k))).toBe(true);
    expect(JSON.stringify(s.view())).not.toContain("010101");
    expect(s.view().verificationCode).toBeUndefined();
  });
});
