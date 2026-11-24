import { IRISS_SEARCH_SWITCH_LV } from "@/lib/iriss-pasutijumi-types";

/**
 * Meklēšanas slēdzis (makets A, Nils 24.11): viens klikšķis, «Meklē» zaļš / «Nemeklē» pelēks.
 * Tas pats sarakstā un pasūtījuma lapā.
 */
export function IrissSearchSwitch({
  on,
  busy = false,
  onChange,
  className = "",
}: {
  on: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Meklēšana"
      disabled={busy}
      data-iriss-search-switch={on ? "on" : "off"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!on);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap bg-transparent p-0 text-[12px] disabled:opacity-60 max-md:min-h-11 ${
        on ? "font-semibold text-[var(--ink)]" : "font-normal text-[var(--ink2)]"
      } ${className}`.trim()}
    >
      <span>{on ? IRISS_SEARCH_SWITCH_LV.on : IRISS_SEARCH_SWITCH_LV.off}</span>
      <span
        aria-hidden
        className="relative block h-6 w-10 flex-none rounded-full transition-colors"
        style={{ background: on ? "var(--iriss-ok, #16a34a)" : "rgba(116,120,138,.3)" }}
      >
        <span
          className="absolute top-0.5 block h-5 w-5 rounded-full bg-white transition-[left]"
          style={{ left: on ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,.22)" }}
        />
      </span>
    </button>
  );
}
