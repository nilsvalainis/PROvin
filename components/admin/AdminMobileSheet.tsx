"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
};

/** Mobilā apakšējā lapa. Desktop neredz (`md:hidden`). */
export function AdminMobileSheet({ open, title, onClose, children, action }: Props) {
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
    <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Aizvērt" className="absolute inset-0 bg-black/38" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[14px] bg-[#f2f2f7] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-9 rounded-full bg-[#c7c7cc]" aria-hidden />
        <h2 className="mb-3 text-center text-[17px] font-semibold text-[var(--color-apple-text)]">{title}</h2>
        {children}
        {action}
      </div>
    </div>
  );
}
