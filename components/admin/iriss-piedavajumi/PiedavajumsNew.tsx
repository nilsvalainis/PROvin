"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { filterIrissPdCarPicks, type IrissPdCarPick } from "@/lib/iriss-piedavajumi";
import { IRISS_PD_ADAPTERS, irissPdLinkSourceHint, type IrissPdLinkSource } from "@/lib/iriss-piedavajumi-sources";
import { IRISS_PD_SOURCE_LV } from "@/lib/iriss-piedavajumi-types";

const LINK_SOURCES: IrissPdLinkSource[] = ["auto1", "autobid", "openlane", "mobilede"];

type CreateRes = { ok?: boolean; id?: string; message?: string; error?: string; note?: string };

async function postCreate(body: Record<string, unknown>): Promise<CreateRes> {
  const res = await fetch("/api/admin/iriss-piedavajumi", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return ((await res.json().catch(() => ({}))) as CreateRes) ?? {};
}

function Ico({ d }: { d: string }) {
  return (
    <div className="pd-ico" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </div>
  );
}

/** Maketa 03: divi ceļi - «No Autoparka» vai «Ielīmēt izsoles saiti». */
export function PiedavajumsNew({ cars, carsError }: { cars: IrissPdCarPick[]; carsError: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "car" | "link" | "request">("");
  const [err, setErr] = useState("");
  const [linkErr, setLinkErr] = useState("");
  const [canManual, setCanManual] = useState(false);
  const shown = useMemo(() => filterIrissPdCarPicks(cars, query).slice(0, 40), [cars, query]);
  const hint = irissPdLinkSourceHint(url);

  async function go(kind: "car" | "link" | "request", body: Record<string, unknown>) {
    setBusy(kind);
    setErr("");
    setLinkErr("");
    setCanManual(false);
    try {
      const data = await postCreate(body);
      if (data.ok && data.id) {
        router.push(`/admin/iriss/piedavajumi/${data.id}${data.note ? `?note=${encodeURIComponent(data.note)}` : ""}`);
        return;
      }
      const msg = data.message || "Neizdevās izveidot piedāvājumu.";
      if (kind === "link") {
        setLinkErr(msg);
        setCanManual(data.error !== "not_auction_link" && data.error !== "taken");
      } else setErr(msg);
    } catch {
      (kind === "link" ? setLinkErr : setErr)("Neizdevās izveidot piedāvājumu.");
    }
    setBusy("");
  }

  return (
    <div className="pdv">
      <header className="pd-hdr">
        <div className="pd-bc">
          <Link href="/admin/iriss">IRISS</Link> › <Link href="/admin/iriss/piedavajumi">Piedāvājumi</Link> › Jauns
        </div>
        <div className="pd-top">
          <div>
            <h1>Jauns piedāvājums</h1>
            <div className="pd-sub">Izvēlies ceļu - vēlāk visus laukus var labot</div>
          </div>
          <Link className="pd-btn" href="/admin/iriss/piedavajumi">
            Atcelt
          </Link>
        </div>
      </header>
      {err ? <p className="pd-err" role="alert" style={{ maxWidth: 1080 }}>{err}</p> : null}
      <div className="pd-paths">
        <section className="pd-card pd-path" aria-labelledby="pd-path-car">
          <Ico d="M3 13l2-5h14l2 5v5H3z M7.5 16h.01 M16.5 16h.01" />
          <h2 id="pd-path-car">No Autoparka</h2>
          <p className="pd-mu" style={{ margin: 0 }}>Izvēlies esošu auto - visi lauki un foto aizpildās automātiski.</p>
          <label className="pd-srch" style={{ width: "100%", margin: "16px 0 10px", display: "flex", alignItems: "center", gap: 8, height: 38, border: "1px solid #e0e0e5", borderRadius: 9, padding: "0 10px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Meklēt modeli, VIN, reģ. nr..."
              aria-label="Meklēt Autoparkā"
              style={{ border: 0, outline: 0, flex: 1, font: "inherit", background: "transparent" }}
            />
          </label>
          {carsError ? <p className="pd-err">{carsError}</p> : null}
          {shown.length === 0 && !carsError ? <p className="pd-mu">Nekas nav atrasts.</p> : null}
          <div>
            {shown.map((c) => (
              <button
                type="button"
                key={c.id}
                className="pd-carrow"
                disabled={Boolean(c.takenBy) || busy !== ""}
                title={c.takenBy ? `Jau ir piedāvājums ${c.takenBy}` : undefined}
                onClick={() => void go("car", { kind: "autoparks", carId: c.id })}
              >
                <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span className="pd-thumb" style={{ width: 40, height: 28 }} aria-hidden="true" />
                  <span className="pd-el">{c.title}</span>
                  {c.takenBy ? <span className="pd-mu" style={{ fontSize: 11.5 }}>· {c.takenBy}</span> : null}
                </span>
                <b className="pd-mono">{c.vinTail || c.plate}</b>
              </button>
            ))}
          </div>
          {busy === "car" ? (
            <div className="pd-progress" style={{ marginTop: 10 }}>
              <b>Ielādē auto datus un foto...</b>
              <div className="bar">
                <i />
              </div>
            </div>
          ) : null}
          <p className="pd-mu" style={{ fontSize: 11.5, marginTop: 8 }}>Auto, kam jau ir aktīvs piedāvājums, nav izvēlams (1 auto = 1 piedāvājums).</p>
        </section>

        <section className="pd-card pd-path" aria-labelledby="pd-path-link">
          <Ico d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />
          <h2 id="pd-path-link">Ielīmēt izsoles saiti</h2>
          <p className="pd-mu" style={{ margin: 0 }}>Sistēma atpazīst avotu un izvelk datus, foto un cenu.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) void go("link", { kind: "link", url });
            }}
          >
            <div className="pd-fld" style={{ marginTop: 16 }}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.auto1.com/..."
                aria-label="Izsoles saite"
                inputMode="url"
                style={{ height: 42 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {LINK_SOURCES.map((s) => (
                <span key={s} className="pd-src" style={{ fontSize: 12.5, padding: "4px 10px", ...(hint === s ? { borderColor: "#1d1d1f", color: "#1d1d1f" } : {}) }}>
                  {IRISS_PD_SOURCE_LV[s]}
                </span>
              ))}
            </div>
            {hint ? (
              <div className="pd-progress" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b>Atpazīts: {IRISS_PD_SOURCE_LV[hint]}</b>
                  <span className="pd-mu">
                    {busy === "link" ? "Ielādē... līdz 2 min" : IRISS_PD_ADAPTERS[hint].mode === "stub" ? "dati jāaizpilda ar roku" : hint === "auto1" ? "dati + 5 bloki" : "dati + foto"}
                  </span>
                </div>
                {busy === "link" ? (
                  <div className="bar">
                    <i />
                  </div>
                ) : null}
              </div>
            ) : null}
            {linkErr ? <div className="pd-err" role="alert">{linkErr}</div> : null}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="submit" className="pd-btn p" disabled={!url.trim() || busy !== ""}>
                Ielasīt
              </button>
              {canManual ? (
                <button type="button" className="pd-btn" disabled={busy !== ""} onClick={() => void go("link", { kind: "link", url, manual: true })}>
                  Izveidot ar saiti, aizpildīt manuāli
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
      <p className="pd-mu" style={{ marginTop: 16, fontSize: 12.5 }}>
        Klients pieprasīja piedāvājumu, bet auto vēl nav izvēlēts?{" "}
        <button type="button" className="pd-lnk" style={{ border: 0, background: "none", padding: 0 }} disabled={busy !== ""} onClick={() => void go("request", { kind: "request" })}>
          Reģistrēt pieprasījumu
        </button>
      </p>
    </div>
  );
}
