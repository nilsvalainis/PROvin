import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootHtml } from "@/components/RootHtml";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PROVIN BUSINESS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export default function BusinessLinkRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootHtml lang="lv">
      <div className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">{children}</div>
    </RootHtml>
  );
}
