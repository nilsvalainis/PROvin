import type { V2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { fmtEurRound } from "@/lib/iriss-autoparks-v2-format";

/** Cenu lapas A4 (D4 labā puse un "Priekšskatīt A4"). */
export function A4Sheet({ s }: { s: V2PriceSheet }) {
  const rows: Array<[string, string]> = [
    ["Gads", s.year],
    ["Nobraukums", s.mileage.value],
    ["Motors", s.engine.value.replace(" · ", ", ")],
    ["Kārba", s.gearbox],
    ["Drošības spilveni / ESP / ABS", s.safety],
  ];
  return (
    <div className="ap2-a4">
      <div className="h">{s.displayName}</div>
      {s.equipmentLine ? <div className="eq">{s.equipmentLine}</div> : null}
      <div className="prc">{fmtEurRound(s.listPriceEur)}</div>
      <div className="tab">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
      </div>
    </div>
  );
}
