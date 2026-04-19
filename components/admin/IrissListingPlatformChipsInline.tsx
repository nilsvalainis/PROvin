import {
  buildListingPlatformChips,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
  type IrissListingLinksInput,
} from "@/lib/iriss-listing-links";

/**
 * Servera komponents — platformu saites kā pogas (bez „use client”).
 * Lieto sarakstos, kur čipiem jābūt ārpus galvenā pasūtījuma `Link`.
 */
export function IrissListingPlatformChipsInline({ links }: { links: IrissListingLinksInput }) {
  const chips = buildListingPlatformChips(links, 5);
  if (chips.length === 0) return null;
  return (
    <div className="border-t border-slate-100/90 bg-slate-50/40 px-3 py-2 sm:px-4 sm:py-2.5">
      <div role="group" aria-label="Sludinājumu platformu saites" className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}>
        {chips.map((c, i) => (
          <a
            key={`${c.href}-${i}`}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} ${c.chipClass}`}
          >
            {c.letter}
          </a>
        ))}
      </div>
    </div>
  );
}
