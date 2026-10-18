import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { RootHtml } from "@/components/RootHtml";
import { PROVIN_USERSCRIPT_GUARD_SNIPPET } from "@/lib/provin-userscript-presence";
import "./admin-ios-theme.css";
import "./admin-motion.css";
import "./admin-pro-order-theme.css";

export const metadata: Metadata = {
  title: "Administrēšana | PROVIN",
  robots: { index: false, follow: false },
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
