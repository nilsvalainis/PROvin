import type { ReactNode } from "react";
import shell from "../demo-mobile-shell.module.css";

export default function DemoMobileNarrowLayout({ children }: { children: ReactNode }) {
  return (
    <div className={shell.canvas}>
      <div className={`demo-mobile-narrow ${shell.phone}`}>{children}</div>
    </div>
  );
}
