"use client";

import { useState, type ReactNode } from "react";
import {
  IrissOfferPublicKvRow,
  IrissOfferPublicSectionTitle,
  irissOfferPublicCardClass,
} from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import { PdHighlightChips } from "@/components/iriss-piedavajumi/PdClientContent";
import { PdPaintMap } from "@/components/iriss-piedavajumi/PdPaintMap";
import {
  IRISS_PD_DAMAGE_AREA_LV,
  irissPdAuto1BlockCount,
  irissPdDamageSummary,
  type IrissPdAuto1Blocks,
  type IrissPdKv,
} from "@/lib/iriss-piedavajumi-auto1";
import { irissPdDisplayValue } from "@/lib/iriss-piedavajumi-display";
import { IRISS_PD_BLOCK_IDS, IRISS_PD_BLOCK_LV, type IrissPdBlockId } from "@/lib/iriss-piedavajumi-types";

const VIN_LIMIT = 16;

function shownIds(blocks: IrissPdAuto1Blocks, show: Partial<Record<IrissPdBlockId, true>>): IrissPdBlockId[] {
  return IRISS_PD_BLOCK_IDS.filter((id) => show[id] && irissPdAuto1BlockCount(blocks, id) > 0);
}

/** Auto1 vērtības latviski ("Available" -> "Ir", "12/21/2020" -> "21.12.2020"). */
function KvRows({ rows }: { rows: readonly IrissPdKv[] }) {
  return (
    <div>
      {rows.map((r) => (
        <IrissOfferPublicKvRow key={r.label} label={r.label} value={irissPdDisplayValue(r.value)} />
      ))}
    </div>
  );
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

/** Izvēršama kartīte apakšā: pirmajā skatā aizņem tikai virsraksta rindu. PDF vienmēr atvērta. */
function Collapsible({
  block,
  title,
  count,
  open,
  children,
}: {
  block: string;
  title: string;
  count?: number;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details className={`group ${irissOfferPublicCardClass()}`} data-block={block} open={open || undefined}>
      <summary className="-m-1 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-1 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525b]">
          {title}
          {count ? <span className="ml-1.5 font-semibold normal-case tracking-normal text-[#a1a1aa]">{count}</span> : null}
        </span>
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[13px] text-[#52525b] transition-transform group-open:rotate-180"
          aria-hidden
        >
          ⌄
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * Auto1 sadaļas klienta /p/ kartīšu stilā (galvenā daļa): krāsas karte, tehniskie dati, bojājumi un «Servisa dati»
 * (atsevišķa kartīte). Tukšus blokus nerāda. Aprīkojums un «Dati pēc VIN» ir `PdOfferBottomSections`.
 */
export function PdOfferExtraSections({
  blocks,
  show,
}: {
  blocks: IrissPdAuto1Blocks;
  show: Partial<Record<IrissPdBlockId, true>>;
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
          <KvRows rows={blocks.tech} />
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

      {/* Servisa dati - atsevišķa kartīte (Nils 17.11), nevis daļa no aprīkojuma bloka. */}
      {ids.includes("equipment") && blocks.service.length ? (
        <section className={irissOfferPublicCardClass()} data-block="service">
          <IrissOfferPublicSectionTitle>Servisa dati</IrissOfferPublicSectionTitle>
          <KvRows rows={blocks.service} />
        </section>
      ) : null}
    </>
  );
}

/**
 * Pašā apakšā, izvēršamas (Nils 17.11): «Aprīkojums · Tehniskā apskate» (ar aprīkojuma izcēlumiem) un «Dati pēc VIN».
 * `blocks` var nebūt (tad tikai izcēlumi). PDF (`expandAll`) - atvērtas.
 */
export function PdOfferBottomSections({
  blocks,
  show,
  highlights = [],
  expandAll = false,
}: {
  blocks: IrissPdAuto1Blocks | null;
  show: Partial<Record<IrissPdBlockId, true>>;
  highlights?: readonly string[];
  expandAll?: boolean;
}) {
  const ids = blocks ? shownIds(blocks, show) : [];
  const equipment = blocks && ids.includes("equipment") ? blocks.equipment : [];
  const inspection = blocks && ids.includes("equipment") ? blocks.inspection : [];
  const hasEquipment = highlights.length > 0 || equipment.length > 0 || inspection.length > 0;
  const vin = blocks && ids.includes("vin") ? blocks.vinData : [];
  const equipmentTitle = inspection.length ? "Aprīkojums · Tehniskā apskate" : "Aprīkojums";

  return (
    <>
      {hasEquipment ? (
        <Collapsible block="equipment" title={equipmentTitle} count={highlights.length + equipment.length || undefined} open={expandAll}>
          <PdHighlightChips items={highlights} />
          {equipment.length ? (
            <div className={`space-y-1.5 ${highlights.length ? "mt-3" : ""}`}>
              {equipment.map((e) => (
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
          {inspection.length ? (
            <div className={highlights.length || equipment.length ? "mt-4" : ""}>
              <IrissOfferPublicSectionTitle>Tehniskā apskate</IrissOfferPublicSectionTitle>
              <KvRows rows={inspection} />
            </div>
          ) : null}
        </Collapsible>
      ) : null}

      {vin.length ? (
        <Collapsible block="vin" title={IRISS_PD_BLOCK_LV.vin} count={vin.length} open={expandAll}>
          <VinList items={vin} expandAll={expandAll} />
        </Collapsible>
      ) : null}
    </>
  );
}
