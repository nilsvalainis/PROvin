"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Desktop: centrēts modālais logs. Mobilajā: pilnekrāna lapa. */
export function B2bPartnerDialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, button, select, textarea")?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100svh] w-full flex-col overflow-y-auto bg-[#0b0d12] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))] font-sans text-zinc-100 sm:h-auto sm:max-h-[min(44rem,calc(100svh-3rem))] sm:max-w-[27rem] sm:rounded-[0.6rem] sm:border sm:border-white/12 sm:px-7 sm:py-7 sm:shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[1.15rem] font-semibold leading-snug tracking-[-0.015em] text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            className="-mr-1 -mt-1 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
