import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#f4f4f5",
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
    <html lang="lv" data-site-theme="light" className="min-h-full bg-[#f4f4f5]">
      <body className="min-h-dvh bg-[#f4f4f5] font-sans text-[#1d1d1f] antialiased">{children}</body>
    </html>
  );
}
