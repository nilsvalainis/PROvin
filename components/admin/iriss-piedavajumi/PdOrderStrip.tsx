import Link from "next/link";
import { PdStatusChip } from "@/components/iriss-piedavajumi/PdStatusChip";
import { formatIrissPdPrice, irissPdLastClientQuestion, irissPdRowEffectiveStatus } from "@/lib/iriss-piedavajumi";
import { irissPdNumberLabel, type IrissPdListRow } from "@/lib/iriss-piedavajumi-types";

/**
 * j70: pasūtījuma lapā - šī klienta piedāvājumi no sadaļas «Piedāvājumi» (dublikāts klienta pasūtījumos, Q14)
 * un piedāvājums, no kura pasūtījums izveidots (savstarpēja saite). Tikai adminam.
 */
export function PdOrderStrip({ rows, nowMs }: { rows: IrissPdListRow[]; nowMs: number }) {
  if (rows.length === 0) return null;
  return (
    <div className="pdv" style={{ minHeight: 0, padding: "10px 12px 0", background: "transparent" }} data-pd-order-strip="">
      <div className="pd-card" style={{ padding: "10px 14px" }}>
        <div className="pd-h3" style={{ marginBottom: 6 }}>Piedāvājumi</div>
        {rows.map((r) => (
          <Link key={r.id} href={`/admin/iriss/piedavajumi/${r.id}`} className="pd-kv" style={{ alignItems: "center" }}>
            <span className="pd-el">
              {irissPdNumberLabel(r.number)} · {r.title || "Auto"}
              {r.price ? ` · ${formatIrissPdPrice(r.price)}` : ""}
            </span>
            <PdStatusChip status={irissPdRowEffectiveStatus(r, nowMs)} />
          </Link>
        ))}
        {rows.map((r) => {
          // Klienta pēdējais jautājums no saites - uzreiz redzams pasūtījumā (pilnā vēsture - Komunikācija).
          const q = irissPdLastClientQuestion(r);
          return q ? (
            <p key={`${r.id}-q`} className="pd-el" style={{ margin: "4px 0 0", fontSize: 13 }} data-pd-order-question="">
              <b style={{ fontWeight: 600 }}>Jautājums ({irissPdNumberLabel(r.number)}):</b> {q.text}
            </p>
          ) : null;
        })}
      </div>
    </div>
  );
}
