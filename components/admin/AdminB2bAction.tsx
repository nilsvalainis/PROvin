import type { ReactNode } from "react";

/** IRISS oranžais kontūrs + B2B birka. Citas admin pogas nemaina. */
export const ADMIN_B2B_BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#F26522]/55 bg-[#F26522]/8 px-2.5 py-1 text-[11px] font-semibold text-[#c2410c] transition hover:bg-[#F26522]/14 disabled:cursor-not-allowed disabled:opacity-45";

export const ADMIN_B2B_BTN_SOLID =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#F26522] bg-[#F26522] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45";

export function AdminB2bTag() {
  return (
    <span className="rounded-[0.2rem] border border-[#F26522]/40 bg-white px-1 py-px text-[8px] font-bold uppercase tracking-[0.08em] text-[#c2410c]">
      B2B
    </span>
  );
}

export function AdminB2bActionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <AdminB2bTag />
      <span>{children}</span>
    </span>
  );
}
