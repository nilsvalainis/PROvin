"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

type Props = {
  compact?: boolean;
};

export function IrissNewOfferMenuButton({ compact = false }: Props) {
  return (
    <Link
      href="/admin/iriss/pasutijumi/new?newOffer=1&noClientPdf=1"
      className={
        compact
          ? "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black shadow-none transition"
          : "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black shadow-none transition"
      }
      title="Jauns piedāvājums bez klienta datiem"
      aria-label="Jauns piedāvājums bez klienta datiem"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Piedāvājums
    </Link>
  );
}
