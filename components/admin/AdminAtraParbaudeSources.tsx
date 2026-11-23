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

const summaryCls =
  "flex min-h-[44px] cursor-pointer list-none items-center gap-2 py-1.5 [&::-webkit-details-marker]:hidden";
const summaryTitle = "text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]";

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 flex-none text-[#8e8e93] transition-transform group-open:rotate-90">
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Bezmaksas avoti: viss ieslēgts pēc noklusējuma, grupās. Datorā sakļauti («Bezmaksas avoti · 38 ieslēgti ›»),
 * atver pēc vajadzības - saturs ir lapā arī sakļautā stāvoklī (ķekši nemainās).
 */
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
    <details className="group" data-atra-free>
      <summary className={summaryCls}>
        <Chevron />
        <span className={summaryTitle}>Bezmaksas avoti</span>
        <span className={`${pill} ${on ? "bg-[#e8f4ed] text-[#1c8a4d]" : "bg-[#f2f2f7] text-[#3a3a3c]"}`}>
          {on === total ? `${on} ieslēgti` : `${on} no ${total}`}
        </span>
      </summary>
      <div className="pb-3 pl-5">
        <div className="mb-1 flex justify-end">
          <button type="button" onClick={() => onAll(on === 0)} className="text-[12.5px] text-[#8e8e93] hover:text-[#111]">
            {on === 0 ? "Ieslēgt visus" : "Izslēgt visus"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id}>
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
        </div>
      </div>
    </details>
  );
}

/**
 * Maksas avoti: pēc noklusējuma izslēgti, summa redzama sakļautā rindā pirms palaišanas (bez papildu loga).
 * Palaišanas poga ir ievades joslā.
 */
export function AdminAtraPaidSources({
  selected,
  onToggle,
  template,
  onTemplate,
  cost,
  ledgerBar,
  vin,
}: {
  selected: readonly AtraPaidId[];
  onToggle: (id: AtraPaidId) => void;
  template: DealerCheckTemplateId;
  onTemplate: (t: DealerCheckTemplateId) => void;
  cost: AtraCost;
  ledgerBar: string;
  vin: string;
}) {
  const carvertical = buildCarverticalPrecheckPurchaseUrl(vin);
  const row = "grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 text-left";
  return (
    <details className="group border-t border-[#e5e5ea]" data-atra-paid>
      <summary className={summaryCls}>
        <Chevron />
        <span className={summaryTitle}>Maksas avoti</span>
        <span className={`${pill} ${selected.length ? "bg-[#e8eefc] text-[#0b3fa8]" : "bg-[#f2f2f7] text-[#3a3a3c]"}`}>
          {selected.length ? `${selected.length} ieslēgti` : "izslēgti"}
        </span>
        <span className="ml-auto text-[13.5px] text-[#3a3a3c]" data-atra-cost>
          Šī pārbaude maksās <b className="tabular-nums text-[#111]">{formatAtraCost(cost)}</b>
        </span>
      </summary>
      <div className="pb-3 pl-5">
        <div className="mb-1.5 flex flex-wrap items-center gap-3">
          <span className="inline-flex overflow-hidden rounded-[10px] border border-[#e5e5ea]" role="group" aria-label="Uzskaite">
            {DEALER_CHECK_TEMPLATES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={template === id}
                onClick={() => onTemplate(id)}
                className={`px-3 py-1 text-[12.5px] font-semibold ${template === id ? "bg-[#1b1c1f] text-white" : "bg-white text-[#111]"}`}
              >
                {DEALER_CHECK_TEMPLATE_LABEL[id]}
              </button>
            ))}
          </span>
          {ledgerBar ? <span className="text-[12.5px] text-[#8e8e93]">{ledgerBar}</span> : null}
        </div>
        <div className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
          {ATRA_PAID_SOURCES.map((src) => {
            const on = selected.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(src.id)}
                className={`${row} border-b border-[#efeff4]`}
              >
                <Check on={on} />
                <span className="min-w-0 truncate">
                  <b className="text-[13.5px] font-semibold text-[#111]">{src.label}</b>
                  <span className="ml-2 text-[12.5px] text-[#8e8e93]">{src.hint}</span>
                </span>
                <span className="whitespace-nowrap text-right text-[13.5px] font-semibold tabular-nums text-[#111]">
                  {src.priceCents == null ? "1 kredīts" : `${src.approx ? "~" : ""}${formatDealerCheckEur(src.priceCents)}`}
                  {src.note ? <small className="ml-1.5 text-[11px] font-medium text-[#8e8e93]">{src.note}</small> : null}
                </span>
              </button>
            );
          })}
          <div className={`${row} border-b border-[#efeff4]`}>
            <Check on={false} />
            <span className="min-w-0 truncate">
              <b className="text-[13.5px] font-semibold text-[#111]">CarVertical</b>
              <span className="ml-2 text-[12.5px] text-[#8e8e93]">Pilna atskaite · pirkums pārlūkā ar apstiprinājumu</span>
            </span>
            {carvertical ? (
              <a href={carvertical} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#0b3fa8]">
                pēc konta ›
              </a>
            ) : (
              <span className="text-[13px] text-[#8e8e93]">pēc konta</span>
            )}
          </div>
          <div className={`${row} border-b border-[#efeff4] opacity-45`} aria-disabled>
            <Check on={false} />
            <span className="min-w-0 truncate">
              <b className="text-[13.5px] font-semibold text-[#111]">AutoDNA</b>
              <span className="ml-2 text-[12.5px] text-[#8e8e93]">Pauzē</span>
            </span>
            <span className="text-[13.5px] font-semibold">-</span>
          </div>
        </div>
      </div>
    </details>
  );
}

export function RunButton({ cost, canRun, busy, onRun }: { cost: AtraCost; canRun: boolean; busy: boolean; onRun: () => void }) {
  return (
    <button
      type="button"
      disabled={!canRun || busy}
      onClick={onRun}
      className="inline-flex min-h-[48px] min-w-[170px] items-center justify-center whitespace-nowrap rounded-[10px] bg-[#0b3fa8] px-[18px] text-[14.5px] font-semibold text-white disabled:opacity-45"
    >
      {busy ? "Pārbauda…" : atraRunLabel(cost)}
    </button>
  );
}
