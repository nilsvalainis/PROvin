"use client";

import { MoreHorizontal } from "lucide-react";
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { IrissAnchoredPopover } from "@/components/admin/IrissAnchoredPopover";

const MENU_MIN_WIDTH = 248;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
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
  const triggerElRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  return (
    <div className="relative inline-flex">
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
      <IrissAnchoredPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerElRef}
        align={align}
        minWidth={MENU_MIN_WIDTH}
        estimatedHeight={220}
        id={menuId}
        className="iriss-ov-menu iriss-ov-menu-portal fixed z-[200] min-w-[15.5rem] overflow-hidden rounded-2xl bg-[var(--s1,#fff)] py-1 text-[var(--ink,#0b0c10)] shadow-[var(--gsh,0_8px_22px_rgba(16,24,40,0.12))]"
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          {children}
        </div>
      </IrissAnchoredPopover>
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
