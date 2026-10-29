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
  onOpenSearch,
  variant = "list",
}: {
  steps: IrissOrderRoomNextStep[];
  onSelect: (step: IrissOrderRoomNextStep) => void;
  onOpenSearch?: () => void;
  variant?: "list" | "banner";
}) {
  if (variant === "banner") {
    const first = steps[0];
    return (
      <div className="flex w-full items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-[var(--ink)]">
          <Search className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">Pašreizējais solis</p>
          <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
            {first?.label ?? "Šobrīd nav atsevišķu soļu."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenSearch?.()}
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-[var(--iriss-graphite)] px-3.5 text-[13px] font-semibold text-[var(--iriss-on-graphite)]"
        >
          Atvērt Meklētāju
        </button>
      </div>
    );
  }

  if (steps.length === 0) {
    return <p className="text-[13px] text-[var(--ink2)]">Šobrīd nav atsevišķu soļu.</p>;
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
                ? "border-[var(--acc-soft)] bg-[var(--s1)]"
                : "border-[var(--hair)] bg-[var(--s1)] opacity-90 hover:opacity-100"
            }`}
          >
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isFirst ? "bg-[var(--acc)] text-white" : "border border-[var(--hair)] bg-[var(--s2)] text-[var(--ink2)]"
              }`}
            >
              {isFirst ? <Icon className="h-5 w-5" aria-hidden /> : <CheckCircle2 className="h-4 w-4 opacity-40" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[var(--ink)]">{step.label}</span>
              <span className="block text-[11px] text-[var(--ink2)]">{isFirst ? "Pašreizējais solis" : "Nākamais"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
