import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import "../../admin/admin-ios-theme.css";
import "../../admin/admin-motion.css";
import "../../admin/admin-mobile.css";
import "../../admin/mobile/workspace-switch.css";
import "../../admin/mobile/pro-home.css";
import "../../admin/mobile/link-contrast.css";
import "../../admin/mobile/order-tones.css";
import "../../admin/mobile/menu-grid.css";
import "../../admin/admin-iriss-theme.css";

export const metadata = {
  title: "Admin mobile shell test",
  robots: { index: false, follow: false },
};

export default function AdminMobileShellTestLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_MOBILE_SHELL_TEST !== "1") {
    notFound();
  }
  return (
    <div className="admin-ios-theme min-h-dvh bg-[var(--admin-ios-bg)] max-md:flex max-md:h-dvh max-md:min-h-0 max-md:flex-col">
      {children}
    </div>
  );
}
