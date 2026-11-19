/* eslint-disable @next/next/no-img-element */
import { servisaLapaCounts, type ServisaLapa } from "@/lib/iriss-autoparks-v2-servisa-lapa";

function Foot({ s, label, page, pages }: { s: ServisaLapa; label: string; page: number; pages: number }) {
  return (
    <div className="ap2-svl-foot">
      <span>
        {s.ownerName} · Autoparks · {label}
      </span>
      <span>
        {page}/{pages}
      </span>
    </div>
  );
}

/** 1. lapa «Servisa darbu lapa» pēc apstiprinātā maketa (Nils 19.11). Bez summām, akta numuriem un foto. */
export function ServisaLapaSheet({ s, pages }: { s: ServisaLapa; pages: number }) {
  const total = s.problems.length;
  return (
    <section className="ap2-svl-sheet" aria-label="Servisa darbu lapa">
      <div className="ap2-svl-top">
        <div className={`ap2-svl-sia ${s.owner === "DZA" ? "dza" : "iriss"}`}>
          <div className="lbl">Īpašnieks</div>
          <div className="name">{s.ownerName}</div>
          {s.ownerRegNo ? <div className="reg">Reģ. nr. {s.ownerRegNo}</div> : null}
        </div>
        <div className="ap2-svl-title">
          <h1>Servisa darbu lapa</h1>
          <div className="meta">
            Izdrukāts {s.printedAt} · Autoparks{s.statusLabel ? ` · Statuss: ${s.statusLabel}` : ""}
          </div>
        </div>
      </div>

      <div className="ap2-svl-car">
        <div className="head">
          <div className="model">{s.title}</div>
          {s.vin ? <div className="vin">{s.vin}</div> : null}
        </div>
        {s.tech.length > 0 ? (
          <div className="ap2-svl-grid">
            {s.tech.map((t) => (
              <div key={t.label}>
                <span>{t.label}</span>
                <b>{t.value}</b>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <h2>
        Problēmas ({total}) · {servisaLapaCounts(s.doneCount, s.openCount)}
      </h2>
      {total > 0 ? (
        <table className="ap2-svl-tab">
          <thead>
            <tr>
              <th>#</th>
              <th>Problēma</th>
              <th>Statuss</th>
            </tr>
          </thead>
          <tbody>
            {s.problems.map((p) => (
              <tr key={p.n}>
                <td className="n">{p.n}</td>
                <td className="t">{p.text}</td>
                <td className="st">
                  <span className={`chip ${p.done ? "done" : "open"}`}>{p.done ? "☑ Izdarīts" : "☐ Neizdarīts"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="ap2-svl-notes">Nav problēmu</div>
      )}

      <h2>Servisa piezīmes</h2>
      <div className="ap2-svl-notes pre">{s.notes || "Nav piezīmju"}</div>

      <Foot s={s} label="Servisa darbu lapa" page={1} pages={pages} />
    </section>
  );
}

export type DiagPageState = { kind: "loading" } | { kind: "image"; src: string } | { kind: "failed"; href: string };

/** 2. lapa: CSDD diagnostikas skenējums visā lapā; augšā īpašnieks, auto + VIN, «CSDD diagnostika». */
export function ServisaDiagSheet({ s, page, pages, state }: { s: ServisaLapa; page: number; pages: number; state: DiagPageState }) {
  return (
    <section className="ap2-svl-sheet p2" aria-label="CSDD diagnostika">
      <div className="ap2-svl-bar">
        <span className={`sia-s ${s.owner === "DZA" ? "dza" : "iriss"}`}>{s.ownerName}</span>
        <b>
          {s.title}
          {s.vin ? ` · ${s.vin}` : ""}
        </b>
        <span className="lab">CSDD diagnostika</span>
      </div>
      <div className="ap2-svl-scan">
        {state.kind === "image" ? (
          <img src={state.src} alt="CSDD diagnostika" />
        ) : state.kind === "failed" ? (
          <p>
            CSDD diagnostiku neizdevās parādīt drukai.
            <br />
            <a className="ap2-noprint" href={state.href} target="_blank" rel="noreferrer">
              Atvērt skenējumu
            </a>
          </p>
        ) : (
          <p>Ielādē CSDD diagnostiku...</p>
        )}
      </div>
      <Foot s={s} label="CSDD diagnostika" page={page} pages={pages} />
    </section>
  );
}

