import type { Metadata, Viewport } from "next";
import "./iriss-admin.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { IrissStaffAppShell } from "@/components/admin/IrissStaffAppShell";
import { IrissPwaRegister } from "@/components/admin/IrissPwaRegister";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import {
  IRISS_PWA_MANIFEST_PATH,
  IRISS_PWA_NAME,
  IRISS_PWA_THEME_COLOR,
  IRISS_PWA_THEME_COLOR_DARK,
} from "@/lib/iriss-pwa";
import { getRequestOrigin } from "@/lib/request-origin";

export const metadata: Metadata = {
  title: "IRISS | Administrēšana",
  applicationName: IRISS_PWA_NAME,
  robots: { index: false, follow: false },
  manifest: IRISS_PWA_MANIFEST_PATH,
  appleWebApp: {
    capable: true,
    title: IRISS_PWA_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/admin/iriss/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/admin/iriss/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/admin/iriss/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: IRISS_PWA_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: IRISS_PWA_THEME_COLOR_DARK },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function AdminIrissLayout({ children }: { children: ReactNode }) {
  const actor = await getAdminOrStaffActor();
  if (!actor) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin/iriss/pasutijumi";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin/iriss/pasutijumi";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
  }

  if (actor.kind === "staff") {
    return (
      <IrissStaffAppShell name={actor.user.name} sections={actor.user.sections}>
        <IrissPwaRegister />
        {children}
      </IrissStaffAppShell>
    );
  }

  const origin = await getRequestOrigin();

  return (
    <AdminShell baseUrl={origin} workspace="iriss">
      <IrissPwaRegister />
      {children}
    </AdminShell>
  );
}
