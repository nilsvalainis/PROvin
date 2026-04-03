import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${inter.variable} min-w-0 scroll-smooth`} suppressHydrationWarning>
      <body className="min-h-dvh min-w-0 overflow-x-clip font-sans">{children}</body>
    </html>
  );
}
