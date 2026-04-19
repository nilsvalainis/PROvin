import type { Metadata } from "next";
import "./iriss-admin.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/admin-auth";
import { getRequestOrigin } from "@/lib/request-origin";

export const metadata: Metadata = {
  title: "IRISS | Administrēšana",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminIrissLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin/iriss/pasutijumi";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin/iriss/pasutijumi";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
  }

  const origin = await getRequestOrigin();

  return (
    <AdminShell baseUrl={origin} workspace="iriss">
      {children}
    </AdminShell>
  );
}
