"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  IRISS_ANCHORED_POPOVER_Z,
  placeAnchoredPopover,
  type AnchoredPopoverAlign,
} from "@/lib/iriss-anchored-popover";

function copyThemeVars(from: HTMLElement): CSSProperties {
  const cs = getComputedStyle(from);
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ["--s1" as string]: pick("--s1", "#fff"),
    ["--ink" as string]: pick("--ink", "#0b0c10"),
    ["--ink3" as string]: pick("--ink3", "#63686f"),
    ["--fill" as string]: pick("--fill", "rgba(116, 120, 138, 0.11)"),
    ["--gsh" as string]: pick("--gsh", "0 8px 22px rgba(16, 24, 40, 0.12)"),
    ["--gb" as string]: pick("--gb", "rgba(17, 24, 39, 0.08)"),
    ["--bad" as string]: pick("--bad", "#c2362b"),
  };
}

export function IrissAnchoredPopover({
  open,
  onClose,
  anchorRef,
  align = "end",
  minWidth = 136,
  estimatedHeight = 168,
  className,
  role = "menu",
  id,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: AnchoredPopoverAlign;
  minWidth?: number;
  estimatedHeight?: number;
  className?: string;
  role?: string;
  id?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; vars: CSSProperties } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function place() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuEl = menuRef.current;
    const placed = placeAnchoredPopover({
      anchor: r,
      menu: {
        width: menuEl?.offsetWidth || minWidth,
        height: menuEl?.offsetHeight || estimatedHeight,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      align,
    });
    setPos({
      top: placed.top,
      left: placed.left,
      vars: copyThemeVars(el),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const onWin = () => place();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, align, minWidth, estimatedHeight]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) {
        onClose();
        return;
      }
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role={role}
      data-iriss-anchored-popover=""
      className={
        className ??
        "iriss-ov-menu iriss-ov-menu-portal fixed z-[200] min-w-[8.5rem] overflow-hidden rounded-2xl bg-[var(--s1,#fff)] py-1 text-[var(--ink,#0b0c10)] shadow-[var(--gsh,0_8px_22px_rgba(16,24,40,0.12))]"
      }
      style={{ top: pos.top, left: pos.left, zIndex: IRISS_ANCHORED_POPOVER_Z, ...pos.vars }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
