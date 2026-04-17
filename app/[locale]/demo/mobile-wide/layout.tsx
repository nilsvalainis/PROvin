import type { ReactNode } from "react";
import shell from "../demo-mobile-shell.module.css";

export default function DemoMobileWideLayout({ children }: { children: ReactNode }) {
  return (
    <div className={shell.canvas}>
      <div className={`demo-mobile-wide ${shell.phone} ${shell.phoneWide}`}>{children}</div>
    </div>
  );
}
