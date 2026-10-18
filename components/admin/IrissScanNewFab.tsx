"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

export function IrissScanNewFab() {
  return (
    <Link
      href="/admin/iriss/scan/new"
      className="iriss-new-fab fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom,0px))+var(--admin-tabbar-h,0px))] right-4 z-[65] hidden h-14 w-14 items-center justify-center rounded-full bg-[var(--color-provin-accent)] text-white shadow-[0_8px_20px_rgba(0,122,255,0.35)] transition hover:opacity-95 active:scale-95 md:bottom-6 md:flex md:h-12 md:w-12 md:rounded-xl md:border md:border-white/20 md:shadow-sm md:backdrop-blur-xl sm:right-5"
      aria-label="Jauns radara ieraksts"
      title="Jauns radara ieraksts"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
