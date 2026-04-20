import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { PostPaymentLegalBanner } from "@/components/admin/PostPaymentLegalBanner";
import { getAdminSession } from "@/lib/admin-auth";
import { needsUrgentCompanyLegalOnAdmin } from "@/lib/admin-orders";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin/dashboard";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
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
