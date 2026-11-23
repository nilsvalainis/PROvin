"use client";

/**
 * Pasūtījuma «Vairāk» lapa telefonā (22.11 makets v2): visas pārējās esošās darbības sarakstā ar nosaukumiem,
 * sagrupētas (Atskaite / Rīki / Maksas avoti). Bez stāvokļa - darbības nāk no darba vietas.
 * Jaunu darbību (piem. «Klienta saite») pievieno kā vēl vienu `items` ierakstu attiecīgajā grupā.
 */

import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { AmxIcon } from "@/components/admin/mobile/AdminMobileGlass";

export type MobileOrderMoreItem = {
  id: string;
  label: string;
  /** Otrā rinda pelēkā (piem. «LV · EN · RU · DE»). */
  sub?: string;
  onClick?: () => void;
  /** Ārēja saite (jaunā cilnē). */
  href?: string;
  disabled?: boolean;
  hidden?: boolean;
};

export type MobileOrderMoreGroup = { id: string; label: string; items: MobileOrderMoreItem[] };

export function MobileOrderMoreList({ groups, onPicked }: { groups: MobileOrderMoreGroup[]; onPicked?: () => void }) {
  return (
    <div className="amx amx-more" data-mobile-order-more>
      {groups.map((g) => {
        const items = g.items.filter((it) => !it.hidden);
        if (!items.length) return null;
        return (
          <div key={g.id} className="contents">
            <div className="amx-lbl">{g.label}</div>
            <div className="amx-card">
              {items.map((it) => {
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      {it.label}
                      {it.sub ? <span className="amx-more-sub">{it.sub}</span> : null}
                    </span>
                    <AmxIcon name="chev" className="h-4 w-4 shrink-0 text-[var(--amx-soft)]" />
                  </>
                );
                if (it.href && !it.disabled) {
                  return (
                    <a key={it.id} href={it.href} target="_blank" rel="noopener noreferrer" data-more-item={it.id} onClick={onPicked}>
                      {inner}
                    </a>
                  );
                }
                return (
                  <button
                    key={it.id}
                    type="button"
                    data-more-item={it.id}
                    disabled={it.disabled || (!it.onClick && !it.href)}
                    onClick={() => {
                      onPicked?.();
                      it.onClick?.();
                    }}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MobileOrderMoreSheet({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: MobileOrderMoreGroup[];
}) {
  return (
    <AdminMobileSheet open={open} title="Vairāk" onClose={onClose}>
      <MobileOrderMoreList groups={groups} onPicked={onClose} />
    </AdminMobileSheet>
  );
}
