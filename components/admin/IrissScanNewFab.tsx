"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

export function IrissScanNewFab() {
  return (
    <Link
      href="/admin/iriss/scan/new"
      className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom,0px))+var(--admin-tabbar-h,0px))] right-4 z-[65] flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[var(--color-provin-accent)]/88 text-white shadow-sm backdrop-blur-xl transition hover:opacity-95 active:scale-95 md:bottom-6 sm:right-5"
      aria-label="Jauns radara ieraksts"
      title="Jauns radara ieraksts"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
