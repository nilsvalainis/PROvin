"use client";

const NAV: { href: string; label: string }[] = [
  { href: "#demo-studio-intro", label: "Ievads" },
  { href: "#demo-studio-hero", label: "Hero" },
  { href: "#demo-studio-layout", label: "Layout" },
  { href: "#demo-studio-orbit-mini", label: "Orbit mini" },
];

/**
 * Ātra navigācija pa apvienotās demo studijas enkuriem — zem globālā headera.
 */
export function DemoStudioNav() {
  return (
    <nav
      className="sticky z-[28] border-b border-white/[0.08] bg-[#030304]/92 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-[#030304]/78"
      style={{ top: "max(0.35rem, env(safe-area-inset-top, 0px))" }}
      aria-label="Demo studijas sadaļas"
    >
      <div className="mx-auto flex max-w-[min(72rem,calc(100vw-2rem))] flex-wrap items-center gap-2 px-4 sm:px-6">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Demo</span>
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-white/[0.08] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/55 transition hover:border-[#0066ff]/35 hover:text-white/85"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
