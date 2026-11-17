import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { IrissStaffAppShell } from "@/components/admin/IrissStaffAppShell";
import { autoparksV2StaffEnabled } from "@/lib/iriss-autoparks-v2-flag";
import { PostPaymentLegalBanner } from "@/components/admin/PostPaymentLegalBanner";
import { needsUrgentCompanyLegalOnAdmin } from "@/lib/admin-orders";
import { getRequestOrigin } from "@/lib/request-origin";
import { getAdminOrStaffActor, staffActorHomePath } from "@/lib/staff-auth";
import { staffHasSection } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const actor = await getAdminOrStaffActor();
  if (!actor) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin/dashboard";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
  }

  if (actor.kind === "staff") {
    const h = await headers();
    const path = h.get("x-admin-intended-path")?.trim() || "";
    if (!path.startsWith("/admin/vin-scan") || !staffHasSection(actor.user, "vin")) {
      redirect(staffActorHomePath(actor));
    }
    return <IrissStaffAppShell name={actor.user.name} sections={actor.user.sections} autoparksV2Visible={autoparksV2StaffEnabled()}>{children}</IrissStaffAppShell>;
  }

  const origin = await getRequestOrigin();
  const urgentLegal = await needsUrgentCompanyLegalOnAdmin();

  return (
    <AdminShell
      baseUrl={origin}
      workspace="pro"
      notice={urgentLegal ? <PostPaymentLegalBanner /> : undefined}
    >
      {children}
    </AdminShell>
  );
}
