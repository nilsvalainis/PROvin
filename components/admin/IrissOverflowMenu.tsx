"use client";

import { MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

const MENU_MIN_WIDTH = 248;
const MENU_GAP = 6;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
}

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

export function IrissOverflowMenu({
  label = "Vairāk",
  align = "end",
  triggerClassName,
  triggerRef,
  children,
}: {
  label?: string;
  align?: "start" | "end";
  triggerClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; vars: CSSProperties } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerElRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => setMounted(true), []);

  function place() {
    const el = triggerElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left =
      align === "start"
        ? Math.min(Math.max(8, r.left), window.innerWidth - MENU_MIN_WIDTH - 8)
        : Math.min(Math.max(8, r.right - MENU_MIN_WIDTH), window.innerWidth - MENU_MIN_WIDTH - 8);
    setPos({
      top: r.bottom + MENU_GAP,
      left,
      vars: copyThemeVars(el),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onWin = () => place();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
  }, [open]);

  const menu =
    open && mounted && pos
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="iriss-ov-menu iriss-ov-menu-portal fixed z-[200] min-w-[15.5rem] overflow-hidden rounded-2xl bg-[var(--s1,#fff)] py-1 text-[var(--ink,#0b0c10)] shadow-[var(--gsh,0_8px_22px_rgba(16,24,40,0.12))]"
            style={{ top: pos.top, left: pos.left, ...pos.vars }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={(node) => {
          triggerElRef.current = node;
          assignRef(triggerRef, node);
        }}
        type="button"
        className={
          triggerClassName ??
          "iriss-ov-trigger inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--fill)]"
        }
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {menu}
    </div>
  );
}

export function IrissOverflowItem({
  children,
  onClick,
  href,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const cls = `iriss-ov-item flex min-h-11 w-full items-center px-3.5 text-left text-[14px] font-medium ${
    tone === "danger" ? "text-[var(--bad)]" : "text-[var(--ink,#0b0c10)]"
  } hover:bg-[var(--fill)] disabled:opacity-40`;
  if (href) {
    return (
      <a role="menuitem" href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function IrissOverflowLabel({ children }: { children: ReactNode }) {
  return <p className="px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">{children}</p>;
}
