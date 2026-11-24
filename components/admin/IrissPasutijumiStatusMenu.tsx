import { IRISS_ORDER_STAGES, IRISS_ORDER_STAGE_LV, IRISS_ORDER_STAGE_SEARCH_LV, type IrissOrderStage } from "@/lib/iriss-pasutijumi-types";

export const IRISS_PASUTIJUMI_STATUS_MENU_CLASS =
  "iriss-ov-menu iriss-ov-menu-portal fixed z-[200] min-w-[8.5rem] overflow-hidden rounded-2xl bg-[var(--s1,#fff)] py-1 text-[var(--ink,#0b0c10)] shadow-[var(--gsh,0_8px_22px_rgba(16,24,40,0.12))]";

export function IrissPasutijumiStatusMenuItems({
  currentStatus,
  busy = false,
  onPick,
}: {
  currentStatus: IrissOrderStage;
  busy?: boolean;
  onPick: (stage: IrissOrderStage) => void;
}) {
  const current = currentStatus;
  return (
    <>
      {IRISS_ORDER_STAGES.map((s) => (
        <button
          key={s}
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPick(s);
          }}
          className={`flex min-h-10 w-full items-center justify-between gap-3 px-3.5 text-left text-[14px] font-medium ${
            current === s ? "bg-[var(--fill)] text-[var(--ink)]" : "text-[var(--ink)] hover:bg-[var(--fill)]"
          }`}
        >
          <span>{IRISS_ORDER_STAGE_LV[s]}</span>
          <span className="text-[12px] font-normal text-[var(--ink3)]">{IRISS_ORDER_STAGE_SEARCH_LV[s]}</span>
        </button>
      ))}
    </>
  );
}

/** Atvērtās statusa izvēlnes virsma (bez portāla) - testi un vizuālais kanons. */
export function IrissPasutijumiStatusMenuSurface({
  currentStatus,
  busy = false,
  onPick,
  style,
}: {
  currentStatus: IrissOrderStage;
  busy?: boolean;
  onPick?: (stage: IrissOrderStage) => void;
  style?: { top: number; left: number };
}) {
  return (
    <div
      role="menu"
      data-iriss-anchored-popover=""
      className={IRISS_PASUTIJUMI_STATUS_MENU_CLASS}
      style={style}
    >
      <IrissPasutijumiStatusMenuItems currentStatus={currentStatus} busy={busy} onPick={onPick ?? (() => undefined)} />
    </div>
  );
}
