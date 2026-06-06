import type { ReactNode } from "react";
import { TestPricingTestHeader } from "@/components/test-pricing-shared/TestPricingTestHeader";

export function TestPricingTestShell({
  children,
  pageRootClassName,
}: {
  children: ReactNode;
  pageRootClassName: string;
}) {
  return (
    <div className={`demo-design-dir min-w-0 ${pageRootClassName}`}>
      <TestPricingTestHeader />
      <main className="relative z-10 min-w-0">{children}</main>
    </div>
  );
}
