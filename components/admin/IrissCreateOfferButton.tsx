"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { irissPdNewHref } from "@/lib/iriss-pd-entry";
import type { OfferSourceKind } from "@/lib/iriss-stock-photos";

type Props = {
  /** Ar avotu - "Izveidot piedāvājumu" auto kabinetā (forma ar auto datiem un bildēm); bez - "+ Piedāvājums" no nulles. */
  from?: OfferSourceKind;
  id?: string;
  className?: string;
};

/** Vecā piedāvājuma forma pasūtījumā - tikai darbiniekiem (PD ir tikai administratoram). */
export function irissCreateOfferHrefLegacy(from?: OfferSourceKind, id?: string): string {
  const base = "/admin/iriss/pasutijumi/new?newOffer=1&noClientPdf=1";
  return from && id ? `${base}&from=${encodeURIComponent(`${from}:${id}`)}` : base;
}

/**
 * Viena poga piedāvājumam (Loģistika, Autoparks v2, Pasūtījumi, sānjosla): vienmēr PD ieeja ar izvēlētu avotu
 * (Nils 27.10 - viena piedāvājumu sistēma). Darbinieku PD lapa pati novirza uz veco formu.
 */
export function irissCreateOfferHref(from?: OfferSourceKind, id?: string): string {
  return irissPdNewHref(from && id ? { from, id } : {});
}

export function IrissCreateOfferButton({ from, id, className }: Props) {
  const withSource = Boolean(from && id);
  return (
    <Link
      href={irissCreateOfferHref(from, id)}
      className={
        className ??
        (withSource
          ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#373b45] px-4 text-[14px] font-semibold text-white"
          : "inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#373b45] px-3 text-[12.5px] font-semibold text-white")
      }
    >
      {withSource ? <FileText className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
      {withSource ? "Izveidot piedāvājumu" : "Piedāvājums"}
    </Link>
  );
}
