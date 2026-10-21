import type { LogisticsPrintRow } from "@/lib/iriss-logistics-map-print";

/**
 * Drukas 2. lapa: auto saraksts tieši tādā secībā un ar tiem numuriem kā lāses kartē.
 * Ekrānā nav redzams (tikai drukā). Bez cenām un klienta datiem.
 */
export function IrissLogistikaPrintList({ heading, meta, rows }: { heading: string; meta: string; rows: LogisticsPrintRow[] }) {
  return (
    <section className="iriss-log-print-list" aria-hidden>
      <header>
        <h2>{heading}</h2>
        <p>{meta}</p>
      </header>
      {rows.length === 0 ? (
        <p className="empty">Kartē nav auto ar adresi.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="n">Nr.</th>
              <th>Auto</th>
              <th>Vieta un adrese</th>
              <th>Darba laiks</th>
              <th>Pickup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="n">
                  <span>{r.n}</span>
                </td>
                <td>
                  <b>{r.car}</b>
                  {r.vin ? <small className="mono">{r.vin}</small> : null}
                  {r.cargo ? <small>{r.cargo}</small> : null}
                </td>
                <td>
                  {r.place ? <b>{r.place}</b> : null}
                  {r.address ? <small>{r.address}</small> : null}
                  {r.phone ? <small>Tālr. {r.phone}</small> : null}
                </td>
                <td className="hours">{r.hours || "-"}</td>
                <td>
                  {r.pickupRef ? <b className="mono">{r.pickupRef}</b> : "-"}
                  {r.pickupDate ? <small>{r.pickupDate}</small> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
