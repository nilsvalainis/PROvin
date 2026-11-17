"use client";

import {
  DEALER_CHECK_TEMPLATE_LABEL,
  DEALER_CHECK_TEMPLATES,
  formatDealerCheckEur,
} from "@/lib/dealer-check";
import type { DealerCheckHistoryEntry, DealerCheckListFilter } from "@/lib/dealer-check-history";
import { formatRigaIsoShort } from "@/lib/riga-datetime";

const field =
  "w-full min-w-0 rounded-[10px] border border-[#d1d1d6] bg-white px-3 py-2 text-[13px] text-[#111] placeholder:text-[#8e8e93] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25";

export function AdminDealerCheckHistory({
  entries,
  total,
  filter,
  onFilter,
  onOpen,
  onDelete,
  onExport,
  busy,
}: {
  entries: DealerCheckHistoryEntry[];
  total: number;
  filter: DealerCheckListFilter;
  onFilter: (next: DealerCheckListFilter) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  busy: boolean;
}) {
  return (
    <section className="mt-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5" data-dealer-check-history>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">Saglabātās pārbaudes</h2>
        <span className="text-[12px] text-[#6e6e73]">
          {entries.length} no {total}
        </span>
        <button
          type="button"
          onClick={onExport}
          className="ml-auto rounded-[10px] border border-[#d1d1d6] bg-white px-3 py-2 text-[13px] font-semibold text-[#111]"
        >
          Eksportēt CSV
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Datums no</span>
          <input
            type="date"
            className={field}
            value={filter.from}
            onChange={(e) => onFilter({ ...filter, from: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Datums līdz</span>
          <input
            type="date"
            className={field}
            value={filter.to}
            onChange={(e) => onFilter({ ...filter, to: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">VIN</span>
          <input
            className={`${field} font-mono`}
            value={filter.vin}
            aria-label="Filtrs: VIN"
            onChange={(e) => onFilter({ ...filter, vin: e.target.value.toUpperCase() })}
            placeholder="VIN"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Numurzīme</span>
          <input
            className={`${field} font-mono`}
            value={filter.plate}
            aria-label="Filtrs: numurzīme"
            onChange={(e) => onFilter({ ...filter, plate: e.target.value.toUpperCase() })}
            placeholder="AB-1234"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Statuss</span>
          <select
            className={field}
            value={filter.status}
            aria-label="Filtrs: statuss"
            onChange={(e) => onFilter({ ...filter, status: e.target.value as DealerCheckListFilter["status"] })}
          >
            <option value="open">Atvērtas</option>
            <option value="converted">Pārvērstas</option>
            <option value="all">Visas</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Pasūtījums</span>
          <select
            className={field}
            value={filter.ordered}
            aria-label="Filtrs: pasūtījums"
            onChange={(e) => onFilter({ ...filter, ordered: e.target.value as DealerCheckListFilter["ordered"] })}
          >
            <option value="no">Nē</option>
            <option value="yes">Jā</option>
            <option value="all">Visi</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Šablons</span>
          <select
            className={field}
            value={filter.template}
            aria-label="Filtrs: šablons"
            onChange={(e) => onFilter({ ...filter, template: e.target.value as DealerCheckListFilter["template"] })}
          >
            <option value="all">Visi</option>
            {DEALER_CHECK_TEMPLATES.map((id) => (
              <option key={id} value={id}>
                {DEALER_CHECK_TEMPLATE_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[13px] text-[#6e6e73]">Nav saglabātu pārbaužu.</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#6e6e73]">Nav pārbaužu ar šiem filtriem.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Datums", "VIN", "Numurzīme", "Šablons", "Iekasēts", "Statuss", ""].map((label) => (
                  <th key={label || "darbibas"} className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} data-dealer-check-history-row={row.id}>
                  <td className="border-b border-[#f2f2f7] px-2 py-2 whitespace-nowrap">
                    {formatRigaIsoShort(row.createdAt || row.fetchedAt)}
                  </td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2 font-mono">{row.vin}</td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2 font-mono">{row.plate || "-"}</td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2">{DEALER_CHECK_TEMPLATE_LABEL[row.template]}</td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2">{formatDealerCheckEur(row.chargedCents)}</td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2">
                    {row.status === "converted" ? (
                      row.orderId ? (
                        <a className="text-[#2563EB] underline" href={`/admin/orders/${encodeURIComponent(row.orderId)}`}>
                          Pasūtījums
                        </a>
                      ) : (
                        "Pasūtījums"
                      )
                    ) : (
                      "Atvērta"
                    )}
                  </td>
                  <td className="border-b border-[#f2f2f7] px-2 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpen(row.id)}
                      className="mr-2 rounded-lg bg-[#f2f2f7] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#111]"
                    >
                      Atvērt
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg border border-[#f3c2c7] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[#d70015] disabled:opacity-45"
                    >
                      Dzēst
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
