import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { RootHtml } from "@/components/RootHtml";
import { PROVIN_USERSCRIPT_GUARD_SNIPPET } from "@/lib/provin-userscript-presence";
import "./admin-ios-theme.css";
import "./admin-motion.css";
import "./admin-pro-order-theme.css";
import "./admin-mobile.css";
import "./admin-iriss-theme.css";

export const metadata: Metadata = {
  title: "Administrēšana | PROVIN",
  applicationName: "PROVIN",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PROVIN",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootHtml lang="lv">
      <Script
        id="provin-userscript-guard"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: PROVIN_USERSCRIPT_GUARD_SNIPPET }}
      />
      <div className="admin-ios-theme min-h-dvh bg-[var(--admin-ios-bg)]">
        {children}
      </div>
    </RootHtml>
  );
}
