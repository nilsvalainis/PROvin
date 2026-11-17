"use client";

import { waybillStopConfirmText, type WaybillStopTarget } from "@/lib/iriss-waybill-stop";

export function IrissWaybillStopConfirm({
  target,
  busy,
  error,
  onYes,
  onNo,
}: {
  target: WaybillStopTarget;
  busy?: boolean;
  error?: string | null;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0f172a66] p-4">
      <div className="w-full max-w-[360px] rounded-2xl border border-[var(--iriss-line)] bg-white p-4" role="dialog" aria-modal="true">
        <h3 className="m-0 text-[15px] font-semibold">Pārtraukt pavadzīmi</h3>
        <p className="mt-2 text-[13px] font-semibold leading-snug text-[var(--iriss-ink)]">
          {waybillStopConfirmText(target.number, target.plate)}
        </p>
        {error ? <p className="mt-2 text-[12px] text-[#B42318]">{error}</p> : null}
        <div className="mt-3.5 flex flex-col gap-2">
          <button
            type="button"
            className="min-h-11 rounded-[10px] bg-[var(--iriss-graphite)] text-[12.5px] font-semibold text-white disabled:opacity-50"
            onClick={onYes}
            disabled={busy}
          >
            Jā
          </button>
          <button
            type="button"
            className="min-h-11 rounded-[10px] border border-[var(--iriss-line)] bg-white text-[12.5px] font-semibold text-[var(--iriss-ink)]"
            onClick={onNo}
          >
            Nē
          </button>
        </div>
      </div>
    </div>
  );
}
