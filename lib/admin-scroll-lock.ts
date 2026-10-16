"use client";

import { useEffect } from "react";

export const ADMIN_SCROLL_LOCK_CLASS = "admin-scroll-locked";
export const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";

export type AdminScrollLockTarget = {
  classList: { add(token: string): void; remove(token: string): void };
  scrollTop: number;
};

export type AdminScrollLockEnv = {
  html: AdminScrollLockTarget;
  mainScroll: AdminScrollLockTarget | null;
};

type SavedScroll = { html: number; main: number };

let depth = 0;
let saved: SavedScroll | null = null;
let envOverride: AdminScrollLockEnv | null = null;

export function adminScrollLockDepth(): number {
  return depth;
}

/** Testu vide injicē DOM. `null` atgriež īsto `document`. */
export function setAdminScrollLockEnvForTests(env: AdminScrollLockEnv | null): void {
  envOverride = env;
  depth = 0;
  saved = null;
}

function currentEnv(): AdminScrollLockEnv | null {
  if (envOverride) return envOverride;
  if (typeof document === "undefined") return null;
  const main = document.getElementById(ADMIN_MAIN_SCROLL_ID);
  return {
    html: document.documentElement,
    mainScroll: main,
  };
}

/**
 * Atsauču skaitītājs: vairāki pārklājumi var būt atvērti vienlaikus.
 * Klase `admin-scroll-locked` uz `html` un `#admin-main-scroll` (CSS !important),
 * nevis `body.style.overflow`, ko admin tēma pārraksta.
 * Atgriež atbrīvošanas funkciju. Pēdējais atbrīvojums atjauno `scrollTop`.
 */
export function acquireAdminScrollLock(): () => void {
  const env = currentEnv();
  depth += 1;
  if (depth === 1 && env) {
    saved = {
      html: env.html.scrollTop,
      main: env.mainScroll?.scrollTop ?? 0,
    };
    env.html.classList.add(ADMIN_SCROLL_LOCK_CLASS);
    env.mainScroll?.classList.add(ADMIN_SCROLL_LOCK_CLASS);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth > 0) return;
    const live = currentEnv();
    live?.html.classList.remove(ADMIN_SCROLL_LOCK_CLASS);
    live?.mainScroll?.classList.remove(ADMIN_SCROLL_LOCK_CLASS);
    if (saved && live) {
      live.html.scrollTop = saved.html;
      if (live.mainScroll) live.mainScroll.scrollTop = saved.main;
    }
    saved = null;
  };
}

export function useAdminScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return acquireAdminScrollLock();
  }, [open]);
}
