"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterIrissPdCarPicks, type IrissPdCarPick } from "@/lib/iriss-piedavajumi";
import { IRISS_PD_ENTRY_TAB_LV, type IrissPdEntry, type IrissPdEntryTab } from "@/lib/iriss-pd-entry";
import { IRISS_PD_ADAPTERS, irissPdLinkSourceHint, type IrissPdLinkSource } from "@/lib/iriss-piedavajumi-sources";
import { IRISS_PD_SOURCE_LV, type IrissPdClient } from "@/lib/iriss-piedavajumi-types";

const LINK_SOURCES: IrissPdLinkSource[] = ["auto1", "autobid", "openlane", "mobilede"];
const TABS: IrissPdEntryTab[] = ["link", "autoparks", "logistics", "empty"];

type CreateRes = { ok?: boolean; id?: string; message?: string; error?: string; note?: string };
type Busy = "" | "car" | "link" | "empty" | "request";

async function postCreate(body: Record<string, unknown>): Promise<CreateRes> {
  const res = await fetch("/api/admin/iriss-piedavajumi", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return ((await res.json().catch(() => ({}))) as CreateRes) ?? {};
}

function Progress({ text }: { text: string }) {
  return (
    <div className="pd-progress" style={{ marginTop: 10 }}>
      <b>{text}</b>
      <div className="bar">
        <i />
      </div>
    </div>
  );
}

function CarList({
  picks,
  error,
  disabled,
  placeholder,
  onPick,
}: {
  picks: IrissPdCarPick[];
  error: string;
  disabled: boolean;
  placeholder: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterIrissPdCarPicks(picks, query).slice(0, 40), [picks, query]);
  return (
    <>
      <label className="pd-new-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {error ? <p className="pd-err">{error}</p> : null}
      {shown.length === 0 && !error ? <p className="pd-mu">Nekas nav atrasts.</p> : null}
      <div>
        {shown.map((c) => (
          <button
            type="button"
            key={c.id}
            className="pd-carrow"
            disabled={Boolean(c.takenBy) || disabled}
            title={c.takenBy ? `Jau ir piedāvājums ${c.takenBy}` : undefined}
            onClick={() => onPick(c.id)}
          >
            <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
              <span className="pd-el">{c.title}</span>
              {c.takenBy ? <span className="pd-mu" style={{ fontSize: 11.5 }}>· {c.takenBy}</span> : null}
            </span>
            <b className="pd-mono">{c.vinTail || c.plate}</b>
          </button>
        ))}
      </div>
      <p className="pd-mu" style={{ fontSize: 11.5, marginTop: 8 }}>Auto, kam jau ir aktīvs piedāvājums, nav izvēlams (1 auto = 1 piedāvājums).</p>
    </>
  );
}

/**
 * Viena piedāvājuma ieeja (Nils 27.10, makets «Piedāvājumi - viena sistēma»): Saite / Autoparks / Loģistika / Tukšs.
 * Klients nav obligāts; ja atvērts no pasūtījuma, klients un pasūtījums piesaistās uzreiz.
 * Ja poga jau nodeva auto vai saiti (`?from=` / `?link=`), piedāvājums izveidojas uzreiz - bez lieka klikšķa.
 */
export function PiedavajumsNew({
  cars,
  carsError,
  logistics = [],
  logisticsError = "",
  entry,
  client = null,
}: {
  cars: IrissPdCarPick[];
  carsError: string;
  logistics?: IrissPdCarPick[];
  logisticsError?: string;
  entry?: IrissPdEntry;
  client?: IrissPdClient | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<IrissPdEntryTab>(entry?.tab ?? "link");
  const [url, setUrl] = useState(entry?.link ?? "");
  const [withClient, setWithClient] = useState(Boolean(client));
  const [busy, setBusy] = useState<Busy>("");
  const [err, setErr] = useState("");
  const [canManual, setCanManual] = useState(false);
  const started = useRef(false);
  const hint = irissPdLinkSourceHint(url);
  const clientBody = withClient && client ? { client } : {};

  async function go(kind: Busy, body: Record<string, unknown>) {
    setBusy(kind);
    setErr("");
    setCanManual(false);
    try {
      const data = await postCreate({ ...body, ...clientBody });
      if (data.ok && data.id) {
        router.push(`/admin/iriss/piedavajumi/${data.id}${data.note ? `?note=${encodeURIComponent(data.note)}` : ""}`);
        return;
      }
      setErr(data.message || "Neizdevās izveidot piedāvājumu.");
      if (kind === "link") setCanManual(data.error !== "not_auction_link" && data.error !== "taken");
    } catch {
      setErr("Neizdevās izveidot piedāvājumu.");
    }
    setBusy("");
  }

  // Poga no Autoparka / Loģistikas / izsoles trāpījuma jau zina auto - veido uzreiz.
  useEffect(() => {
    if (started.current || !entry) return;
    if ((entry.tab === "autoparks" || entry.tab === "logistics") && entry.carId) {
      started.current = true;
      void go("car", { kind: entry.tab, carId: entry.carId });
    } else if (entry.tab === "link" && entry.link) {
      started.current = true;
      void go("link", { kind: "link", url: entry.link });
    }
    // go ir stabila šī komponenta dzīves laikā; tikai pirmajā renderī.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  return (
    <div className="pdv">
      <header className="pd-hdr">
        <div className="pd-bc">
          <Link href="/admin/iriss">IRISS</Link> › <Link href="/admin/iriss/piedavajumi">Piedāvājumi</Link> › Jauns
        </div>
        <div className="pd-top">
          <div>
            <h1>Jauns piedāvājums</h1>
            <div className="pd-sub">Izvēlies, no kā veidot - vēlāk visus laukus var labot</div>
          </div>
          <Link className="pd-btn" href="/admin/iriss/piedavajumi">
            Atcelt
          </Link>
        </div>
      </header>

      <section className="pd-card pd-new" aria-label="Piedāvājuma avots">
        <div className="pd-seg" role="tablist" aria-label="Avots">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={busy !== ""} onClick={() => setTab(t)}>
              {IRISS_PD_ENTRY_TAB_LV[t]}
            </button>
          ))}
        </div>

        {client ? (
          <div className="pd-new-client">
            <span className="pd-mu">Klients</span>
            {withClient ? (
              <span>
                <b>{client.name || "No pasūtījuma"}</b>{" "}
                <button type="button" className="pd-lnk" style={{ border: 0, background: "none", padding: 0 }} onClick={() => setWithClient(false)}>
                  noņemt
                </button>
              </span>
            ) : (
              <span>
                bez klienta{" "}
                <button type="button" className="pd-lnk" style={{ border: 0, background: "none", padding: 0 }} onClick={() => setWithClient(true)}>
                  piesaistīt {client.name || "pasūtījuma klientu"}
                </button>
              </span>
            )}
          </div>
        ) : (
          <p className="pd-mu pd-new-client">Klients nav obligāts - to var piesaistīt vēlāk.</p>
        )}

        {err ? (
          <p className="pd-err" role="alert">
            {err}
          </p>
        ) : null}

        {tab === "link" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) void go("link", { kind: "link", url });
            }}
          >
            <div className="pd-fld" style={{ marginTop: 4 }}>
              <span className="lbl">Izsoles vai sludinājuma saite</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.auto1.com/..."
                aria-label="Izsoles vai sludinājuma saite"
                inputMode="url"
                style={{ height: 44 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {LINK_SOURCES.map((s) => (
                <span key={s} className="pd-src" style={{ fontSize: 12.5, padding: "4px 10px", ...(hint === s ? { borderColor: "#1d1d1f", color: "#1d1d1f" } : {}) }}>
                  {IRISS_PD_SOURCE_LV[s]}
                </span>
              ))}
            </div>
            {hint ? (
              <p className="pd-mu" style={{ margin: "0 0 8px" }}>
                Atpazīts: <b>{IRISS_PD_SOURCE_LV[hint]}</b> ·{" "}
                {IRISS_PD_ADAPTERS[hint].mode === "stub" ? "dati jāaizpilda ar roku" : hint === "auto1" ? "dati + 5 bloki" : "dati + foto"}
              </p>
            ) : null}
            {busy === "link" ? <Progress text="Ielādē datus un foto... līdz 2 min" /> : null}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="submit" className="pd-btn p lg" disabled={!url.trim() || busy !== ""}>
                Turpināt uz formu
              </button>
              {canManual ? (
                <button type="button" className="pd-btn lg" disabled={busy !== ""} onClick={() => void go("link", { kind: "link", url, manual: true })}>
                  Izveidot ar saiti, aizpildīt ar roku
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {tab === "autoparks" ? (
          <>
            <CarList
              picks={cars}
              error={carsError}
              disabled={busy !== ""}
              placeholder="Meklēt Autoparkā: modelis, VIN, reģ. nr."
              onPick={(id) => void go("car", { kind: "autoparks", carId: id })}
            />
            {busy === "car" ? <Progress text="Ielādē auto datus un foto..." /> : null}
          </>
        ) : null}

        {tab === "logistics" ? (
          <>
            <CarList
              picks={logistics}
              error={logisticsError}
              disabled={busy !== ""}
              placeholder="Meklēt Loģistikā: modelis, VIN, lots"
              onPick={(id) => void go("car", { kind: "logistics", carId: id })}
            />
            {busy === "car" ? <Progress text="Ielādē auto datus un foto..." /> : null}
          </>
        ) : null}

        {tab === "empty" ? (
          <div>
            <p className="pd-mu" style={{ margin: "4px 0 12px" }}>Tukšs piedāvājums - auto datus, foto un cenu ievadi ar roku.</p>
            <button type="button" className="pd-btn p lg" disabled={busy !== ""} onClick={() => void go("empty", { kind: "manual" })}>
              Izveidot tukšu piedāvājumu
            </button>
          </div>
        ) : null}

      </section>

      <p className="pd-mu" style={{ marginTop: 16, fontSize: 12.5 }}>
        Klients pieprasīja piedāvājumu, bet auto vēl nav izvēlēts?{" "}
        <button type="button" className="pd-lnk" style={{ border: 0, background: "none", padding: 0 }} disabled={busy !== ""} onClick={() => void go("request", { kind: "request" })}>
          Reģistrēt pieprasījumu
        </button>
      </p>
    </div>
  );
}
