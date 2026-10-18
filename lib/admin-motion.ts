/** Admin kustības palīgi. Tikai transform/opacity; bez smagām bibliotēkām. */

export const ADMIN_MOTION_D_MICRO_MS = 120;
export const ADMIN_MOTION_D_STD_MS = 220;
export const ADMIN_MOTION_D_STD_L_MS = 250;
export const ADMIN_MOTION_D_SHEET_MS = 340;
export const ADMIN_MOTION_D_PUSH_MS = 340;
export const ADMIN_MOTION_D_STAGGER_MS = 30;
export const ADMIN_MOTION_WILL_CHANGE_MS = 300;
export const ADMIN_MOTION_SHEET_OUT_MS = 220;
export const ADMIN_MOTION_TAB_FADE_MS = 150;

export const ADMIN_MOTION_MOVING_CLASS = "admin-moving";

export type AdminViewTransitionDir = "push" | "pop" | "tab";

export type MorphPillParts = {
  left: string;
  mid: string;
  right: string;
  capWidth: number;
};

const DETAIL_PATH =
  /^\/admin\/(?:iriss\/pasutijumi|orders|konsultacijas|commission-invoice|partneri|atras-vertesanas)\/[^/]+/;

export function prefersReducedMotion(matchMediaImpl?: (query: string) => { matches: boolean }): boolean {
  const mm = matchMediaImpl ?? (typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined);
  if (!mm) return false;
  try {
    return mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 3 daļu kapsula: gali ar translateX, vidus ar translateX + scaleX. Platumu neanimē. */
export function morphPillParts(x: number, w: number, h: number): MorphPillParts {
  const cap = Math.max(1, h / 2);
  const midScale = Math.max(0.01, (w - h + 2) / 2);
  return {
    left: `translateX(${x}px)`,
    mid: `translateX(${x + cap - 1}px) scaleX(${midScale})`,
    right: `translateX(${x + w - cap}px)`,
    capWidth: cap,
  };
}

const movingTimers = new WeakMap<Element, number>();

export function markMoving(el: Element, ms = ADMIN_MOTION_WILL_CHANGE_MS): void {
  el.classList.add(ADMIN_MOTION_MOVING_CLASS);
  const prev = movingTimers.get(el);
  if (typeof window !== "undefined" && prev) window.clearTimeout(prev);
  if (typeof window === "undefined") return;
  const id = window.setTimeout(() => {
    el.classList.remove(ADMIN_MOTION_MOVING_CLASS);
    movingTimers.delete(el);
  }, prefersReducedMotion() ? 1 : ms);
  movingTimers.set(el, id);
}

export function applyMorphPill(pill: HTMLElement, x: number, w: number, h: number): MorphPillParts {
  const parts = morphPillParts(x, w, h);
  const kids = pill.children;
  const left = kids.item(0) as HTMLElement | null;
  const mid = kids.item(1) as HTMLElement | null;
  const right = kids.item(2) as HTMLElement | null;
  if (left) {
    left.style.width = `${parts.capWidth}px`;
    left.style.transform = parts.left;
  }
  if (mid) mid.style.transform = parts.mid;
  if (right) {
    right.style.width = `${parts.capWidth}px`;
    right.style.transform = parts.right;
  }
  markMoving(pill);
  return parts;
}

export function viewTransitionDir(fromPath: string, toPath: string): AdminViewTransitionDir {
  const fromDetail = DETAIL_PATH.test(fromPath);
  const toDetail = DETAIL_PATH.test(toPath);
  if (!fromDetail && toDetail) return "push";
  if (fromDetail && !toDetail) return "pop";
  return "tab";
}

export function isModifiedClick(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

type ViewTransitionLike = { finished: Promise<unknown> };

function hasStartViewTransition(doc: Document): doc is Document & {
  startViewTransition: (cb: () => void) => ViewTransitionLike;
} {
  return typeof (doc as Document & { startViewTransition?: unknown }).startViewTransition === "function";
}

/** VT tikai tad, ja tas ir lēts: nav reduced-motion, API ir, lapa nav smagā darba zona. */
export function shouldUseAdminViewTransition(
  doc?: Document,
  matchMediaImpl?: (query: string) => { matches: boolean },
): boolean {
  if (prefersReducedMotion(matchMediaImpl)) return false;
  const d = doc ?? (typeof document !== "undefined" ? document : undefined);
  if (!d || !hasStartViewTransition(d)) return false;
  if (d.getElementById("admin-order-block-auto-records")) return false;
  if (d.querySelector("[data-iriss-order-room='1']")) return false;
  return true;
}

export function startAdminViewTransition(
  update: () => void,
  dir: AdminViewTransitionDir,
  doc?: Document,
  matchMediaImpl?: (query: string) => { matches: boolean },
): void {
  const d = doc ?? (typeof document !== "undefined" ? document : undefined);
  if (!d || !shouldUseAdminViewTransition(d, matchMediaImpl) || !hasStartViewTransition(d)) {
    update();
    return;
  }
  const cls = `admin-vt-${dir}`;
  d.documentElement.classList.add(cls);
  try {
    const t = d.startViewTransition(() => {
      update();
    });
    void t.finished.finally(() => {
      d.documentElement.classList.remove(cls);
    });
  } catch {
    d.documentElement.classList.remove(cls);
    update();
  }
}

/** Viena mijiedarbības soļa izmaksas (ms). Mērīšanai, ne UI. */
export function measureInteractionCost(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}
