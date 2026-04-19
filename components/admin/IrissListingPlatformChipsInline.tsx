import { buildListingPlatformChips, type IrissListingLinksInput } from "@/lib/iriss-listing-links";

const chipBtnClass =
  "inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm transition active:scale-95 sm:h-12 sm:min-w-[3rem] sm:text-[12px]";

/**
 * Servera komponents — platformu saites kā pogas (bez „use client”).
 * Lieto sarakstos, kur čipiem jābūt ārpus galvenā pasūtījuma `Link`.
 */
export function IrissListingPlatformChipsInline({ links }: { links: IrissListingLinksInput }) {
  const chips = buildListingPlatformChips(links, 5);
  if (chips.length === 0) return null;
  return (
    <div className="border-t border-slate-100/90 bg-slate-50/40 px-3 py-2 sm:px-4 sm:py-2.5">
      <div
        role="group"
        aria-label="Sludinājumu platformu saites"
        className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]"
      >
        {chips.map((c, i) => (
          <a
            key={`${c.href}-${i}`}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className={`${chipBtnClass} ${c.chipClass}`}
          >
            {c.letter}
          </a>
        ))}
      </div>
    </div>
  );
}
