/**
 * Kreisā vertikālā sudraba līnija (desktop) — bez etiķetēm.
 */
export function HomeProcessRail() {
  return (
    <aside
      className="pointer-events-none fixed left-[max(0.5rem,env(safe-area-inset-left))] top-1/2 z-[35] hidden -translate-y-1/2 lg:block"
      aria-hidden
    >
      <div className="h-[min(52vh,420px)] w-[0.5px] bg-[#b8bcc4]/35" />
    </aside>
  );
}
