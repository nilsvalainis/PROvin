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

type FocusDoc = { activeElement: unknown };
type FocusRoot = { contains(node: unknown): boolean } | null | undefined;

/**
 * Aizverot lapu (sheet), kurā fokusā ir lauks (piem. auto meklēšana), vispirms noņem fokusu - tastatūra aizveras,
 * KAMĒR ritināšana vēl bloķēta. Citādi iOS Safari/Android pēc tastatūras aizvēršanas atstāj lapu nobīdītu un
 * formas apakšu nevar aizritināt (Pavadzīmes 19.11: pēc auto izvēles no saraksta). Atgriež true, ja fokuss noņemts.
 */
export function blurFocusWithin(root: FocusRoot, doc: FocusDoc | null = typeof document === "undefined" ? null : document): boolean {
  const active = doc?.activeElement as { blur?: () => void } | null | undefined;
  if (!root || !active || typeof active.blur !== "function" || !root.contains(active)) return false;
  active.blur();
  return true;
}

/**
 * Bloķē ritināšanu, kamēr `open`; atbrīvojot vispirms noņem fokusu no lauka `rootRef` iekšā (sk. blurFocusWithin),
 * tad atjauno ritināšanu un tās pozīciju.
 */
export function useAdminScrollLockBlurOnClose(open: boolean, rootRef: { readonly current: FocusRoot }): void {
  useEffect(() => {
    if (!open) return;
    const release = acquireAdminScrollLock();
    return () => {
      // Apzināti tagadējais mezgls: atverot portāls vēl nav uzzīmēts (ref tukšs), aizverot lapa vēl ir DOM (animācija).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      blurFocusWithin(rootRef.current);
      release();
    };
  }, [open, rootRef]);
}

export function useAdminScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return acquireAdminScrollLock();
  }, [open]);
}
