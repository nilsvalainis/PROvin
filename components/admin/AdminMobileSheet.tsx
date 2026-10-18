"use client";

import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import {
  ADMIN_MOTION_SHEET_OUT_MS,
  ADMIN_MOTION_WILL_CHANGE_MS,
  markMoving,
  prefersReducedMotion,
} from "@/lib/admin-motion";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
};

/** Mobilā apakšējā lapa. Desktop neredz (`md:hidden`). */
export function AdminMobileSheet({ open, title, onClose, children, action }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; t: number; dy: number } | null>(null);
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);

  useAdminScrollLock(shown);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setClosing(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShown(true);
          if (panelRef.current) markMoving(panelRef.current, ADMIN_MOTION_WILL_CHANGE_MS);
        });
      });
      return () => cancelAnimationFrame(id);
    }
    if (!present) return;
    setShown(false);
    setClosing(true);
    if (panelRef.current) {
      panelRef.current.style.transform = "";
      markMoving(panelRef.current, ADMIN_MOTION_SHEET_OUT_MS);
    }
    const wait = prefersReducedMotion() ? 1 : ADMIN_MOTION_SHEET_OUT_MS;
    const t = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
    }, wait);
    return () => window.clearTimeout(t);
  }, [open, present]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, onClose]);

  useEffect(() => {
    if (shown) panelRef.current?.focus();
  }, [shown]);

  if (!present) return null;

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.add("admin-sheet-drag");
    markMoving(panel);
    dragRef.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const raw = e.clientY - drag.y;
    const dy = raw > 0 ? raw : raw * 0.3;
    drag.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
  };

  const endDrag = (velocityPxMs: number) => {
    const panel = panelRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!panel) return;
    panel.classList.remove("admin-sheet-drag");
    const h = panel.getBoundingClientRect().height || 1;
    const dy = drag?.dy ?? 0;
    if (dy > h * 0.25 || velocityPxMs > 0.5) {
      panel.style.transform = "";
      onClose();
      return;
    }
    panel.style.transform = "";
    markMoving(panel);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dt = Math.max(1, performance.now() - drag.t);
    endDrag((drag.dy || 0) / dt);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div
      className="admin-sheet-root md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-open={shown ? "true" : "false"}
    >
      <button
        type="button"
        aria-label="Aizvērt"
        className="admin-sheet-scrim"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`admin-sheet-panel rounded-t-[14px] bg-[#f2f2f7] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl ${
          closing ? "admin-sheet-out" : ""
        }`}
      >
        <div
          className="mx-auto mb-3 flex h-6 w-full cursor-grab items-start justify-center touch-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="mt-1 h-1.5 w-9 rounded-full bg-[#c7c7cc]" aria-hidden />
        </div>
        <h2 className="mb-3 text-center text-[17px] font-semibold text-[var(--color-apple-text)]">{title}</h2>
        {children}
        {action}
      </div>
    </div>
  );
}
