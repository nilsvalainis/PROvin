"use client";

import { useState } from "react";
import {
  IrissOfferPublicKvRow,
  IrissOfferPublicSectionTitle,
  irissOfferPublicCardClass,
} from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import { PdPaintMap } from "@/components/iriss-piedavajumi/PdPaintMap";
import {
  IRISS_PD_DAMAGE_AREA_LV,
  irissPdAuto1BlockCount,
  irissPdDamageSummary,
  type IrissPdAuto1Blocks,
} from "@/lib/iriss-piedavajumi-auto1";
import { IRISS_PD_BLOCK_IDS, IRISS_PD_BLOCK_LV, type IrissPdBlockId } from "@/lib/iriss-piedavajumi-types";

const VIN_LIMIT = 16;

function shownIds(blocks: IrissPdAuto1Blocks, show: Partial<Record<IrissPdBlockId, true>>): IrissPdBlockId[] {
  return IRISS_PD_BLOCK_IDS.filter((id) => show[id] && irissPdAuto1BlockCount(blocks, id) > 0);
}

function VinList({ items, expandAll }: { items: string[]; expandAll: boolean }) {
  const [open, setOpen] = useState(false);
  const all = open || expandAll;
  const shown = all ? items : items.slice(0, VIN_LIMIT);
  return (
    <>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {shown.map((x, i) => (
          <div key={`${i}-${x}`} className="flex items-start gap-2 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-2.5 py-2 text-[12px] leading-snug text-[#111827]">
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#3b82c4] text-[9px] font-bold text-[#3b82c4]" aria-hidden>
              ✓
            </span>
            {x}
          </div>
        ))}
      </div>
      {items.length > VIN_LIMIT && !expandAll ? (
        <button
          type="button"
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#1d1d1f] text-[13px] font-semibold text-white"
          onClick={() => setOpen((v) => !v)}
        >
          {all ? "Rādīt mazāk" : `Rādīt vairāk (+${items.length - VIN_LIMIT})`}
        </button>
      ) : null}
    </>
  );
}

/**
 * Auto1 papildu sadaļas klienta /p/ kartīšu stilā. Tukšus blokus (t.sk. tukšu krāsas karti) nerāda.
 */
export function PdOfferExtraSections({
  blocks,
  show,
  expandAll = false,
}: {
  blocks: IrissPdAuto1Blocks;
  show: Partial<Record<IrissPdBlockId, true>>;
  expandAll?: boolean;
}) {
  const ids = shownIds(blocks, show);
  if (ids.length === 0) return null;

  return (
    <>
      {ids.includes("paint") && blocks.paint ? (
        <section className={irissOfferPublicCardClass()} data-block="paint">
          <IrissOfferPublicSectionTitle>{IRISS_PD_BLOCK_LV.paint}</IrissOfferPublicSectionTitle>
          <PdPaintMap paint={blocks.paint} />
        </section>
      ) : null}

      {ids.includes("tech") ? (
        <section className={irissOfferPublicCardClass()} data-block="tech">
          <IrissOfferPublicSectionTitle>{IRISS_PD_BLOCK_LV.tech}</IrissOfferPublicSectionTitle>
          <div>
            {blocks.tech.map((r) => (
              <IrissOfferPublicKvRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </section>
      ) : null}

      {ids.includes("damage") ? (
        <section className={irissOfferPublicCardClass()} data-block="damage">
          <IrissOfferPublicSectionTitle>{IRISS_PD_BLOCK_LV.damage}</IrissOfferPublicSectionTitle>
          {irissPdDamageSummary(blocks.damage).map((s) => (
            <IrissOfferPublicKvRow
              key={s.area}
              label={`${IRISS_PD_DAMAGE_AREA_LV[s.area]} · ${s.kinds.join(" / ")}`}
              value={String(s.total)}
            />
          ))}
          <div className="mt-2 space-y-2">
            {blocks.damage.map((r, i) => (
              <div key={i} className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-2.5 text-[13px] leading-snug">
                <b className="block text-[10px] font-medium text-[#52525b]">
                  {IRISS_PD_DAMAGE_AREA_LV[r.area]}
                  {r.damage ? ` · ${r.damage}` : ""}
                </b>
                <span className="mt-1 block font-semibold text-[#111827]">{r.parts || r.description || r.severity || "-"}</span>
                {r.description && r.parts ? <span className="mt-0.5 block text-[12px] text-[#52525b]">{r.description}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {ids.includes("equipment") ? (
        <section className={irissOfferPublicCardClass()} data-block="equipment">
          <IrissOfferPublicSectionTitle>{IRISS_PD_BLOCK_LV.equipment}</IrissOfferPublicSectionTitle>
          {blocks.equipment.length ? (
            <div className="space-y-1.5">
              {blocks.equipment.map((e) => (
                <div key={e.name} className="flex items-start gap-2 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-2.5 py-2">
                  <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#3b82c4] text-[9px] font-bold text-[#3b82c4]" aria-hidden>
                    ✓
                  </span>
                  <span>
                    <b className="block text-[13px] font-semibold text-[#111827]">{e.name}</b>
                    {e.detail ? <span className="mt-0.5 block text-[12px] text-[#52525b]">{e.detail}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {blocks.service.length ? (
            <div className={blocks.equipment.length ? "mt-3" : ""}>
              <IrissOfferPublicSectionTitle>Servisa dati</IrissOfferPublicSectionTitle>
              {blocks.service.map((r) => (
                <IrissOfferPublicKvRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          ) : null}
          {blocks.inspection.length ? (
            <div className={blocks.equipment.length || blocks.service.length ? "mt-3" : ""}>
              <IrissOfferPublicSectionTitle>Tehniskā apskate</IrissOfferPublicSectionTitle>
              {blocks.inspection.map((r) => (
                <IrissOfferPublicKvRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {ids.includes("vin") ? (
        <section className={irissOfferPublicCardClass()} data-block="vin">
          <IrissOfferPublicSectionTitle>{IRISS_PD_BLOCK_LV.vin}</IrissOfferPublicSectionTitle>
          <VinList items={blocks.vinData} expandAll={expandAll} />
        </section>
      ) : null}
    </>
  );
}
