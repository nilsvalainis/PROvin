import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin-ios-theme.css";

export const metadata: Metadata = {
  title: "Administrēšana | PROVIN",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-ios-theme min-h-dvh bg-[var(--admin-ios-bg)]">
      {children}
    </div>
  );
}
