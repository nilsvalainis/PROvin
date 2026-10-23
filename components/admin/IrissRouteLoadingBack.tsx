"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { useAdminShellLayout } from "@/components/admin/AdminShellLayoutContext";

/** Atpakaļ saite ielādes skeletā: tikai IRISS admin čaulā un ne pašā izvēlnē (tur atpakaļ nav). */
export function irissLoadingBackHref(pathname: string, workspace: string | null | undefined): string | null {
  if (workspace !== "iriss") return null;
  const p = pathname.replace(/\/+$/, "");
  if (p === "/admin/iriss" || !p.startsWith("/admin/iriss/")) return null;
  return "/admin/iriss";
}

/**
 * Sadaļa serverī ielādējas 0,6-6 s; agrāk skeletā atpakaļ pogas nebija, un pieskāriens tai vietā "nereaģēja" (j23).
 * Tā pati vieta un izmērs (44x44) kā AdminMobileTopBar atpakaļ pogai.
 */
export function IrissRouteLoadingBack() {
  const pathname = usePathname() ?? "";
  const href = irissLoadingBackHref(pathname, useAdminShellLayout()?.workspace);
  if (!href) return null;
  return (
    <div className="-mt-1.5 mb-2 flex min-h-11 items-center md:hidden">
      <Link href={href} aria-label="Atpakaļ" className="am-press grid h-11 w-11 place-items-center rounded-full bg-[var(--fill-secondary)] text-[var(--label)]">
        <AdminMobileIcon name="atpakal" className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}
