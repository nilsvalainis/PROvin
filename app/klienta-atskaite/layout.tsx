import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootHtml } from "@/components/RootHtml";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#f2f3f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PROVIN",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

/** Klienta atskaites saite: savs gaišs apvalks (bez vietnes galvenes, sīkdatņu loga un WhatsApp pogas). */
export default function ClientReportLinkRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootHtml lang="lv">
      <div className="min-h-dvh bg-[#f2f3f5] font-sans text-[#16181d]">{children}</div>
    </RootHtml>
  );
}
