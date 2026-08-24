import { buildPanelDamageSilhouetteSvg } from "@/lib/damage-silhouette-panels";
import { resolveDamageMarks, type DamageZoneId } from "@/lib/damage-zones";
import { sectionIconPdfHtml, type SectionIconId } from "@/lib/section-icons";

type Src = { name: string; key: string; amount?: string };

type HubIncident = {
  date: string;
  amount: string;
  country: string;
  flag: string;
  sources: Src[];
  zoneIds: DamageZoneId[];
  zoneLabels: string[];
  groupLabels: string[];
};

type HubEvent = {
  id: string;
  kind: "first_reg" | "import" | "inspection" | "owner" | "incident" | "odometer" | "service";
  date: string;
  year: string;
  country: string;
  flag: string;
  km?: string;
  sources: Src[];
  incident?: HubIncident;
  ta?: { result: string; next?: string; ok: boolean };
  ownerN?: string;
  works?: string;
  fromFlag?: string;
  fromCountry?: string;
};

const WARN = `<svg class="hh-warn" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" stroke="#FF4D4D" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="#FF4D4D" stroke-width="2" stroke-linecap="round"/></svg>`;

const INC_2016: HubIncident = {
  date: "05.2016",
  amount: "~1 636 €",
  country: "Latvija",
  flag: "🇱🇻",
  sources: [
    { name: "LTAB", key: "ltab", amount: "1 521.14 €" },
    { name: "CarVertical", key: "carvertical", amount: "1 501 - 2 000 €" },
  ],
  zoneIds: [],
  zoneLabels: ["Ārpuse / Nav norādīts"],
  groupLabels: ["Remonta izmaksas"],
};

const INC_2021: HubIncident = {
  date: "03.2021",
  amount: "2 400 €",
  country: "Vācija",
  flag: "🇩🇪",
  sources: [{ name: "AutoDNA", key: "autodna", amount: "2 400 €" }],
  zoneIds: ["front"],
  zoneLabels: ["Priekšpuse / Buferis"],
  groupLabels: [],
};

/** Q7-stila izgriezums: imports, TA, negadījumi, īpašnieki. */
const HUB_EVENTS: HubEvent[] = [
  {
    id: "fr",
    kind: "first_reg",
    date: "28.03.2014",
    year: "2014",
    country: "Vācija",
    flag: "🇩🇪",
    km: "14 km",
    sources: [{ name: "CSDD", key: "csdd" }],
  },
  {
    id: "imp",
    kind: "import",
    date: "01.02.2016",
    year: "2016",
    country: "Latvija",
    flag: "🇱🇻",
    fromFlag: "🇩🇪",
    fromCountry: "Vācija",
    sources: [{ name: "CSDD", key: "csdd" }],
  },
  {
    id: "reglv",
    kind: "first_reg",
    date: "01.02.2016",
    year: "2016",
    country: "Latvija",
    flag: "🇱🇻",
    km: "33 227 km",
    sources: [{ name: "CSDD", key: "csdd" }],
    ownerN: "1. reģistrācija Latvijā",
  },
  {
    id: "ta16",
    kind: "inspection",
    date: "01.02.2016",
    year: "2016",
    country: "Latvija",
    flag: "🇱🇻",
    km: "33 227 km",
    sources: [{ name: "CSDD", key: "csdd" }],
    ta: { result: "Izgāja · 0 — teicamā stāvoklī", next: "01.02.2018", ok: true },
  },
  {
    id: "odo16",
    kind: "odometer",
    date: "30.03.2016",
    year: "2016",
    country: "Latvija",
    flag: "🇱🇻",
    km: "39 000 km",
    sources: [{ name: "AutoDNA", key: "autodna" }],
  },
  {
    id: "inc16",
    kind: "incident",
    date: "05.2016",
    year: "2016",
    country: "Latvija",
    flag: "🇱🇻",
    sources: INC_2016.sources,
    incident: INC_2016,
  },
  {
    id: "own17",
    kind: "owner",
    date: "10.03.2017",
    year: "2017",
    country: "Latvija",
    flag: "🇱🇻",
    km: "66 429 km",
    sources: [{ name: "CSDD", key: "csdd" }],
    ownerN: "2. īpašnieks Latvijā",
  },
  {
    id: "inc21",
    kind: "incident",
    date: "03.2021",
    year: "2021",
    country: "Vācija",
    flag: "🇩🇪",
    sources: INC_2021.sources,
    incident: INC_2021,
  },
  {
    id: "own21",
    kind: "owner",
    date: "12.04.2021",
    year: "2021",
    country: "Latvija",
    flag: "🇱🇻",
    km: "122 550 km",
    sources: [{ name: "CSDD", key: "csdd" }],
    ownerN: "3. īpašnieks Latvijā",
  },
  {
    id: "svc21",
    kind: "service",
    date: "18.06.2021",
    year: "2021",
    country: "Latvija",
    flag: "🇱🇻",
    km: "124 100 km",
    sources: [{ name: "Dīleris", key: "dealer" }],
    works: "Regulārā apkope · eļļa, filtri",
  },
];

function ico(id: SectionIconId): string {
  return `<span class="hh-ico" aria-hidden="true">${sectionIconPdfHtml(id)}</span>`;
}

function dots(sources: Src[]): string {
  return sources.map((s) => `<i class="hh-dot hh-dot--${s.key}" title="${s.name}"></i>`).join("");
}

function srcLine(sources: Src[]): string {
  const items = sources
    .map((s) => {
      const amt = s.amount ? `<span class="hh-src-amt">${s.amount}</span>` : "";
      return `<li><i class="hh-dot hh-dot--${s.key}"></i><span>${s.name}</span>${amt}</li>`;
    })
    .join("");
  return `<ul class="hh-src">${items}</ul>`;
}

function topCar(inc: HubIncident, uid: string): string {
  const marks = resolveDamageMarks(inc.zoneIds, inc.zoneLabels);
  return buildPanelDamageSilhouetteSvg(marks, uid, { carHref: "/brand/damage-car-top.jpg" });
}

function incidentCard(inc: HubIncident, uid: string, showDate: boolean): string {
  const labels = [...inc.zoneLabels, ...inc.groupLabels];
  const chips = labels.length
    ? `<ul class="hh-chips">${labels.map((l) => `<li>${l}</li>`).join("")}</ul>`
    : "";
  const date = showDate
    ? `<p class="hh-inc-kicker">${inc.flag} ${inc.country} · ${inc.date}</p>`
    : `<p class="hh-inc-kicker">${inc.flag} ${inc.country}</p>`;
  return `<article class="hh-card hh-card--inc">
    <header class="hh-card__h">${WARN}<span>Negadījums</span></header>
    ${date}
    <div class="hh-inc-row">
      <div class="hh-car">${topCar(inc, uid)}</div>
      <div class="hh-inc-facts">
        <p class="hh-amt">${inc.amount}</p>
        ${chips}
      </div>
    </div>
    ${srcLine(inc.sources)}
  </article>`;
}

function simpleCard(e: HubEvent, opts: { showDate: boolean }): string {
  if (e.kind === "incident" && e.incident) {
    return incidentCard(e.incident, `hh-${e.id}`, opts.showDate);
  }
  if (e.kind === "import") {
    return `<article class="hh-card hh-card--imp">
      <p class="hh-imp">${e.fromFlag} ${e.fromCountry} <span>→</span> ${e.flag} ${e.country}</p>
    </article>`;
  }
  const title =
    e.kind === "first_reg"
      ? "Pirmā reģistrācija"
      : e.kind === "inspection"
        ? "Tehniskā apskate"
        : e.kind === "owner"
          ? "Īpašnieka maiņa"
          : e.kind === "service"
            ? "Apkope"
            : "Odometra ieraksts";
  const iconId: SectionIconId =
    e.kind === "inspection"
      ? "listChecks"
      : e.kind === "owner"
        ? "user"
        : e.kind === "service"
          ? "wrench"
          : e.kind === "odometer"
            ? "route"
            : "carFront";
  const km = e.km ? `<span class="hh-km">${e.km}</span>` : "";
  const factBits = [
    opts.showDate ? `<time class="hh-in-date">${e.date}</time>` : "",
    e.ownerN ? `<p class="hh-card__sub">${e.ownerN}</p>` : "",
    e.ta
      ? `<p class="hh-ta ${e.ta.ok ? "hh-ta--ok" : "hh-ta--warn"}">${e.ta.result}</p>${e.ta.next ? `<p class="hh-card__sub">Nākamā TA ${e.ta.next}</p>` : ""}`
      : "",
    e.works ? `<p class="hh-card__sub">${e.works}</p>` : "",
    `<p class="hh-meta">${e.flag} ${e.country} ${dots(e.sources)}</p>`,
  ]
    .filter(Boolean)
    .join("");
  return `<article class="hh-card hh-card--${e.kind}">
    <div class="hh-card__grid">
      <p class="hh-card__kind">${ico(iconId)}<span>${title}</span></p>
      <div class="hh-card__fact">${factBits}</div>
      ${km}
    </div>
  </article>`;
}

function yearBand(year: string): string {
  return `<div class="hh-year"><span>${year}</span></div>`;
}

function groupByYear(events: HubEvent[]): { year: string; events: HubEvent[] }[] {
  const out: { year: string; events: HubEvent[] }[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (!last || last.year !== e.year) out.push({ year: e.year, events: [e] });
    else last.events.push(e);
  }
  return out;
}

function sheetHead(title: string, count: string, icon: SectionIconId): string {
  return `<div class="hh-head">
    <span class="hh-head-ico">${sectionIconPdfHtml(icon)}</span>
    <h2>${title}</h2>
    <span class="hh-count">${count}</span>
  </div>`;
}

function railItem(e: HubEvent, showDateInCard: boolean): string {
  const alert = e.kind === "incident";
  return `<li class="hh-item${alert ? " hh-item--alert" : ""}">
    <time class="hh-date">${e.date}</time>
    <span class="hh-rail" aria-hidden="true"><span class="hh-pin"></span></span>
    ${simpleCard(e, { showDate: showDateInCard })}
  </li>`;
}

function variantA(): string {
  const groups = groupByYear(HUB_EVENTS);
  const body = groups
    .map((g) => {
      const items = g.events.map((e) => railItem(e, false)).join("");
      return `${yearBand(g.year)}<ol class="hh-list">${items}</ol>`;
    })
    .join("");
  return `<div class="hh-sheet hh hh--a">${sheetHead("VĒSTURES KOPSAVILKUMS", `${HUB_EVENTS.length} ieraksti`, "history")}${body}</div>`;
}

function variantB(): string {
  const events = HUB_EVENTS.filter((e) => e.kind !== "odometer");
  const groups = groupByYear(events);
  const body = groups
    .map((g) => {
      const items = g.events.map((e) => railItem(e, false)).join("");
      return `${yearBand(g.year)}<ol class="hh-list">${items}</ol>`;
    })
    .join("");
  const hub = `<div class="hh-sheet hh hh--b">${sheetHead("VĒSTURES KOPSAVILKUMS", `${events.length} ieraksti`, "history")}${body}</div>`;
  const zoomCards = [INC_2016, INC_2021].map((inc, i) => incidentCard(inc, `zoom${i}`, true)).join("");
  const zoom = `<div class="hh-sheet hh hh--zoom">${sheetHead("NEGADĪJUMU VĒSTURE", "2 negadījumi", "shield")}<div class="hh-zoom">${zoomCards}</div></div>`;
  return `<div class="hh-pair">${hub}<p class="hh-dup">Tās pašas negadījumu kartītes — palielinājumā.</p>${zoom}</div>`;
}

function variantC(): string {
  const events = HUB_EVENTS.filter((e) => e.kind !== "odometer");
  const groups = groupByYear(events);
  const body = groups
    .map((g) => {
      const cards = g.events.map((e) => simpleCard(e, { showDate: true })).join("");
      return `<section class="hh-ch"><h3 class="hh-ch__y">${g.year}</h3><div class="hh-ch__stack">${cards}</div></section>`;
    })
    .join("");
  return `<div class="hh-sheet hh hh--c">${sheetHead("VĒSTURES KOPSAVILKUMS", `${events.length} ieraksti`, "history")}${body}</div>`;
}

export const HISTORY_HUB_VARIANTS: { id: string; title: string; note: string; html: () => string }[] = [
  {
    id: "a",
    title: "A · Gada josla + kartītes",
    note: "Tuvāk AutoDNA: gads kā josla, datums pie ass, pa labi karājas kartītes. Odometrs ir atsevišķa kartīte — lente kļūst gara.",
    html: variantA,
  },
  {
    id: "b",
    title: "B · Divi mērogi + palielinājums",
    note: "Hubā tikai lielie notikumi. Odometrs paliek grafikā. Negadījuma kartīte šeit un zemāk «Negadījumu vēsturē» ir viena un tā pati.",
    html: variantB,
  },
  {
    id: "c",
    title: "C · Gads kā nodaļa",
    note: "Bez plānas ass. Gads ir nodaļas virsraksts, kartītes stekā. Datums ir kartītē. Vairāk atskaite, mazāk portāla timeline.",
    html: variantC,
  },
];

export function historyHubPreviewCss(): string {
  return `
    .hh-sheet{
      background:#fff;border:1px solid #E9EDF3;border-radius:12px;padding:18px 18px 16px;
      font-family:Inter,ui-sans-serif,system-ui,sans-serif;
    }
    .hh-head{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid #E9EDF3;}
    .hh-head h2{margin:0;flex:1;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#0f172a;}
    .hh-head-ico{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:rgba(0,97,210,0.1);color:#0061D2;}
    .hh-head-ico svg{width:16px;height:16px;display:block;}
    .hh-count{font-size:13px;font-weight:700;color:#0061D2;}
    .hh-year{
      margin:10px 0 8px;padding:7px 12px;border-radius:8px;background:#E8F1FC;color:#0061D2;
      font-size:13px;font-weight:750;letter-spacing:0.04em;
    }
    .hh-year span{display:block;}
    .hh-list{margin:0;padding:0;list-style:none;}
    .hh-item{
      display:grid;grid-template-columns:78px 18px minmax(0,1fr);gap:0 12px;align-items:stretch;
    }
    .hh-date{
      padding:14px 0;font-size:12px;font-weight:650;color:#0f172a;text-align:right;
      font-variant-numeric:tabular-nums;line-height:1.3;
    }
    .hh-rail{position:relative;display:block;justify-self:center;width:2px;background:#D7E4F5;}
    .hh-pin{
      position:absolute;left:50%;top:18px;width:9px;height:9px;margin-left:-4.5px;
      border-radius:999px;background:#fff;border:2px solid #93C5FD;
    }
    .hh-item--alert .hh-pin{background:#FF4D4D;border-color:#FF4D4D;}
    .hh-item--alert .hh-date{color:#B91C1C;}
    .hh-card{
      margin:8px 0;padding:12px 14px;border:1px solid #E9EDF3;border-radius:10px;background:#fff;
    }
    .hh-card__grid{
      display:grid;grid-template-columns:minmax(7.5rem,0.9fr) minmax(0,1.2fr) auto;
      gap:6px 16px;align-items:center;
    }
    .hh-card__kind{
      margin:0;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#0f172a;line-height:1.3;
    }
    .hh-card__fact{min-width:0;}
    .hh-card__h{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;font-weight:700;color:#0f172a;}
    .hh-card__h span{flex:1;}
    .hh-ico{display:inline-flex;color:#64748b;}
    .hh-ico svg{width:14px;height:14px;display:block;}
    .hh-km{
      flex:none;padding:3px 8px;border-radius:6px;background:#F1F5F9;font-size:11px;font-weight:750;
      font-variant-numeric:tabular-nums;color:#0f172a;
    }
    .hh-card__sub{margin:0;font-size:12px;color:#475569;line-height:1.4;}
    .hh-in-date{display:block;margin:0 0 2px;font-size:12px;font-weight:650;color:#64748b;font-variant-numeric:tabular-nums;}
    .hh-meta{margin:4px 0 0;display:flex;align-items:center;gap:8px;font-size:11px;color:#64748b;}
    .hh-ta{margin:0;font-size:12px;font-weight:650;}
    .hh-ta--ok{color:#047857;}
    .hh-ta--warn{color:#B45309;}
    .hh-imp{margin:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:650;color:#0f172a;}
    .hh-imp span{color:#94a3b8;padding:0 6px;}
    .hh-card--imp{text-align:center;}
    .hh-card--inc{border-color:#E9EDF3;background:#fff;}
    .hh-card--inc .hh-card__h{color:#B91C1C;}
    .hh-inc-kicker{margin:4px 0 8px;font-size:11px;font-weight:600;color:#64748b;}
    .hh-inc-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px 14px;align-items:center;}
    .hh-car .pdf-dmg-sil{display:block;width:72px;height:auto;background:transparent;}
    .hh-amt{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#B91C1C;line-height:1.1;}
    .hh-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;padding:0;list-style:none;}
    .hh-chips li{
      margin:0;padding:3px 8px;border-radius:999px;border:1px solid #E2E8F0;background:#fff;
      color:#475569;font-size:11px;font-weight:600;
    }
    .hh-src{display:flex;flex-wrap:wrap;gap:4px 14px;margin:10px 0 0;padding:0;list-style:none;font-size:11px;color:#64748b;}
    .hh-src li{display:inline-flex;align-items:center;gap:6px;}
    .hh-src-amt{font-variant-numeric:tabular-nums;}
    .hh-dot{display:inline-block;width:7px;height:7px;border-radius:999px;background:#94A3B8;}
    .hh-dot--csdd{background:#16A34A;}
    .hh-dot--autodna{background:#1E3A8A;}
    .hh-dot--carvertical{background:#EAB308;}
    .hh-dot--ltab{background:#DC2626;}
    .hh-dot--dealer{background:#EA580C;}
    .hh-warn{display:block;flex-shrink:0;}
    .hh-pair{display:flex;flex-direction:column;gap:0;}
    .hh-dup{
      margin:10px 4px 12px;font-size:12px;font-weight:650;letter-spacing:0.04em;
      text-transform:uppercase;color:#64748b;
    }
    .hh-zoom .hh-card{margin:10px 0 4px;}
    .hh-ch{margin-top:8px;}
    .hh-ch__y{margin:12px 0 8px;font-size:22px;font-weight:800;letter-spacing:-0.04em;color:#0f172a;}
    .hh-ch__stack .hh-card{margin:0 0 10px;}
    .hh--a .hh-list{margin-bottom:4px;}
  `;
}
