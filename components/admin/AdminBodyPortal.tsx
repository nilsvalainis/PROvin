"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";

export function AdminBodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/**
 * Mobilā lapa portālā ārpus `backdrop-filter` galvenes (WebKit fixed saturošais bloks).
 * Desktop popover paliek pie pogas.
 */
export function AdminAnchoredSheet({
  open,
  onClose,
  closeLabel,
  sheetId,
  mobileClassName,
  desktopClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  sheetId: string;
  mobileClassName: string;
  desktopClassName: string;
  children: () => ReactNode;
}) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [open]);
  useAdminScrollLock(open && narrow);
  if (!open) return null;
  return (
    <>
      <AdminBodyPortal>
        <div className="sm:hidden" data-admin-list-sheet={sheetId}>
          <button
            type="button"
            aria-label={closeLabel}
            className="fixed inset-0 z-30 bg-black/38"
            onClick={onClose}
          />
          <div className={mobileClassName}>{children()}</div>
        </div>
      </AdminBodyPortal>
      <div className={desktopClassName}>{children()}</div>
    </>
  );
}
