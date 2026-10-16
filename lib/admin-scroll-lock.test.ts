import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_SCROLL_LOCK_CLASS,
  acquireAdminScrollLock,
  adminScrollLockDepth,
  setAdminScrollLockEnvForTests,
  type AdminScrollLockTarget,
} from "@/lib/admin-scroll-lock";

function target(scrollTop = 0): AdminScrollLockTarget & { classes: Set<string> } {
  const classes = new Set<string>();
  return {
    classes,
    scrollTop,
    classList: {
      add(token: string) {
        classes.add(token);
      },
      remove(token: string) {
        classes.delete(token);
      },
    },
  };
}

afterEach(() => {
  setAdminScrollLockEnvForTests(null);
});

describe("acquireAdminScrollLock", () => {
  it("skaitītājs tur klasi, kamēr pēdējais pārklājums aizveras, un atjauno scrollTop", () => {
    const html = target(12);
    const mainScroll = target(240);
    setAdminScrollLockEnvForTests({ html, mainScroll });

    const releaseA = acquireAdminScrollLock();
    const releaseB = acquireAdminScrollLock();
    expect(adminScrollLockDepth()).toBe(2);
    expect(html.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(true);
    expect(mainScroll.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(true);

    mainScroll.scrollTop = 900;
    releaseA();
    expect(adminScrollLockDepth()).toBe(1);
    expect(mainScroll.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(true);
    expect(mainScroll.scrollTop).toBe(900);

    releaseB();
    expect(adminScrollLockDepth()).toBe(0);
    expect(html.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(false);
    expect(mainScroll.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(false);
    expect(mainScroll.scrollTop).toBe(240);
    expect(html.scrollTop).toBe(12);
  });

  it("atkārtots atbrīvojums skaitītāju neaizved zem nulles", () => {
    const html = target();
    setAdminScrollLockEnvForTests({ html, mainScroll: null });
    const release = acquireAdminScrollLock();
    release();
    release();
    expect(adminScrollLockDepth()).toBe(0);
    expect(html.classes.has(ADMIN_SCROLL_LOCK_CLASS)).toBe(false);
  });
});
