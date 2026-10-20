import { describe, expect, it } from "vitest";
import {
  ADMIN_GOOGLE_SESSION_IDLE_MS,
  decideSubPin,
  emptyAdminGoogleState,
  isAdminGoogleSessionLive,
  parseAdminGoogleState,
  type AdminGoogleState,
} from "@/lib/admin-google-sessions";
import type { AdminGoogleSessionPayload } from "@/lib/admin-session-token";

const SUB = "110000000000000000001";
const now = Date.parse("2026-10-21T12:00:00Z");

function state(over: Partial<AdminGoogleState> = {}): AdminGoogleState {
  return {
    ...emptyAdminGoogleState(),
    pinnedSub: SUB,
    sessionVersion: 3,
    sessions: [
      {
        id: "ags_1",
        sub: SUB,
        createdAt: new Date(now - 1000).toISOString(),
        lastSeenAt: new Date(now - 1000).toISOString(),
        ip: "1.1.1.1",
        userAgent: "ua",
        revokedAt: null,
      },
    ],
    ...over,
  };
}

const payload: AdminGoogleSessionPayload = {
  typ: "admin",
  exp: now + 1000,
  via: "google",
  sid: "ags_1",
  sub: SUB,
  ver: 3,
  email: "info@provin.lv",
};

describe("isAdminGoogleSessionLive", () => {
  it("accepts a live session", () => {
    expect(isAdminGoogleSessionLive(state(), payload, now)).toBe(true);
  });
  it("rejects a different sub than the pinned one", () => {
    expect(isAdminGoogleSessionLive(state(), { ...payload, sub: "999" }, now)).toBe(false);
  });
  it("rejects when nothing is pinned", () => {
    expect(isAdminGoogleSessionLive(state({ pinnedSub: null }), payload, now)).toBe(false);
  });
  it("rejects after logout-all (session version bump)", () => {
    expect(isAdminGoogleSessionLive(state({ sessionVersion: 4 }), payload, now)).toBe(false);
  });
  it("rejects a revoked session", () => {
    const s = state();
    s.sessions[0]!.revokedAt = new Date(now).toISOString();
    expect(isAdminGoogleSessionLive(s, payload, now)).toBe(false);
  });
  it("rejects an unknown session id", () => {
    expect(isAdminGoogleSessionLive(state(), { ...payload, sid: "ags_x" }, now)).toBe(false);
  });
  it("rejects after 30 days idle, accepts just before", () => {
    const s = state();
    s.sessions[0]!.lastSeenAt = new Date(now - ADMIN_GOOGLE_SESSION_IDLE_MS - 1).toISOString();
    expect(isAdminGoogleSessionLive(s, payload, now)).toBe(false);
    s.sessions[0]!.lastSeenAt = new Date(now - ADMIN_GOOGLE_SESSION_IDLE_MS + 60_000).toISOString();
    expect(isAdminGoogleSessionLive(s, payload, now)).toBe(true);
  });
});

describe("decideSubPin", () => {
  it("pins the first successful sub", () => {
    expect(decideSubPin(emptyAdminGoogleState(), SUB, "")).toEqual({ ok: true, pin: true });
  });
  it("requires the pinned sub afterwards", () => {
    expect(decideSubPin(state(), SUB, "")).toEqual({ ok: true, pin: false });
    expect(decideSubPin(state(), "other", "")).toEqual({ ok: false, reason: "sub_mismatch" });
  });
  it("env ADMIN_GOOGLE_SUB pre-pins", () => {
    expect(decideSubPin(emptyAdminGoogleState(), "other", SUB)).toEqual({ ok: false, reason: "sub_mismatch" });
    expect(decideSubPin(emptyAdminGoogleState(), SUB, SUB)).toEqual({ ok: true, pin: true });
  });
});

describe("parseAdminGoogleState", () => {
  it("tolerates garbage and keeps a valid version", () => {
    expect(parseAdminGoogleState(null)).toEqual(emptyAdminGoogleState());
    expect(parseAdminGoogleState({ sessionVersion: -2, sessions: [{}], pinnedSub: 5 }).sessionVersion).toBe(1);
  });
});
