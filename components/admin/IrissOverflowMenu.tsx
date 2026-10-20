"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function IrissOverflowMenu({
  label = "Vairāk",
  align = "end",
  triggerClassName,
  children,
}: {
  label?: string;
  align?: "start" | "end";
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node) || !rootRef.current?.contains(t)) setOpen(false);
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

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
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
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`iriss-ov-menu absolute top-[calc(100%+6px)] z-50 min-w-[15.5rem] overflow-hidden rounded-2xl bg-[var(--s1)] py-1 shadow-[var(--gsh)] ${
            align === "start" ? "left-0" : "right-0"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
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
    tone === "danger" ? "text-[var(--bad)]" : "text-[var(--ink)]"
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
