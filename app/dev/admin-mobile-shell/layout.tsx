import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "../../admin/admin-ios-theme.css";

export const metadata = {
  title: "Admin mobile shell test",
  robots: { index: false, follow: false },
};

export default function AdminMobileShellTestLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_MOBILE_SHELL_TEST !== "1") {
    notFound();
  }
  return (
    <div className="admin-ios-theme min-h-dvh bg-[var(--admin-ios-bg)]">
      {children}
    </div>
  );
}
