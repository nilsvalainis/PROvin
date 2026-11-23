"use client";

import {
  ATRA_PAID_SOURCES,
  atraRunLabel,
  formatAtraCost,
  type AtraCost,
  type AtraFreeGroup,
  type AtraPaidId,
} from "@/lib/atra-parbaude";
import { DEALER_CHECK_TEMPLATE_LABEL, DEALER_CHECK_TEMPLATES, formatDealerCheckEur, type DealerCheckTemplateId } from "@/lib/dealer-check";
import { buildCarverticalPrecheckPurchaseUrl } from "@/lib/admin-vin-urls";

const card = "rounded-[14px] border border-[#e5e5ea] bg-white px-[18px] py-4";
const head =
  "mb-2.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]";
const pill = "inline-flex items-center rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold normal-case tracking-normal";

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] ${
        on ? "border-[#0b3fa8] bg-[#0b3fa8]" : "border-[#c7c7cc] bg-white"
      }`}
    >
      {on ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2 5 8.5l4.5-5" />
        </svg>
      ) : null}
    </span>
  );
}

/** Bezmaksas avoti: viss ieslēgts pēc noklusējuma, grupās. */
export function AdminAtraFreeSources({
  groups,
  selected,
  onToggle,
  onAll,
}: {
  groups: AtraFreeGroup[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  onAll: (on: boolean) => void;
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const on = groups.reduce((n, g) => n + g.items.filter((i) => selected.includes(i.id)).length, 0);
  return (
    <section className={card} data-atra-free>
      <h2 className={head}>
        Bezmaksas avoti
        <span className={`${pill} bg-[#e8f4ed] text-[#1c8a4d]`}>{on === total ? `${on} ieslēgti` : `${on} no ${total}`}</span>
        <button
          type="button"
          onClick={() => onAll(on === 0)}
          className="ml-auto text-[12.5px] font-medium normal-case tracking-normal text-[#8e8e93] hover:text-[#111]"
        >
          {on === 0 ? "Ieslēgt visus" : "Izslēgt visus"}
        </button>
      </h2>
      {groups.map((g) => (
        <div key={g.id} className="mt-2.5 first-of-type:mt-0">
          <i className="mb-1.5 block text-[11px] font-semibold not-italic text-[#8e8e93]">{g.label}</i>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((item) => {
              const active = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  title={item.hint}
                  onClick={() => onToggle(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5ea] bg-white py-1 pl-1.5 pr-2.5 text-[12.5px] ${
                    active ? "text-[#111]" : "text-[#b0b0b5]"
                  }`}
                >
                  <Check on={active} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Maksas avoti: pēc noklusējuma izslēgti, summa redzama pirms palaišanas (bez papildu loga). */
export function AdminAtraPaidSources({
  selected,
  onToggle,
  template,
  onTemplate,
  cost,
  ledgerBar,
  vin,
  canRun,
  busy,
  onRun,
}: {
  selected: readonly AtraPaidId[];
  onToggle: (id: AtraPaidId) => void;
  template: DealerCheckTemplateId;
  onTemplate: (t: DealerCheckTemplateId) => void;
  cost: AtraCost;
  ledgerBar: string;
  vin: string;
  canRun: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  const carvertical = buildCarverticalPrecheckPurchaseUrl(vin);
  return (
    <section className={card} data-atra-paid>
      <h2 className={head}>
        Maksas avoti
        <span className={`${pill} ${selected.length ? "bg-[#e8eefc] text-[#0b3fa8]" : "bg-[#f2f2f7] text-[#3a3a3c]"}`}>
          {selected.length ? `${selected.length} ieslēgti` : "izslēgti"}
        </span>
        <span className="ml-auto inline-flex overflow-hidden rounded-[10px] border border-[#e5e5ea]" role="group" aria-label="Uzskaite">
          {DEALER_CHECK_TEMPLATES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={template === id}
              onClick={() => onTemplate(id)}
              className={`px-3 py-1.5 text-[13px] font-semibold normal-case tracking-normal ${
                template === id ? "bg-[#1b1c1f] text-white" : "bg-white text-[#111]"
              }`}
            >
              {DEALER_CHECK_TEMPLATE_LABEL[id]}
            </button>
          ))}
        </span>
      </h2>
      <div>
        {ATRA_PAID_SOURCES.map((src, i) => {
          const on = selected.includes(src.id);
          return (
            <button
              key={src.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(src.id)}
              className={`grid w-full grid-cols-[22px_1fr_auto] items-center gap-2.5 py-[9px] text-left ${i ? "border-t border-[#e5e5ea]" : ""}`}
            >
              <Check on={on} />
              <span className="min-w-0">
                <b className="block text-[14px] font-semibold text-[#111]">{src.label}</b>
                <span className="text-[12.5px] text-[#8e8e93]">{src.hint}</span>
              </span>
              <span className="whitespace-nowrap text-right text-[14px] font-semibold tabular-nums text-[#111]">
                {src.priceCents == null ? "1 kredīts" : `${src.approx ? "~" : ""}${formatDealerCheckEur(src.priceCents)}`}
                {src.note ? <small className="block text-[11px] font-medium text-[#8e8e93]">{src.note}</small> : null}
              </span>
            </button>
          );
        })}
        <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2.5 border-t border-[#e5e5ea] py-[9px]">
          <Check on={false} />
          <span className="min-w-0">
            <b className="block text-[14px] font-semibold text-[#111]">CarVertical</b>
            <span className="text-[12.5px] text-[#8e8e93]">Pilna atskaite · pirkums pārlūkā ar apstiprinājumu</span>
          </span>
          {carvertical ? (
            <a href={carvertical} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#0b3fa8]">
              pēc konta ›
            </a>
          ) : (
            <span className="text-[13px] text-[#8e8e93]">pēc konta</span>
          )}
        </div>
        <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2.5 border-t border-[#e5e5ea] py-[9px] opacity-45" aria-disabled>
          <Check on={false} />
          <span>
            <b className="block text-[14px] font-semibold text-[#111]">AutoDNA</b>
            <span className="text-[12.5px] text-[#8e8e93]">Pauzē</span>
          </span>
          <span className="text-[14px] font-semibold">-</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3.5 rounded-[10px] bg-[#f7f7f9] px-3.5 py-3">
        <div>
          <div className="text-[15px] text-[#111]" data-atra-cost>
            Šī pārbaude maksās <b className="text-[18px] tabular-nums">{formatAtraCost(cost)}</b>
          </div>
          {ledgerBar ? <div className="text-[12.5px] text-[#8e8e93]">{ledgerBar}</div> : null}
        </div>
        <RunButton cost={cost} canRun={canRun} busy={busy} onRun={onRun} />
      </div>
    </section>
  );
}

export function RunButton({ cost, canRun, busy, onRun }: { cost: AtraCost; canRun: boolean; busy: boolean; onRun: () => void }) {
  return (
    <button
      type="button"
      disabled={!canRun || busy}
      onClick={onRun}
      className="inline-flex min-h-[42px] items-center justify-center whitespace-nowrap rounded-[10px] bg-[#0b3fa8] px-[18px] text-[14.5px] font-semibold text-white disabled:opacity-45"
    >
      {busy ? "Pārbauda…" : atraRunLabel(cost)}
    </button>
  );
}
