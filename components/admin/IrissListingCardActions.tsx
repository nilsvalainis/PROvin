"use client";

import { ClipboardList, MoreHorizontal, Radar, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  IRISS_LISTING_CARD_ACTION_BTN_CLASS,
  IRISS_LISTING_CARD_ACTION_ICON_CLASS,
  IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS,
  IRISS_LISTING_CARD_ACTION_OFFER,
  IRISS_LISTING_CARD_ACTION_ORDER,
  IRISS_LISTING_CARD_ACTION_ORDER_MENU,
  IRISS_LISTING_CARD_ACTION_RADAR,
  IRISS_LISTING_CARD_ACTIONS_ROW_CLASS,
} from "@/lib/iriss-listing-card-actions";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export function IrissListingCardActions({
  v,
  onCreateOrder,
  onCreateRadar,
  onCreateOffer,
}: {
  v: IrissListingVehicle;
  onCreateOrder?: (v: IrissListingVehicle) => void | Promise<void>;
  onCreateRadar?: (v: IrissListingVehicle) => void | Promise<void>;
  onCreateOffer?: (v: IrissListingVehicle) => void | Promise<void>;
}) {
  const [orderBusy, setOrderBusy] = useState(false);
  const [radarBusy, setRadarBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function run(
    fn: ((v: IrissListingVehicle) => void | Promise<void>) | undefined,
    setBusy: (v: boolean) => void,
  ) {
    if (!fn) return;
    setBusy(true);
    void Promise.resolve(fn(v)).finally(() => setBusy(false));
  }

  if (!onCreateOrder && !onCreateRadar && !onCreateOffer) return null;

  return (
    <div className={IRISS_LISTING_CARD_ACTIONS_ROW_CLASS} data-iriss-listing-card-actions>
      {onCreateOrder ? (
        <button
          type="button"
          disabled={orderBusy}
          className={IRISS_LISTING_CARD_ACTION_BTN_CLASS}
          title={IRISS_LISTING_CARD_ACTION_ORDER}
          onClick={(e) => {
            e.stopPropagation();
            run(onCreateOrder, setOrderBusy);
          }}
        >
          <ClipboardList className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          {orderBusy ? "Veido…" : IRISS_LISTING_CARD_ACTION_ORDER}
        </button>
      ) : null}
      {onCreateRadar ? (
        <button
          type="button"
          disabled={radarBusy}
          className={IRISS_LISTING_CARD_ACTION_BTN_CLASS}
          title={IRISS_LISTING_CARD_ACTION_RADAR}
          onClick={(e) => {
            e.stopPropagation();
            run(onCreateRadar, setRadarBusy);
          }}
        >
          <Radar className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          {radarBusy ? "Veido…" : IRISS_LISTING_CARD_ACTION_RADAR}
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
          <Tag className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          {offerBusy ? "Veido…" : IRISS_LISTING_CARD_ACTION_OFFER}
        </button>
      ) : null}
      {onCreateOrder ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            className={IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS}
            aria-label="Vairāk darbību"
            title="Vairāk darbību"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal className={IRISS_LISTING_CARD_ACTION_ICON_CLASS} aria-hidden strokeWidth={1.5} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-xl bg-white/95 text-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.1)] backdrop-blur">
              <button
                type="button"
                disabled={orderBusy}
                className="block w-full px-3.5 py-2.5 text-left hover:bg-black/[0.03] disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  run(onCreateOrder, setOrderBusy);
                }}
              >
                {IRISS_LISTING_CARD_ACTION_ORDER_MENU}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
