import type { ReactNode } from "react";

/** Gandrīz balta bloga lasīšanas virsma (bez tumšā home canvas). */
export function BlogPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa] text-[#1d1d1f]">
      <div className="flex min-h-0 min-w-0 flex-col bg-[#f7f8fa]">{children}</div>
    </div>
  );
}
