import Link from "next/link";
import { IrissCreateOfferButton, irissCreateOfferHref } from "@/components/admin/IrissCreateOfferButton";

/** Divas piedāvājuma pogas tikai Cenu lapā (j63 / m09). */
export function AutoparksV2OfferActions({ carId }: { carId: string }) {
  return (
    <div className="ap2-offer-btns">
      <Link href={irissCreateOfferHref()} className="ap2-btn sec">
        + Piedāvājums
      </Link>
      <IrissCreateOfferButton from="autoparks" id={carId} className="ap2-btn dark" />
    </div>
  );
}
