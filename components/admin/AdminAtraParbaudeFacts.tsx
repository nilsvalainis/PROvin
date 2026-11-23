"use client";

import { useState } from "react";
import { ATRA_POTENTIAL_LABEL } from "@/lib/atra-parbaude";
import {
  ATRA_SCORE_MAX,
  ECSDD_URL,
  atraLvDate,
  formatKm,
  type AtraFacts,
  type AtraMileageFact,
  type AtraScore,
} from "@/lib/atra-parbaude-facts";

/** Dators: esošais admin stils. Telefons (`glass`): 3. posma stikla palete (--am-* mainīgie). */
function useTone(glass: boolean) {
  return glass
    ? {
        card: "rounded-[18px] bg-[var(--am-s1)] px-4 py-3.5 shadow-[var(--am-card-shadow)]",
        line: "border-[var(--am-hair)]",
        ink: "text-[var(--am-ink)]",
        mut: "text-[var(--am-ink3)]",
        mut2: "text-[var(--am-ink2,var(--am-ink3))]",
        acc: "text-[var(--am-accent,#0b3fa8)]",
        accBg: "bg-[var(--am-accent,#0b3fa8)]",
        chip: "border border-[var(--am-hair)] bg-[var(--am-s2,transparent)]",
        red: "text-[var(--am-red,#c4271d)]",
      }
    : {
        card: "rounded-[14px] border border-[#e5e5ea] bg-white px-[14px] py-[13px]",
        line: "border-[#e5e5ea]",
        ink: "text-[#111]",
        mut: "text-[#8e8e93]",
        mut2: "text-[#3a3a3c]",
        acc: "text-[#0b3fa8]",
        accBg: "bg-[#0b3fa8]",
        chip: "border border-[#e5e5ea] bg-white",
        red: "text-[#d70015]",
      };
}

export function AdminAtraPotential({ score, glass = false }: { score: AtraScore; glass?: boolean }) {
  const t = useTone(glass);
  return (
    <section className={`${t.card} grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_1fr]`} data-atra-potential={score.level}>
      <div className="flex min-w-[150px] flex-col gap-1">
        <small className={`text-[11.5px] font-semibold uppercase tracking-[0.5px] ${t.mut}`}>Stāsta potenciāls</small>
        <b className={`text-[26px] font-bold tracking-tight ${t.ink}`}>{ATRA_POTENTIAL_LABEL[score.level]}</b>
        <span className="mt-0.5 flex gap-[3px]" aria-label={`${score.points} no ${ATRA_SCORE_MAX}`}>
          {Array.from({ length: ATRA_SCORE_MAX }, (_, i) => (
            <i key={i} className={`h-1.5 w-[13px] rounded-[2px] ${i < score.points ? t.accBg : "bg-[#e5e5ea]"}`} />
          ))}
        </span>
        <span className={`text-[12px] ${t.mut}`}>
          {score.points} no {ATRA_SCORE_MAX}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {score.reasons.map((r) => (
          <span key={r.text} className={`rounded-lg px-[9px] py-1 text-[12.5px] ${t.chip} ${r.points ? t.ink : t.mut}`}>
            <em className={`mr-1 font-bold not-italic ${r.points ? t.acc : t.mut}`}>{r.points ? `+${r.points}` : "0"}</em>
            {r.text}
          </span>
        ))}
      </div>
    </section>
  );
}

function MileageChart({ m }: { m: AtraMileageFact }) {
  const pts = m.points;
  if (pts.length < 2) return null;
  const xs = pts.map((p) => Date.parse(p.date));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...pts.map((p) => p.km)) || 1;
  const W = 300;
  const H = 80;
  const x = (v: number) => (maxX === minX ? W / 2 : ((v - minX) / (maxX - minX)) * (W - 8) + 4);
  const y = (km: number) => H - 6 - (km / maxY) * (H - 14);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(xs[i]!).toFixed(1)},${y(p.km).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[92px] w-full" role="img" aria-label="Nobraukuma līnija">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[#0b3fa8]" />
      {m.drop ? (
        <line
          x1={x(Date.parse(m.drop.from.date))}
          y1={y(m.drop.from.km)}
          x2={x(Date.parse(m.drop.to.date))}
          y2={y(m.drop.to.km)}
          stroke="#d70015"
          strokeWidth="2.2"
        />
      ) : null}
      {pts.map((p, i) => (
        <circle key={`${p.date}-${p.km}`} cx={x(xs[i]!)} cy={y(p.km)} r="2.4" fill={m.drop && (p === m.drop.from || p === m.drop.to) ? "#d70015" : "#0b3fa8"} />
      ))}
    </svg>
  );
}

function Fact({
  k,
  v,
  s,
  src,
  alert,
  wide,
  glass,
  children,
}: {
  k: string;
  v: string;
  s?: React.ReactNode;
  src?: React.ReactNode;
  alert?: boolean;
  wide?: boolean;
  glass: boolean;
  children?: React.ReactNode;
}) {
  const t = useTone(glass);
  return (
    <div
      className={`${t.card} flex min-h-[126px] flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""} ${alert && !glass ? "!border-[#f3c1c6]" : ""}`}
      data-atra-fact={k}
    >
      <span className={`text-[11.5px] font-semibold uppercase tracking-[0.4px] ${t.mut}`}>{k}</span>
      <span className={`text-[19px] font-bold leading-tight tracking-tight ${alert ? t.red : t.ink}`}>{v}</span>
      {s ? <span className={`text-[12.5px] leading-snug ${t.mut2}`}>{s}</span> : null}
      {children}
      {src ? <span className={`mt-auto text-[11.5px] ${t.mut}`}>{src}</span> : null}
    </div>
  );
}

export function AdminAtraFactCards({
  facts,
  vin,
  glass = false,
}: {
  facts: AtraFacts;
  vin: string;
  glass?: boolean;
}) {
  const m = facts.mileage;
  const a = facts.auctions;
  const d = facts.dealer;
  const shown = a.photos.slice(0, 4);
  const more = Math.max(0, a.photoCount - shown.length);
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-atra-facts>
      <Fact
        glass={glass}
        wide
        alert={Boolean(m.drop)}
        k="Nobraukums"
        v={m.drop ? `Kritums ≥ ${formatKm(m.drop.km)} km` : m.last ? `${formatKm(m.last.km)} km` : "Nav datu"}
        s={
          m.drop ? (
            <>
              {m.drop.from.source} {atraLvDate(m.drop.from.date)}: {formatKm(m.drop.from.km)} km → {m.drop.to.source}{" "}
              {atraLvDate(m.drop.to.date)}: {formatKm(m.drop.to.km)} km.
              {m.last && m.last !== m.drop.to ? ` Pēdējais ${atraLvDate(m.last.date)}: ${formatKm(m.last.km)} km.` : ""}{" "}
              <b>Faktiski ≥ {formatKm(m.actualMinKm)} km.</b>
            </>
          ) : m.points.length ? (
            `${m.points.length} ieraksti · pēdējais ${atraLvDate(m.last!.date)}`
          ) : undefined
        }
        src={[...new Set(m.points.map((p) => p.source))].slice(0, 4).join(" · ")}
      >
        <MileageChart m={m} />
      </Fact>
      <Fact
        glass={glass}
        alert={facts.wanted.length > 0}
        k="Liegumi"
        v={facts.wanted.length ? `Meklēšanā: ${facts.wanted.length}` : "Jāpārbauda"}
        s={
          <>
            {facts.wanted.length ? `${facts.wanted.join(", ")}. ` : ""}
            CSDD API liegumus nedod.{" "}
            <a href={ECSDD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0b3fa8]">
              Pārbaudīt e.csdd.lv ›
            </a>
          </>
        }
        src="e.csdd.lv (Smart-ID)"
      />
      <Fact
        glass={glass}
        alert={facts.incidents.count > 0}
        k="Negadījumi"
        v={facts.incidents.count ? `${facts.incidents.count} fiksēti` : "Nav fiksēti"}
        s={facts.incidents.items.slice(0, 3).join(" · ") || undefined}
        src={facts.incidents.sources.join(" · ") || undefined}
      />
      <Fact
        glass={glass}
        wide
        k="Izsoles"
        v={a.count ? `${a.count} izsole${a.count === 1 ? "" : "s"}${a.years.length ? ` · ${a.years.join(", ")}` : ""}` : a.photoCount ? `${a.photoCount} bildes` : "Nav atrastas"}
        s={a.venues.join(", ") || undefined}
        src={
          a.sources.length ? (
            <>
              {a.sources.join(" · ")} ·{" "}
              <a href={`/admin/izsolu-arhivs?vin=${encodeURIComponent(vin)}`} className="text-[#0b3fa8]">
                atvērt galeriju
              </a>
            </>
          ) : undefined
        }
      >
        {shown.length ? (
          <div className="grid grid-cols-5 gap-1.5">
            {shown.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-md bg-[#e9e9ee] object-cover" />
            ))}
            {more ? (
              <span className="flex aspect-[4/3] items-center justify-center rounded-md bg-[#1b1c1f] text-[13px] font-semibold text-white">+{more}</span>
            ) : null}
          </div>
        ) : null}
      </Fact>
      <Fact
        glass={glass}
        k="Valstis"
        v={facts.countries.length ? facts.countries.join(" + ") : "Nav datu"}
        s={facts.countries.length >= 2 ? "Auto bijis vairākās valstīs" : undefined}
        src="reģistri"
      />
      <Fact
        glass={glass}
        k="Dīlera apkopes"
        v={d ? `${d.visits} vizītes` : "Nav ielādētas"}
        s={
          d
            ? `${d.firstYear}-${d.lastYear} · garākais robs ${d.longestGapMonths} mēn. · pēdējā ${d.lastDate}${d.lastKm ? `, ${d.lastKm} km` : ""}`
            : "OE Service History (maksas) augšā"
        }
        src={d ? "OneAuto" : undefined}
      />
      <Fact
        glass={glass}
        alert={facts.listing.kmDeviates}
        k="Cena / vērtība"
        v={facts.listing.price || (facts.listing.has ? "Sludinājums" : "Nav sludinājuma")}
        s={
          facts.listing.has
            ? [facts.listing.km ? `${formatKm(facts.listing.km)} km` : "", facts.listing.kmDeviates ? "km būtiski mazāks par datiem" : ""]
                .filter(Boolean)
                .join(" · ") || undefined
            : "Pievieno saiti augšā - salīdzinās cenu un km"
        }
        src="Sludinājuma vēsture"
      />
      <Fact
        glass={glass}
        k="Tehniskā apskate"
        v={facts.inspection.until ? `līdz ${facts.inspection.until}` : "Nav datu"}
        s={facts.inspection.count ? `${facts.inspection.count} apskates${facts.inspection.last ? ` · pēdējā ${facts.inspection.last}` : ""}` : undefined}
        src="CSDD"
      />
    </div>
  );
}

export function AdminAtraCopyButton({ text, className }: { text: string; className?: string }) {
  const [note, setNote] = useState("");
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => setNote("Nokopēts"))
          .catch(() => setNote("Neizdevās kopēt"));
        window.setTimeout(() => setNote(""), 2000);
      }}
      data-atra-copy
    >
      {note || "Kopēt"}
    </button>
  );
}
