"use client";

import { CheckCircle2, Circle, ListChecks, MessageCircle, Search, FileText } from "lucide-react";
import type { IrissOrderRoomNextStep } from "@/lib/iriss-order-room";

const ICONS: Record<string, typeof Search> = {
  hits: Search,
  offer: FileText,
  vin: ListChecks,
  contact: MessageCircle,
};

export function IrissOrderRoomNextSteps({
  steps,
  onSelect,
}: {
  steps: IrissOrderRoomNextStep[];
  onSelect: (step: IrissOrderRoomNextStep) => void;
}) {
  if (steps.length === 0) {
    return <p className="text-[13px] text-[#6b7280]">Šobrīd nav atsevišķu soļu.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((step, index) => {
        const Icon = ICONS[step.id] ?? Circle;
        const isFirst = index === 0;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              isFirst
                ? "border-[#93c5fd] bg-[#eff6ff]"
                : "border-[#e5e7eb] bg-white opacity-90 hover:opacity-100"
            }`}
          >
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isFirst ? "bg-[#2563eb] text-white" : "border border-[#e5e7eb] bg-[#fafafa] text-[#6b7280]"
              }`}
            >
              {isFirst ? <Icon className="h-5 w-5" aria-hidden /> : <CheckCircle2 className="h-4 w-4 opacity-40" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[#111827]">{step.label}</span>
              <span className="block text-[11px] text-[#6b7280]">{isFirst ? "Pašreizējais solis" : "Nākamais"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
