import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#f6f4f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Dzintarzeme Auto",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export default function IrissOfferPublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lv">
      <body className="min-h-dvh bg-[#f6f4f1] font-sans text-[#1d1d1f] antialiased">{children}</body>
    </html>
  );
}
