"use client";

import {
  emptyIrissAdvanceDraft,
  IRISS_ADVANCE_METHODS,
  IRISS_ADVANCE_QUICK_AMOUNTS,
  irissAdvancePaidToday,
  irissAdvanceReceivedLabel,
  irissAdvanceWithQuickAmount,
  type IrissAdvanceDraft,
} from "@/lib/iriss-advance";

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-[10px] border border-[#e5e7eb] bg-white px-2.5 py-2 text-[16px] text-[#111827] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 sm:min-h-[38px] sm:text-[13px]";

const chipBtn =
  "inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-semibold shadow-sm transition";

export function IrissAdvanceSection({
  value,
  onChange,
  onInvoicePdf,
  invoiceBusy = false,
}: {
  value: IrissAdvanceDraft | undefined;
  onChange: (next: IrissAdvanceDraft) => void;
  onInvoicePdf?: () => void;
  invoiceBusy?: boolean;
}) {
  const draft = value ?? emptyIrissAdvanceDraft();
  const received = irissAdvanceReceivedLabel(draft);
  const set = (patch: Partial<IrissAdvanceDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <p className="text-[13px] font-semibold text-[#111827]">Avanss (depozīts)</p>
        {received ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#86efac] bg-[#dcfce7] px-2.5 py-1 text-[12px] font-semibold text-[#166534]">
            {received}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2.5 border-t border-[#e5e7eb] bg-white px-3 py-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Summa</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={draft.amount}
            aria-label="Avansa summa"
            onChange={(e) => set({ amount: e.target.value })}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Apmaksas datums</span>
          <input
            className={fieldClass}
            type="date"
            value={draft.paidAt}
            aria-label="Avansa apmaksas datums"
            onChange={(e) => set({ paidAt: e.target.value })}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Apmaksas veids</span>
          <select
            className={fieldClass}
            value={draft.method}
            aria-label="Avansa apmaksas veids"
            onChange={(e) => set({ method: e.target.value })}
          >
            <option value="">Nav norādīts</option>
            {IRISS_ADVANCE_METHODS.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Rēķina nr.</span>
          <input
            className={fieldClass}
            value={draft.invoiceNo}
            aria-label="Avansa rēķina numurs"
            onChange={(e) => set({ invoiceNo: e.target.value })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e5e7eb] bg-white px-3 py-2.5">
        {IRISS_ADVANCE_QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`${chipBtn} ${
              draft.amount === String(amount)
                ? "border-[#111827] bg-[#111827] text-white"
                : "border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f9fafb]"
            }`}
            onClick={() => onChange(irissAdvanceWithQuickAmount(draft, amount))}
          >
            {amount} €
          </button>
        ))}
        <button
          type="button"
          className={`${chipBtn} border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f9fafb]`}
          onClick={() => set({ amount: "" })}
        >
          Cita summa
        </button>
        <button
          type="button"
          className={`${chipBtn} border-[#86efac] bg-[#dcfce7] text-[#166534]`}
          onClick={() => onChange(irissAdvancePaidToday(draft))}
        >
          Samaksāts šodien
        </button>
        {onInvoicePdf ? (
          <button
            type="button"
            className={`${chipBtn} border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f9fafb]`}
            disabled={invoiceBusy}
            onClick={onInvoicePdf}
          >
            {invoiceBusy ? "PDF…" : "Rēķins PDF"}
          </button>
        ) : null}
      </div>
      <p className="px-3 pb-3 text-[11px] leading-snug text-[#6b7280]">
        Avanss parādās līguma PDF 1. lapā. Tas ieskaitās komisijas maksā. Tukšs avanss vecajos pasūtījumos netiek rakstīts.
      </p>
    </div>
  );
}
