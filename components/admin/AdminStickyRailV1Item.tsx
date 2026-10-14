"use client";

import type { ReactNode } from "react";

import { ADMIN_RAIL_V1_ITEM, ADMIN_RAIL_V1_ITEM_BTN, ADMIN_RAIL_V1_LABEL } from "@/lib/admin-sticky-rail-v1-styles";

type Base = {
  children: ReactNode;
  /** Zem ikonas; izlaiž ss.lv (tikai logo). */
  label?: string | null;
  title?: string;
};

export function AdminStickyRailV1Button({
  children,
  label,
  title,
  disabled,
  onClick,
  "aria-label": ariaLabel,
}: Base & {
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      className={ADMIN_RAIL_V1_ITEM_BTN}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? (label ? String(label) : title)}
    >
      {children}
      {label ? <span className={ADMIN_RAIL_V1_LABEL}>{label}</span> : null}
    </button>
  );
}

export function AdminStickyRailV1Link({
  children,
  label,
  title,
  href,
}: Base & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={ADMIN_RAIL_V1_ITEM_BTN}
      title={title ?? href}
      aria-label={label ?? "ss.lv"}
    >
      {children}
      {label ? <span className={ADMIN_RAIL_V1_LABEL}>{label}</span> : null}
    </a>
  );
}

export function AdminStickyRailV1Slot({ children, label, title }: Base) {
  return (
    <div className={ADMIN_RAIL_V1_ITEM} title={title}>
      {children}
      {label ? <span className={ADMIN_RAIL_V1_LABEL}>{label}</span> : null}
    </div>
  );
}
