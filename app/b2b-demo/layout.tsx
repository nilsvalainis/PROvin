import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootHtml } from "@/components/RootHtml";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#F26522",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "IRISS B2B demo",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function B2bDemoRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootHtml lang="lv">
      {children}
    </RootHtml>
  );
}
