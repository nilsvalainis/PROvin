"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAdminIsPhone } from "@/lib/use-admin-is-phone";

/**
 * Telefonā arī lielās pasūtījuma sadaļas (Sludinājuma analīze, Kopsavilkums) var saklāt kā avotu kartītes.
 * Stāvoklis paliek katram pasūtījumam. Datorā nekas nemainās.
 */
export function AdminPhoneSectionCollapse({
  sessionId,
  sectionId,
  header,
  children,
}: {
  sessionId: string;
  sectionId: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const phone = useAdminIsPhone();
  const key = `provin-admin-ui-accordion-v1-${sessionId}-section-${sectionId}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(key) === "1");
    } catch {
      setCollapsed(false);
    }
  }, [key]);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(key, c ? "0" : "1");
      } catch {
        // nav krātuves
      }
      return !c;
    });
  }

  if (!phone) {
    return (
      <>
        {header}
        {children}
      </>
    );
  }
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        className="flex min-h-11 cursor-pointer select-none items-center gap-2"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button, input, textarea, select, label")) return;
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-slate-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {collapsed ? null : children}
    </>
  );
}
