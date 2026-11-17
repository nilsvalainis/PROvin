"use client";

import { useEffect, useId, type ReactNode } from "react";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { useVisualViewportHeight } from "@/lib/use-visual-viewport-height";

/**
 * Modālis, kas strādā arī telefonā (Nils 07.11: tiesību logs nebija ritināms, pogas nesasniedzamas).
 * - Telefonā apakšējā lapa, datorā centrēts logs.
 * - Augstums nepārsniedz redzamo logu (arī ar atvērtu tastatūru, `visualViewport`).
 * - Galvene un pogas vienmēr redzamas; saturs ritinās iekšā.
 * - Drošā zona (iPhone mājas josla), lapas ritināšana aiz loga bloķēta, Escape aizver.
 */
export function AdminResponsiveModal({
  open,
  title,
  onClose,
  footer,
  children,
  maxWidthClass = "sm:max-w-md",
  zClass = "z-50",
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  maxWidthClass?: string;
  zClass?: string;
}) {
  const titleId = useId();
  const vvh = useVisualViewportHeight(open);
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
    <div
      className={`fixed inset-0 ${zClass} flex items-end justify-center bg-[#0f172a66] sm:items-center sm:p-4`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-admin-responsive-modal
        onClick={(e) => e.stopPropagation()}
        style={vvh ? { maxHeight: `${Math.max(240, vvh - 8)}px` } : undefined}
        className={`flex max-h-[calc(100dvh-0.5rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-[24px] bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px] ${maxWidthClass}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#F3F4F6] py-1 pl-5 pr-1">
          <h2 id={titleId} className="min-w-0 text-[18px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[22px] leading-none text-[var(--iriss-ink-2)]"
            aria-label="Aizvērt"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#F3F4F6] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
