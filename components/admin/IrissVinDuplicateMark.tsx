"use client";

import { coerceIrissVinDuplicateLinks } from "@/lib/iriss-order-room-match-props";

export function IrissVinDuplicateMark({ links }: { links?: unknown }) {
  const items = coerceIrissVinDuplicateLinks(links);
  if (items.length === 0) return null;
  return (
    <details className="max-w-full">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-950 [&::-webkit-details-marker]:hidden">
        dublikāts
      </summary>
      <ul className="mt-1 space-y-1">
        {items.map((link) => (
          <li key={link.key}>
            <a href={link.href} className="inline-flex min-h-8 items-center text-[12px] font-medium text-[var(--color-provin-accent)] underline-offset-2 hover:underline">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
