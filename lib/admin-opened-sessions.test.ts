import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_OPENED_SESSION_IDS_KEY,
  ADMIN_OPENED_SESSIONS_SEEDED_KEY,
  markSessionOpened,
  readOpenedSessionIds,
  seedOpenedSessionsIfFirstRun,
} from "@/lib/admin-opened-sessions";

function installWindowStorage(storage: Storage): void {
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() });
}

describe("admin-opened-sessions localStorage guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks and reads opened session ids", () => {
    const map = new Map<string, string>();
    installWindowStorage({
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
      setItem: (key, value) => {
        map.set(key, value);
      },
    });

    markSessionOpened("cs_test_1");
    expect(readOpenedSessionIds().has("cs_test_1")).toBe(true);
  });

  it("recovers from QuotaExceededError without throwing", () => {
    const map = new Map<string, string>();
    const quotaError = new DOMException("quota", "QuotaExceededError");
    let failOnce = true;

    installWindowStorage({
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
      setItem: (key, value) => {
        if (failOnce) {
          failOnce = false;
          throw quotaError;
        }
        map.set(key, value);
      },
    });

    expect(() => markSessionOpened("cs_recover")).not.toThrow();
    expect(readOpenedSessionIds().has("cs_recover")).toBe(true);
  });

  it("seedOpenedSessionsIfFirstRun does not set seeded flag when persist fails", () => {
    const map = new Map<string, string>();
    const quotaError = new DOMException("quota", "QuotaExceededError");

    installWindowStorage({
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
      setItem: (key, value) => {
        if (key === ADMIN_OPENED_SESSION_IDS_KEY) {
          throw quotaError;
        }
        map.set(key, value);
      },
    });

    expect(() => seedOpenedSessionsIfFirstRun(["cs_a", "cs_b"])).not.toThrow();
    expect(map.get(ADMIN_OPENED_SESSIONS_SEEDED_KEY)).toBeUndefined();
  });
});
