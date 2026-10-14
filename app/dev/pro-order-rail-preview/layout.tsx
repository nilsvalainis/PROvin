import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import "../../admin/admin-ios-theme.css";
import "../../admin/admin-pro-order-theme.css";

export const metadata = {
  title: "PRO order rail preview",
  robots: { index: false, follow: false },
};

export default function ProOrderRailPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_MOBILE_SHELL_TEST !== "1") {
    notFound();
  }
  return <div className="admin-ios-theme min-h-dvh">{children}</div>;
}
