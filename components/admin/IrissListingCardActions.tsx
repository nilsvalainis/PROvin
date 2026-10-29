"use client";

import { IrissAnchoredPopover } from "@/components/admin/IrissAnchoredPopover";
import { ClipboardList, FilePlus2, MoreHorizontal, Plus } from "lucide-react";
import { useRef, useState } from "react";
import {
  IRISS_LISTING_CARD_ACTION_BTN_CLASS,
  IRISS_LISTING_CARD_ACTION_ICON_CLASS,
  IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS,
  IRISS_LISTING_CARD_ACTION_OFFER,
  IRISS_LISTING_CARD_ACTION_ORDER,
  IRISS_LISTING_CARD_ACTION_ORDER_MENU,
  IRISS_LISTING_CARD_ACTIONS_ROW_CLASS,
} from "@/lib/iriss-listing-card-actions";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export function IrissListingCardActions({
  v,
  onPreviewDetails,
  onCreateRadar,
  onCreateOffer,
  previewDisabled = false,
}: {
  v: IrissListingVehicle;
  onPreviewDetails?: (v: IrissListingVehicle) => void;
  onCreateRadar?: (v: IrissListingVehicle) => void | Promise<void>;
  onCreateOffer?: (v: IrissListingVehicle) => void | Promise<void>;
  previewDisabled?: boolean;
}) {
  const [radarBusy, setRadarBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  function run(
    fn: ((v: IrissListingVehicle) => void | Promise<void>) | undefined,
    setBusy: (v: boolean) => void,
  ) {
    if (!fn) return;
    setBusy(true);
    void Promise.resolve(fn(v)).finally(() => setBusy(false));
  }

  if (!onPreviewDetails && !onCreateRadar && !onCreateOffer) return null;

  return (
    <div className={IRISS_LISTING_CARD_ACTIONS_ROW_CLASS} data-iriss-listing-card-actions>
      {onPreviewDetails ? (
        <button
          type="button"
          disabled={previewDisabled}
          className={IRISS_LISTING_CARD_ACTION_BTN_CLASS}
          title={IRISS_LISTING_CARD_ACTION_ORDER}
          onClick={(e) => {
            e.stopPropagation();
            if (previewDisabled) return;
            onPreviewDetails(v);
          }}
        >
          <ClipboardList className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          {IRISS_LISTING_CARD_ACTION_ORDER}
        </button>
      ) : null}
      {onCreateOffer ? (
        <button
          type="button"
          disabled={offerBusy}
          className={IRISS_LISTING_CARD_ACTION_BTN_CLASS}
          title={IRISS_LISTING_CARD_ACTION_OFFER}
          onClick={(e) => {
            e.stopPropagation();
            run(onCreateOffer, setOfferBusy);
          }}
        >
          <FilePlus2 className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          {offerBusy ? "Veido…" : IRISS_LISTING_CARD_ACTION_OFFER}
        </button>
      ) : null}
      {onCreateRadar ? (
        <div className="relative shrink-0">
          <button
            ref={moreBtnRef}
            type="button"
            className={IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS}
            aria-label="Vairāk darbību"
            title="Vairāk darbību"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          </button>
          <IrissAnchoredPopover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={moreBtnRef}
            align="end"
            minWidth={208}
            estimatedHeight={52}
            className="iriss-ov-menu iriss-ov-menu-portal fixed z-[200] w-52 overflow-hidden rounded-xl bg-white/95 py-0 text-[14px] text-[var(--iriss-ink)] shadow-[0_8px_30px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.1)]"
          >
            <button
              type="button"
              role="menuitem"
              disabled={radarBusy}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-black/[0.03] disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                run(onCreateRadar, setRadarBusy);
              }}
            >
              <Plus className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
              {radarBusy ? "Veido…" : IRISS_LISTING_CARD_ACTION_ORDER_MENU}
            </button>
          </IrissAnchoredPopover>
        </div>
      ) : null}
    </div>
  );
}
