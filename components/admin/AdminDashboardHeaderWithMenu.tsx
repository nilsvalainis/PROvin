"use client";

import type { ReactNode } from "react";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";

/** Apvieno „Izvēlne” ar saraksta lapas virsrakstu vienā rindā, ja sānjosla ir sakļauta. */
export function AdminDashboardHeaderWithMenu({
  children,
  mobileTitle,
  hideOnPhone = false,
  mobileBackHref,
  mobileSubtitle,
  mobileTrailing,
  mobileBelowTitle,
}: {
  children: ReactNode;
  mobileTitle?: string;
  hideOnPhone?: boolean;
  mobileBackHref?: string;
  mobileSubtitle?: string;
  mobileTrailing?: ReactNode;
  mobileBelowTitle?: ReactNode;
}) {
  return (
    <>
      {mobileTitle && !hideOnPhone ? (
        <AdminMobileTopBar
          title={mobileTitle}
          subtitle={mobileSubtitle}
          backHref={mobileBackHref}
          trailing={mobileTrailing}
        >
          {mobileBelowTitle}
        </AdminMobileTopBar>
      ) : null}
      <header
        className={`flex flex-wrap items-start gap-2 border-b border-slate-200/70 pb-5 max-md:border-b-0 max-md:pb-2 ${
          mobileTitle || hideOnPhone ? "max-md:hidden" : ""
        }`}
      >
        <AdminCollapsedMenuButton className="mt-0.5" />
        <div className="min-w-0 flex-1">{children}</div>
      </header>
    </>
  );
}
