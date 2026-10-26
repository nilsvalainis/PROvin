"use client";

import { useEffect, useMemo, useState } from "react";
import { filterIrissPdCarPicks, type IrissPdCarPick } from "@/lib/iriss-piedavajumi";
import { irissPdLinkSourceHint } from "@/lib/iriss-piedavajumi-sources";
import { IRISS_PD_SOURCE_LV, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/** «Aizpildīt» pieprasījumu: auto no Autoparka vai izsoles saites (tie paši ceļi kā jaunam piedāvājumam). */
export function PdImportPanel({ id, onDone }: { id: string; onDone: (rec: IrissPiedavajums) => void }) {
  const [cars, setCars] = useState<IrissPdCarPick[] | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shown = useMemo(() => filterIrissPdCarPicks(cars ?? [], query).slice(0, 8), [cars, query]);
  const hint = irissPdLinkSourceHint(url);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/iriss-piedavajumi/cars", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { cars?: IrissPdCarPick[] }) => alive && setCars(d.cars ?? []))
      .catch(() => alive && setCars([]));
    return () => {
      alive = false;
    };
  }, []);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/iriss-piedavajumi/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import", ...body }),
      });
      const data = (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās ielasīt.");
      onDone(data.record);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās ielasīt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pd-card">
      <h3>Aizpildīt - izvēlies auto</h3>
      <div className="pd-grid2">
        <div className="pd-fld">
          <label htmlFor="pd-imp-q">No Autoparka</label>
          <input id="pd-imp-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Meklēt modeli, VIN, reģ. nr..." />
          {cars === null ? <p className="pd-hint">Ielādē...</p> : null}
          {query.trim()
            ? shown.map((c) => (
                <button type="button" key={c.id} className="pd-carrow" disabled={busy || Boolean(c.takenBy)} onClick={() => void run({ kind: "autoparks", carId: c.id })}>
                  <span className="pd-el">{c.title}</span>
                  <b className="pd-mono">{c.takenBy || c.vinTail}</b>
                </button>
              ))
            : null}
        </div>
        <div className="pd-fld">
          <label htmlFor="pd-imp-url">Izsoles saite{hint ? ` · ${IRISS_PD_SOURCE_LV[hint]}` : ""}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="pd-imp-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" />
            <button type="button" className="pd-btn p" disabled={busy || !url.trim()} onClick={() => void run({ kind: "link", url })}>
              Ielasīt
            </button>
          </div>
        </div>
      </div>
      {busy ? (
        <div className="pd-progress">
          <b>Ielasa datus...</b>
          <div className="bar">
            <i />
          </div>
        </div>
      ) : null}
      {err ? <p className="pd-err" role="alert">{err}</p> : null}
    </section>
  );
}
