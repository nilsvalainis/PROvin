"use client";

import {
  addIrissOfferBlock,
  addIrissOfferBlockRow,
  applyIrissOfferBlocksToRecord,
  applyIrissOfferPriceStep,
  IRISS_OFFER_PRICE_STEPS,
  irissOfferPriceStepLabel,
  moveIrissOfferBlock,
  removeIrissOfferBlockRow,
  resolveIrissOfferBlocks,
  toggleIrissOfferBlockVisible,
  upsertIrissOfferBlockRow,
  type IrissOfferBlock,
} from "@/lib/iriss-offer-blocks";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[38px] w-full min-w-0 rounded-[10px] border border-[#e5e7eb] bg-white px-2.5 py-2 text-[13px] text-[#111827] outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20";

const toolBtn =
  "inline-flex h-8 items-center rounded-full border border-[#e5e7eb] bg-white px-2.5 text-[11px] font-semibold text-[#111827] disabled:opacity-40";

function BlockChrome({
  block,
  index,
  total,
  onMove,
  onToggle,
}: {
  block: IrissOfferBlock;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
}) {
  const toggleId = `iriss-offer-block-toggle-${block.id}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold text-[#6b7280]">{index + 1}.</span>
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#111827]">{block.title}</p>
      <button type="button" className={toolBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Augšup">
        ↑
      </button>
      <button type="button" className={toolBtn} disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Lejup">
        ↓
      </button>
      <label
        htmlFor={toggleId}
        className="inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 px-1 text-[11px] font-semibold text-[#6b7280]"
      >
        <input
          id={toggleId}
          type="checkbox"
          className="iriss-offer-block-toggle"
          checked={block.visible}
          onChange={onToggle}
        />
        <span>{block.visible ? "Rādīt" : "Slēpts"}</span>
      </label>
    </div>
  );
}

function BlockBody({
  block,
  blocks,
  offer,
  onChange,
  setBlocks,
}: {
  block: IrissOfferBlock;
  blocks: IrissOfferBlock[];
  offer: IrissOfferRecord;
  onChange: (next: IrissOfferRecord) => void;
  setBlocks: (next: IrissOfferBlock[]) => void;
}) {
  if (block.kind === "vehicle" || block.kind === "table") {
    return (
      <div className="mt-2">
        <input
          className={`${fieldClass} mb-2 font-semibold`}
          value={block.title}
          aria-label="Bloka virsraksts"
          onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, title: e.target.value } : b)))}
        />
        <div className="space-y-2">
          {(block.rows ?? []).map((row) => (
            <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <input
                className={fieldClass}
                value={row.label}
                aria-label="Rindas nosaukums"
                onChange={(e) => setBlocks(upsertIrissOfferBlockRow(blocks, block.id, { ...row, label: e.target.value }))}
              />
              <input
                className={fieldClass}
                value={row.value}
                aria-label="Rindas vērtība"
                onChange={(e) => setBlocks(upsertIrissOfferBlockRow(blocks, block.id, { ...row, value: e.target.value }))}
              />
              <button
                type="button"
                className={toolBtn}
                aria-label="Dzēst rindu"
                onClick={() => setBlocks(removeIrissOfferBlockRow(blocks, block.id, row.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className={`${toolBtn} mt-2`} onClick={() => setBlocks(addIrissOfferBlockRow(blocks, block.id))}>
          + Pievienot rindu
        </button>
      </div>
    );
  }
  if (block.kind === "text" || block.kind === "warranty" || block.kind === "assessment") {
    return (
      <div className="mt-2">
        <input
          className={`${fieldClass} mb-2 font-semibold`}
          value={block.title}
          aria-label="Bloka virsraksts"
          onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, title: e.target.value } : b)))}
        />
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={toolBtn}
            onClick={() =>
              setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, html: `${b.html?.trim() ? `${b.html}\n` : ""}# ` } : b)))
            }
          >
            Virsraksts
          </button>
          <button
            type="button"
            className={toolBtn}
            onClick={() => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, html: `${b.html ?? ""}**` } : b)))}
          >
            Treknraksts
          </button>
        </div>
        <textarea
          className={`${fieldClass} min-h-[110px] resize-y`}
          value={block.html ?? ""}
          aria-label={block.title}
          onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, html: e.target.value } : b)))}
        />
        <p className="mt-1 text-[11px] text-[#6b7280]">
          Virsraksts sākas ar #. Treknraksts ar **. Garās svītras tiek aizstātas ar `-`.
        </p>
      </div>
    );
  }
  if (block.kind === "pricing") {
    return (
      <div className="mt-2">
        <p className="mb-2 text-[13px] font-semibold text-[#111827]">Ātrās cenas pogas</p>
        <div className="flex flex-wrap gap-2">
          {IRISS_OFFER_PRICE_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className={toolBtn}
              onClick={() =>
                onChange({
                  ...offer,
                  blocks,
                  carPrice: applyIrissOfferPriceStep(offer.carPrice || offer.priceGermany, step),
                  priceGermany: applyIrissOfferPriceStep(offer.carPrice || offer.priceGermany, step),
                })
              }
            >
              {irissOfferPriceStepLabel(step)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function IrissOfferBlocksEditor({
  offer,
  onChange,
}: {
  offer: IrissOfferRecord;
  onChange: (next: IrissOfferRecord) => void;
}) {
  const blocks = resolveIrissOfferBlocks(offer);
  const setBlocks = (next: IrissOfferBlock[]) => onChange(applyIrissOfferBlocksToRecord(offer, next));

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-[#e5e7eb] bg-white p-3">
          <BlockChrome
            block={block}
            index={index}
            total={blocks.length}
            onMove={(dir) => setBlocks(moveIrissOfferBlock(blocks, block.id, dir))}
            onToggle={() => setBlocks(toggleIrissOfferBlockVisible(blocks, block.id))}
          />
          {block.visible ? (
            <BlockBody block={block} blocks={blocks} offer={offer} onChange={onChange} setBlocks={setBlocks} />
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolBtn} onClick={() => setBlocks(addIrissOfferBlock(blocks, "text"))}>
          + Teksts
        </button>
        <button type="button" className={toolBtn} onClick={() => setBlocks(addIrissOfferBlock(blocks, "table"))}>
          + Tabula
        </button>
      </div>
    </div>
  );
}
