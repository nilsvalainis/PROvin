"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";

const STROKE = 1.6;

export function IrissSludinajumiScrimPanel({
  open,
  onClose,
  title,
  subtitle,
  widthClass,
  side,
  headerRight,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass: string;
  side: "right" | "center";
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  useAdminScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <AdminBodyPortal>
      <div className="iriss-slud fixed inset-0 z-[60]">
        <button type="button" aria-label="Aizvērt" className="absolute inset-0 bg-black/35" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`absolute ${side === "right" ? "top-0 right-0 h-full" : "top-1/2 left-1/2 max-h-[min(90dvh,720px)] -translate-x-1/2 -translate-y-1/2"} ${widthClass} flex flex-col overflow-hidden bg-[var(--slud-s1,#fff)] shadow-[var(--slud-shadow)] ${side === "right" ? "" : "rounded-[24px]"}`}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
            <div className="min-w-0">
              <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[13px] text-[var(--slud-ink2)]">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerRight}
              <button type="button" aria-label="Aizvērt" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--slud-fill)]">
                <X className="h-4 w-4" strokeWidth={STROKE} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
        </div>
      </div>
    </AdminBodyPortal>
  );
}
