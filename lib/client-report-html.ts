/**
 * Klienta izvērtējuma atskaite (druka / PDF) — „Ultra” struktūra, brīdinājumu loģika, diagrammas.
 */

import { extractKmCandidates, workspaceBlockToHtml } from "@/lib/admin-workspace-preview-format";
import { mergeKmForChart, type PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import {
  CLIENT_REPORT_FOOTER_DISCLAIMER,
  CLIENT_REPORT_PDF_SECTIONS,
  CLIENT_REPORT_SECTION_LABELS,
  CLIENT_REPORT_SERVICE_NOTICE,
  REPORT_ODOMETER_SOURCE_LEGEND,
  REPORT_PDF_STANDARDS,
  sanitizeAttachmentFileNameForReport,
} from "@/lib/report-pdf-standards";

export type ClientReportPayload = {
  sessionId: string;
  isDemo: boolean;
  vin: string | null;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  listingUrl: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  notes: string | null;
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
  iriss: string;
};

export type ClientReportPortfolioRow = { name: string; size: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function flagEmoji(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + c.charCodeAt(0) - 65,
    A + c.charCodeAt(1) - 65,
  );
}

function parseLvDateFragment(s: string): Date | null {
  const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function findNextInspectionDate(csdd: string): Date | null {
  const patterns = [
    /nākam[āa]\s+(?:tehnisk[āa]?\s+)?apskate\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /nākam[āa]\s+TA\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /nākam[āa]\s+pārbaude\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
  ];
  for (const re of patterns) {
    const m = csdd.match(re);
    if (m?.[1]) {
      const d = parseLvDateFragment(m[1]);
      if (d) return d;
    }
  }
  return null;
}

function isNextInspectionDueWithinThreeMonths(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 90);
  return d.getTime() <= limit.getTime();
}

function collectTaSeverityWarnings(csdd: string): string[] {
  const t = csdd.toLowerCase();
  const out: string[] = [];
  if (/\b2\s*\/\s*5\b/.test(t) || /vērt[ēe]jums\s*:\s*2\b/.test(t) || /līmenis\s*:\s*2\b/.test(t)) {
    out.push("Konstatēts zemāks tehniskās apskates vērtējums (piem., „2”) — nepieciešama manuāla pārbaude piezīmēs.");
  }
  if (/konstat[ēe]tie\s+defekt|defekt[us]*\s*[:(]|boj[āa]jums\s*:\s*ir/i.test(csdd)) {
    out.push("Tekstā minēti konstatētie defekti / bojājumi — izcelti kā riska faktors.");
  }
  return out;
}

type KmTier = "lv" | "hist" | "hist2" | "dealer" | "other";

const TIER_EMOJI: Record<KmTier, string> = {
  lv: "🟢",
  hist: "🔵",
  hist2: "🟡",
  dealer: "🟠",
  other: "🔴",
};

const TIER_COLOR: Record<KmTier, string> = {
  lv: "#16a34a",
  hist: "#2563eb",
  hist2: "#ca8a04",
  dealer: "#ea580c",
  other: "#dc2626",
};

function tierFromMergedLabel(label: string, histAlt: { n: number }): KmTier {
  const L = label.toLowerCase();
  if (/reģistr|valsts|csdd|latvij|publisk|lod\b|lokr/i.test(L)) return "lv";
  if (/d[īi]ler|dealer|salon|ofici[āa]l/i.test(L)) return "dealer";
  if (/vēstures|atskait|history|report|carvertical|autodna|dna|vertical|boj[āa]j/i.test(L)) {
    return histAlt.n++ % 2 === 0 ? "hist" : "hist2";
  }
  return "other";
}

export type OdometerChartPoint = { km: number; label: string; tier: KmTier; emoji: string };

export function buildOdometerChartPoints(
  csdd: string,
  insights: PdfPortfolioFileInsight[],
): OdometerChartPoint[] {
  const histAlt = { n: 0 };
  const points: OdometerChartPoint[] = [];
  const seen = (km: number) => points.some((p) => Math.abs(p.km - km) < 120);

  for (const km of extractKmCandidates(csdd)) {
    if (km < 1_000 || km > 2_000_000) continue;
    if (seen(km)) continue;
    points.push({
      km,
      label: "Valsts / reģistra piezīmes",
      tier: "lv",
      emoji: TIER_EMOJI.lv,
    });
  }

  for (const p of mergeKmForChart(insights)) {
    const base = p.label.split(" · ")[0] ?? p.label;
    const shortLabel = sanitizeAttachmentFileNameForReport(base);
    const tier = tierFromMergedLabel(p.label + " " + shortLabel, histAlt);
    if (seen(p.km) && tier !== "lv") continue;
    if (!seen(p.km)) {
      points.push({
        km: p.km,
        label: sanitizeAttachmentFileNameForReport(p.label),
        tier,
        emoji: TIER_EMOJI[tier],
      });
    }
  }

  return points.sort((a, b) => a.km - b.km);
}

function splitPointDateAndContext(label: string): { date: string; context: string } {
  const dm = label.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);
  if (!dm) return { date: "—", context: label };
  const rest = label.replace(dm[0], "").replace(/^[\s·\-–—]+/, "").trim();
  return { date: dm[0], context: rest || label };
}

function buildOdometerSvg(points: OdometerChartPoint[]): string {
  if (points.length === 0) {
    return '<p class="na">Nav izdalītu nobraukuma punktu — aizpildi reģistra piezīmes un/vai pievieno vēstures PDF.</p>';
  }
  const w = 520;
  const h = 200;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const kms = points.map((p) => p.km);
  const minK = Math.min(...kms);
  const maxK = Math.max(...kms);
  const span = Math.max(maxK - minK, 1);

  const coords = points.map((p, i) => {
    const x = padL + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
    const y = padT + innerH - ((p.km - minK) / span) * innerH;
    return { x, y, ...p };
  });

  const segments: string[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const col = TIER_COLOR[b.tier];
    segments.push(
      `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  }

  const circles = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="6" fill="${TIER_COLOR[c.tier]}" stroke="#fff" stroke-width="2"/>`,
    )
    .join("");

  return `
    <div class="chart-wrap">
      <p class="chart-caption">Nobraukuma dinamikas grafiks (krāsas = datu avoti: 🟢 🔵 🟡 🟠 🔴)</p>
      <svg viewBox="0 0 ${w} ${h}" class="odo-chart" aria-hidden="true">
        <line x1="${padL}" y1="${padT + innerH}" x2="${padL + innerW}" y2="${padT + innerH}" stroke="#e5e7eb" stroke-width="1"/>
        ${segments.join("")}
        ${circles}
        <text x="${padL}" y="${h - 8}" font-size="10" fill="#71717a">min ${minK.toLocaleString("lv-LV")} km — max ${maxK.toLocaleString("lv-LV")} km</text>
      </svg>
    </div>`;
}

type InsRow = {
  date: string;
  desc: string;
  descShort: string;
  amount: string;
  iso: string;
  emphasize: boolean;
};

function parseInsuranceLikeRows(ltab: string): InsRow[] {
  const rows: InsRow[] = [];
  for (const raw of ltab.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 8) continue;
    const dm = line.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);
    const eurM = line.match(/([\d\s\u00A0]{1,14})\s*(EUR|€)/i);
    if (!dm || !eurM) continue;
    const amountNum = parseInt(eurM[1].replace(/\s/g, ""), 10);
    const emphasize =
      /piln[īi]g[aā]\s*boj[āa]j|total\s*loss|piln[īi]b[āa]\s*zud|smags\s+virsb[ūu]ves/i.test(line) ||
      (!Number.isNaN(amountNum) && amountNum >= 5000);
    const isoM = line.match(/\b([A-Z]{2})\b\s*$/);
    const iso = isoM?.[1] && isoM[1].length === 2 ? isoM[1] : "LV";
    let descShort = line
      .replace(dm[0], "")
      .replace(eurM[0], "")
      .replace(/\b[A-Z]{2}\b\s*$/, "")
      .replace(/^[\s,;·\-–—]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (descShort.length < 3) descShort = line;
    rows.push({
      date: dm[0],
      desc: line,
      descShort,
      amount: `${eurM[1].trim().replace(/\s+/g, " ")} EUR`,
      iso,
      emphasize,
    });
  }
  return rows;
}

/** Nobraukuma neatbilstība: sludinājums vs augstākais oficiālais. */
function listingKmDeltaInfo(
  csdd: string,
  tirgus: string,
): { listingKm: number; maxOfficial: number; deltaKm: number; deltaLabel: string } | null {
  const official = extractKmCandidates(csdd);
  const listing = extractKmCandidates(tirgus);
  if (official.length === 0 || listing.length === 0) return null;
  const maxOff = Math.max(...official);
  const minList = Math.min(...listing);
  const deltaKm = maxOff - minList;
  if (deltaKm < 500) return null;
  const k = Math.round(deltaKm / 1000);
  const deltaLabel = k >= 1 ? `~${k}k km` : `${deltaKm.toLocaleString("lv-LV")} km`;
  return { listingKm: minList, maxOfficial: maxOff, deltaKm, deltaLabel };
}

function listingVsOfficialKmWarning(csdd: string, tirgus: string): string | null {
  const info = listingKmDeltaInfo(csdd, tirgus);
  if (!info || info.deltaKm < 400) return null;
  if (info.listingKm < info.maxOfficial - 400) {
    return `Brīdinājums: sludinājumā norādītais nobraukums (${info.listingKm.toLocaleString("lv-LV")} km) ir zemāks par augstāko reģistra / oficiālajos avotos fiksēto (${info.maxOfficial.toLocaleString("lv-LV")} km) — iespējama odometra neatbilstība; nepieciešama manuāla pārbaude.`;
  }
  return null;
}

function extractFirstRegistration(csdd: string): string | null {
  const m = csdd.match(/pirm[āa]\s+reģistr[āa]cij[as]*\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i);
  return m?.[1] ?? null;
}

function extractVehicleMakeModel(csdd: string): string | null {
  const t = csdd.replace(/\r/g, "");
  let m = t.match(
    /(?:marka|modelis)\s*[,&]?\s*(?:modelis|marka)?\s*[:\-]\s*([^\n]{2,72})/i,
  );
  if (m) {
    const s = m[1].trim().split(/\n/)[0]?.trim() ?? "";
    if (s.length >= 2) return s.replace(/\s{2,}/g, " ");
  }
  m = t.match(
    /\b(BMW|Audi|Mercedes-Benz|Mercedes|VW|Volkswagen|Toyota|Volvo|Opel|Ford|Peugeot|Renault|Hyundai|Kia|Škoda|Skoda|Nissan|Mazda|Honda|Citro[ëe]n|Tesla)\s+[A-Za-z0-9][A-Za-z0-9\s\-]{1,32}/i,
  );
  return m ? m[0].trim().replace(/\s{2,}/g, " ") : null;
}

function extractTaHistoryBullets(csdd: string): string[] {
  return csdd
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 12 &&
        /(?:pamatpārbaude|atkārtot[āa]?|tehnisk[āa]\s+apskate|TA\b|vērtējums\s*[012]|defekt)/i.test(l),
    );
}

function estimateYearsFromFirstReg(csdd: string): number | null {
  const fr = extractFirstRegistration(csdd);
  if (!fr) return null;
  const d = parseLvDateFragment(fr);
  if (!d) return null;
  const now = new Date();
  const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0.5, years);
}

function buildMileageForecastBlock(points: OdometerChartPoint[], csdd: string, tirgus: string): string {
  if (points.length < 2) {
    return `<div class="forecast-box"><p class="forecast-icon">💡</p><div><strong>EKSPERTA PROGNOZE</strong><p class="forecast-body">Nepietiek punktu nobraukuma līknei — pievienojiet vēstures PDF un reģistra datus, lai sistēma varētu aprēķināt vidējo nobraukumu gadā.</p></div></div>`;
  }
  const kms = points.map((p) => p.km);
  const minK = Math.min(...kms);
  const maxK = Math.max(...kms);
  const spanKm = maxK - minK;
  let years = estimateYearsFromFirstReg(csdd);
  if (years == null) {
    years = Math.max(1, Math.round(spanKm / 18_000));
  }
  const perYear = Math.round(spanKm / years);
  const perYearK = Math.round(perYear / 1000);
  const rangeLow = maxK + Math.round(perYear * 0.15);
  const rangeHigh = maxK + Math.round(perYear * 0.45);
  const info = listingKmDeltaInfo(csdd, tirgus);
  let warn = "";
  if (info && info.listingKm < info.maxOfficial - 400) {
    warn = `<p class="forecast-warn">Sludinājumā norādītie <strong>${info.listingKm.toLocaleString("lv-LV")} km</strong> uzskatāmi par <strong>apzināti maldinošiem</strong> salīdzinājumā ar oficiāli fiksēto augstāko vērtību (${info.maxOfficial.toLocaleString("lv-LV")} km; starpība ≈ ${info.deltaLabel} pret pēdējo CSDD / reģistra fiksāciju).</p>`;
  }
  return `<div class="forecast-box"><p class="forecast-icon">💡</p><div><strong>EKSPERTA PROGNOZE</strong>
    <p class="forecast-body">Pēc pieejamajiem punktiem: nobraukuma starpība <strong>${minK.toLocaleString("lv-LV")} – ${maxK.toLocaleString("lv-LV")} km</strong> aptuveni <strong>${years.toFixed(1)}</strong> gadu posmā → vidēji <strong>~${perYearK}k km gadā</strong> (formula: (pēdējais − pirmais) / gadu skaits).</p>
    <p class="forecast-body">Statistiski sagaidāms diapazons šodien (orientējoši): <strong>${rangeLow.toLocaleString("lv-LV")} – ${rangeHigh.toLocaleString("lv-LV")} km</strong> — salīdziniet ar sludinājumu un vēstures atskaitēm.</p>
    ${warn}
  </div></div>`;
}

function extractListingPriceEur(tirgus: string): string | null {
  const t = tirgus.replace(/\u00a0/g, " ");
  const m = t.match(/([\d\s]{3,12})\s*(?:EUR|€)/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ""), 10);
  if (Number.isNaN(n) || n < 100) return null;
  return `${n.toLocaleString("lv-LV")} EUR`;
}

type RiskRow = { kind: string; statusHtml: string; note: string };

function buildRiskRows(
  csdd: string,
  tirgus: string,
  ltab: string,
  citi: string,
  insRows: InsRow[],
): RiskRow[] {
  const corpus = `${csdd}\n${ltab}\n${citi}`.toLowerCase();
  const stolen = /zagts|mekl[ēe]šan[āa]|nozagt|asl[īi]\s*zag|wanted|stolen|theft|noziedz/i.test(corpus);
  const legal: RiskRow = stolen
    ? {
        kind: "Juridiskais statuss",
        statusHtml: '<span class="st-crit">🚩 Kritiski</span>',
        note: "Tekstā minēti riska signāli attiecībā uz nozagtu transportlīdzekli vai meklēšanu — pārbaudiet oficiālos avotus.",
      }
    : {
        kind: "Juridiskais statuss",
        statusHtml: '<span class="st-ok">✅ Tīrs</span>',
        note: "Nav reģistrēts kā zagts vai meklēšanā (pēc pieejamā teksta heuristikas).",
      };

  const kmInfo = listingKmDeltaInfo(csdd, tirgus);
  const kmWarn = listingVsOfficialKmWarning(csdd, tirgus);
  let mileage: RiskRow;
  if (kmWarn && kmInfo) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-crit">🚩 Kritiski</span>',
      note: `Sludinājuma dati nesakrīt ar reģistra vēsturi (≈ ${kmInfo.deltaLabel} pret augstāko oficiālo fiksāciju).`,
    };
  } else if (extractKmCandidates(csdd).length === 0 && extractKmCandidates(tirgus).length === 0) {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-warn">⚠️ Nav datu</span>',
      note: "Nav pietiekami nobraukuma atsauču salīdzināšanai — aizpildiet reģistra un sludinājuma laukus.",
    };
  } else {
    mileage = {
      kind: "Nobraukuma ticamība",
      statusHtml: '<span class="st-ok">✅ Salīdzināms</span>',
      note: "Nobraukums nav automātiski atzīmēts kā kritiski pretrunīgs ar reģistra rindām.",
    };
  }

  const nIns = insRows.length;
  const heavy = insRows.some((r) => r.emphasize) || /total\s*loss|piln[īi]g[aā]\s*boj|7\s+fiks/i.test(ltab);
  const accCount =
    nIns ||
    (() => {
      const m = ltab.match(/(\d+)\s*(?:fiks[ēe]ti\s*)?(?:gad[īi]jum|negad[īi]jum)/i);
      return m ? parseInt(m[1], 10) : 0;
    })();
  let damage: RiskRow;
  if (accCount >= 3 || heavy) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-warn">⚠️ Uzmanību</span>',
      note: `Fiksēti ${Math.max(accCount, nIns || 1)} negadījumi (pēc tabulas / teksta), t.sk. iespējams smags / pilnīgs bojājums — pārbaudiet detaļas sadaļā „Apdrošināšanas konteksts”.`,
    };
  } else if (nIns === 0 && !/negad[īi]jum|av[āa]rija|boj[āa]j/i.test(ltab)) {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-ok">✅ Nav izcelts</span>',
      note: "Strukturētā tabulā nav atlīdzību rindu; tekstā nav spēcīgu negadījumu atslēgvārdu.",
    };
  } else {
    damage = {
      kind: "Bojājumu vēsture",
      statusHtml: '<span class="st-warn">⚠️ Uzmanību</span>',
      note: "Ir vismaz daži bojājumu / atlīdzību ieraksti — skatīt apdrošināšanas tabulu.",
    };
  }

  const taSev = collectTaSeverityWarnings(csdd);
  const fixed =
    /atk[āa]rtot[āa].{0,80}?vērt[ēe]jums\s*0|visi\s+defekti\s+novērst|vērt[ēe]jums\s*:\s*0\b/i.test(csdd);
  let technical: RiskRow;
  if (fixed && taSev.length === 0) {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-ok">✅ Labots</span>',
      note: "Pēdējie CSDD fiksētie defekti, šķiet, novērsti (tekstā minēta atkārtotā pārbaude ar labu vērtējumu).",
    };
  } else if (taSev.length > 0) {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-warn">⚠️ Uzmanību</span>',
      note: taSev.join(" "),
    };
  } else {
    technical = {
      kind: "Tehniskais stāvoklis",
      statusHtml: '<span class="st-ok">✅ Nav signālu</span>',
      note: "TA piezīmēs nav automātiski atrasts vērtējums „2” vai neatrisinātu defektu apraksts.",
    };
  }

  return [legal, mileage, damage, technical];
}

function buildInspectionChecklist(csdd: string, ltab: string, tirgus: string): string[] {
  const t = `${csdd}\n${ltab}\n${tirgus}`.toLowerCase();
  const items: string[] = [];
  if (/aizmugur|rear|aizmugures|\baizm\./i.test(t)) {
    items.push(
      "<strong>Aizmugurējā daļa:</strong> pārbaudiet krāsas biezumu uz bagāžnieka vāka un aizmugures spārniem — vēsturē minēti aizmugures triecieni.",
    );
  }
  if (/total\s*loss|piln[īi]g[aā]\s*boj|šasij|virsb[ūu]ve|balstiek[āa]rt|chassis/i.test(t)) {
    items.push(
      "<strong>Stūres iekārta:</strong> braukšanas tests (piem., vibrācijas ~90 km/h), ja vēsturē smags virsbūves / šasijas bojājums vai pilnīga bojāeja.",
    );
  }
  if (/aizmugur|park|sensor|elektron|kamera|rear\s*camera/i.test(t)) {
    items.push(
      "<strong>Elektronika:</strong> aizmugures parkošanās sensori / kameras — pēc lieliem remontdarbiem bieži neatjaunoti korekti.",
    );
  }
  if (items.length === 0) {
    items.push(
      "<strong>Vispārējs apgājiens:</strong> krāsas vienotība, šuvju simetrija, korozijas pazīmes, riepu nolietojums.",
    );
    items.push("<strong>Dzinējs / tehnika:</strong> aukstā starta skaņa, dzesēšana, diagnostika, AC darbība.");
  }
  return items;
}

function splitExpertConclusion(iriss: string): { rating: string | null; summary: string } {
  const t = iriss.trim();
  if (!t) return { rating: null, summary: "" };
  const lines = t.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  const looksLikeHeadline =
    first.length <= 88 &&
    (/^(IZSKATĀS|UZMANĪBU|ĻOTI|BR[ĪI]DIN|OK|LABI|SLIKTI|NAV\s+IETEIC|IETEIC|NEIESAK)/i.test(first) ||
      /[!?⚠️✅🚩]/.test(first) ||
      /^.{1,55}!$/.test(first));
  if (looksLikeHeadline && lines.length > 1) {
    return { rating: first, summary: lines.slice(1).join("\n").trim() };
  }
  if (looksLikeHeadline && lines.length === 1) {
    return { rating: first, summary: "" };
  }
  return { rating: null, summary: t };
}

function exportRowHtml(): string {
  return `<p class="export-hint"><span class="export-ico" aria-hidden="true">📋</span> Eksportēt uz pakalpojumu izklājlapas — izmantojiet pogu lapas apakšā vai kopējiet tabulas.</p>`;
}

function reportFooterScript(): string {
  return `<script>
function provinReportExport(){
  try{
    var blocks=[];
    document.querySelectorAll("table.report-export").forEach(function(tb){
      var rows=tb.querySelectorAll("tr");
      for(var i=0;i<rows.length;i++){
        var cells=rows[i].querySelectorAll("th,td");
        var line=[];
        for(var j=0;j<cells.length;j++) line.push('"'+cells[j].innerText.replace(/"/g,'""')+'"');
        blocks.push(line.join("\\t"));
      }
      blocks.push("");
    });
    var blob=new Blob([blocks.join("\\n")],{type:"text/csv;charset=utf-8;"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="provin-atskaite.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){ alert("Eksports neizdevās."); }
}
</script>`;
}

function clientReportPrintCss(): string {
  return `
      *{box-sizing:border-box;}
      body{
        font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        line-height:1.55;max-width:190mm;margin:0 auto;padding:12mm 14mm;color:#1d1d1f;
        background:#fafbfc;
      }
      .sheet{background:#fff;border-radius:12px;box-shadow:0 1px 0 rgba(0,0,0,.06);padding:16mm 14mm;}
      @media print{.sheet{box-shadow:none;border-radius:0;padding:0}}
      .report-head{
        border-bottom:3px solid #0066d6;padding-bottom:14px;margin-bottom:20px;
        background:linear-gradient(180deg,#fafdff 0%,#fff 100%);
        border-radius:8px 8px 0 0;padding:8px 4px 12px;
      }
      .report-head h1{
        display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;margin:8px 0 6px;
        font-size:1.28rem;font-weight:650;color:#1d1d1f;letter-spacing:-0.02em;line-height:1.25;
      }
      .report-head h1 .brand{font-size:0.58em;letter-spacing:0.14em;text-transform:uppercase;color:#0066d6;font-weight:700;}
      .report-head .brand-sep{color:#94a3b8;font-weight:500;font-size:0.55em;}
      .report-head h1 .title-main{font-weight:650;}
      .report-head .sub{font-size:0.84rem;color:#6e6e73;}
      .vin-inline{display:inline-block;margin-left:6px;padding:2px 10px;background:#f1f5f9;border-radius:6px;font-size:0.82rem;}
      h2.pdf-sec{
        font-size:0.95rem;font-weight:700;margin:1.45rem 0 0.5rem;color:#1d1d1f;padding-bottom:8px;border-bottom:1px solid #d4d4d8;
        text-transform:uppercase;letter-spacing:0.02em;
      }
      h3.pdf-sub{font-size:0.9rem;font-weight:600;margin:1rem 0 0.4rem;color:#334155;}
      h4.pdf-sub2{font-size:0.84rem;font-weight:600;margin:0.65rem 0 0.25rem;color:#1d1d1f;}
      .client-msg{font-style:italic;color:#475569;margin:0.35rem 0 0.75rem;line-height:1.5;}
      .client-klients{margin:0 0 0.5rem;font-size:0.9rem;}
      .callout-warn{
        margin:10px 0;padding:10px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:0.86rem;
      }
      .listing-warn-amber{
        margin:8px 0;padding:8px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:0.86rem;color:#92400e;
      }
      .listing-delta{color:#b91c1c;font-weight:600;margin-left:6px;}
      table{width:100%;border-collapse:collapse;font-size:0.82rem;}
      table.fmt{margin:0.5rem 0;}
      table.fmt td,table.fmt th{padding:9px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;}
      table.fmt thead th{font-weight:700;font-size:0.78rem;color:#1d1d1f;border-bottom:2px solid #cbd5e1;padding-top:4px;}
      table.fmt.bordered td,table.fmt.bordered th{padding:8px 10px;border:1px solid #e5e7eb;}
      table.fmt.bordered thead th{background:#eef2f7;}
      table.fmt.risk td,table.fmt.risk th{padding:10px 8px;border-bottom:1px solid #e5e7eb;}
      table.fmt.risk th{background:transparent;font-weight:700;text-align:left;color:#1d1d1f;}
      table.fmt.risk td:nth-child(2){white-space:nowrap;}
      .st-ok{color:#15803d;font-weight:600;}
      .st-warn{color:#b45309;font-weight:600;}
      .st-crit{color:#b91c1c;font-weight:600;}
      .tabular{font-variant-numeric:tabular-nums;}
      table.fmt.odo td:nth-child(1){width:40px;text-align:center;font-size:1.05rem;}
      table.fmt.ins td.flag-cell{width:48px;text-align:right;font-size:1.2rem;}
      table.fmt.ins tr.em td{font-weight:700;}
      .td-warn{color:#b91c1c;font-weight:600;}
      pre.block{white-space:pre-wrap;font-size:0.82rem;background:#f8fafc;border:1px solid #e2e8f0;padding:11px 14px;border-radius:9px;margin:0.5rem 0;}
      .na{color:#86868b;font-style:italic;}
      .hint{font-size:0.76rem;color:#6e6e73;margin-top:0.45rem;line-height:1.45;}
      .ta-list{margin:0.4rem 0;padding-left:1.2rem;}
      .ta-list li{margin:0.35rem 0;}
      .chart-wrap{margin:12px 0;}
      .chart-caption{font-size:0.78rem;color:#64748b;margin:0 0 6px;}
      .odo-chart{width:100%;max-width:540px;height:auto;display:block;}
      .forecast-box{
        display:flex;gap:12px;align-items:flex-start;margin:14px 0;padding:14px 16px;border-radius:10px;
        background:linear-gradient(135deg,#fffbeb 0%,#fff 55%);border:1px solid #fde68a;
      }
      .forecast-icon{font-size:1.35rem;margin:0;line-height:1;}
      .forecast-body{margin:0.4rem 0 0;font-size:0.86rem;color:#1d1d1f;}
      .forecast-warn{margin:0.65rem 0 0;font-size:0.84rem;color:#991b1b;}
      .export-hint{font-size:0.74rem;color:#64748b;margin:10px 0 4px;display:flex;align-items:center;gap:6px;}
      .export-ico{opacity:0.85;}
      .checklist{margin:0.5rem 0;padding-left:0;list-style:none;counter-reset:plan;}
      .checklist li{
        counter-increment:plan;margin:10px 0;font-size:0.86rem;line-height:1.45;
        position:relative;padding-left:2.6rem;
      }
      .checklist li::before{
        content:counter(plan) ". [ ] ";position:absolute;left:0;color:#64748b;font-weight:600;
      }
      .expert-verdict{margin:12px 0 8px;}
      .expert-rating{font-size:0.95rem;margin:0 0 10px;}
      .expert-summary-label{font-size:0.82rem;margin:0 0 4px;color:#475569;}
      .expert-panel-bottom{
        margin:8px 0 18px;padding:16px 18px;border-radius:10px;
        background:linear-gradient(135deg,#e8f2fc 0%,#f5f9ff 50%,#fff 100%);
        border:1px solid rgba(0,102,214,.22);border-left:4px solid #0066d6;
      }
      .expert-panel-bottom .expert-title{
        font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0066d6;font-weight:700;margin:0 0 10px;
      }
      .expert-panel-bottom .expert-body{font-size:0.92rem;color:#1d1d1f;white-space:pre-wrap;line-height:1.6;}
      .visual-archive{
        margin:14px 0;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;
      }
      .visual-archive .va-title{font-size:0.82rem;font-weight:700;margin:0 0 8px;}
      .legend-box{margin-top:16px;padding:12px 0 8px;border-top:1px solid #e5e7eb;}
      .legend-box h3{margin:0 0 10px;font-size:0.82rem;font-weight:700;color:#1d1d1f;text-transform:uppercase;letter-spacing:0.06em;}
      .legend-inline{display:flex;flex-wrap:wrap;gap:10px 18px;font-size:0.78rem;color:#334155;}
      .legend-inline span{white-space:nowrap;}
      .legal-block{
        margin-top:18px;padding:14px 16px;border-radius:10px;background:#f5f5f7;border:1px solid #e8e8ed;
        font-size:0.74rem;color:#6e6e73;line-height:1.55;
      }
      .legal-block strong{color:#424245;font-weight:600;}
      .report-foot{margin-top:16px;padding-top:12px;border-top:1px solid #e5e5ea;font-size:0.7rem;color:#aeaeb2;line-height:1.45;}
      code{font-size:0.78rem;background:#f1f5f9;padding:2px 8px;border-radius:6px;}
      @media print{
        body{padding:10mm 12mm;background:#fff;}
        .sheet{background:#fff}
        .no-print{display:none!important;}
      }
    `;
}

export function buildClientReportDocumentHtml(args: {
  payload: ClientReportPayload;
  portfolio: ClientReportPortfolioRow[];
  pdfInsights: PdfPortfolioFileInsight[];
  dateFmt: Intl.DateTimeFormat;
  formatBytes: (n: number) => string;
}): string {
  const { payload, portfolio, pdfInsights, dateFmt, formatBytes } = args;
  const p = payload;

  const money =
    p.amountTotal == null
      ? "—"
      : new Intl.NumberFormat("lv-LV", { style: "currency", currency: p.currency ?? "EUR" }).format(
          p.amountTotal / 100,
        );

  const insRows = parseInsuranceLikeRows(p.ltab);
  const odoPts = buildOdometerChartPoints(p.csdd, pdfInsights);
  const riskRows = buildRiskRows(p.csdd, p.tirgus, p.ltab, p.citi, insRows);
  const nextTa = findNextInspectionDate(p.csdd);
  const nextTaSoon = nextTa ? isNextInspectionDueWithinThreeMonths(nextTa) : false;
  const makeModel = extractVehicleMakeModel(p.csdd);
  const firstReg = extractFirstRegistration(p.csdd);
  const taBullets = extractTaHistoryBullets(p.csdd);
  const checklist = buildInspectionChecklist(p.csdd, p.ltab, p.tirgus);
  const expertParts = splitExpertConclusion(p.iriss);
  const listDelta = listingKmDeltaInfo(p.csdd, p.tirgus);
  const listWarnLong = listingVsOfficialKmWarning(p.csdd, p.tirgus);
  const priceAd = extractListingPriceEur(p.tirgus);
  const listingKms = extractKmCandidates(p.tirgus);
  const minListingKm = listingKms.length ? Math.min(...listingKms) : null;

  const lines: string[] = [];
  lines.push('<div class="sheet">');
  lines.push('<div class="report-head">');
  lines.push(
    `<h1><span class="brand">PROVIN<span style="color:#0066d6">.LV</span></span><span class="brand-sep">|</span><span class="title-main">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.mainTitle)}</span></h1>`,
  );
  lines.push(
    `<p class="sub">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))}<span class="vin-inline">VIN <code>${escapeHtml(p.vin ?? "—")}</code></span></p>`,
  );
  lines.push("</div>");

  /* 1. Klients */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.client)}</h2>`);
  lines.push(`<h3 class="pdf-sub">Ziņojums</h3>`);
  lines.push(
    `<p class="client-msg">${escapeHtml(p.notes?.trim() ? p.notes : "—")}</p>`,
  );
  const klientsBits = [p.customerName?.trim(), p.customerPhone?.trim()].filter(Boolean);
  lines.push(
    `<p class="client-klients"><strong>Klients:</strong> ${escapeHtml(klientsBits.join(" · ") || "—")}</p>`,
  );
  if (p.customerEmail?.trim()) {
    lines.push(`<p class="hint" style="margin-top:0">E-pasts: ${escapeHtml(p.customerEmail)}</p>`);
  }

  /* 2. Riski */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.risk)}</h2>`);
  lines.push(
    `<table class="fmt risk report-export" data-export="risk"><thead><tr><th>Pārbaudes veids</th><th>Statuss</th><th>Eksperta piezīme</th></tr></thead><tbody>`,
  );
  for (const r of riskRows) {
    lines.push(
      `<tr><td>${escapeHtml(r.kind)}</td><td>${r.statusHtml}</td><td>${escapeHtml(r.note)}</td></tr>`,
    );
  }
  lines.push(`</tbody></table>`);
  lines.push(exportRowHtml());

  /* 3. Auto */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.vehicle)}</h2>`);
  lines.push(`<table class="fmt"><tbody>`);
  lines.push(
    `<tr><td>Marka, modelis</td><td><strong>${escapeHtml(makeModel ?? "— (ierakstiet reģistra piezīmēs)")}</strong></td></tr>`,
  );
  lines.push(
    `<tr><td>Pirmā reģistrācija</td><td>${escapeHtml(firstReg ?? "—")}</td></tr>`,
  );
  const nextTaCell = nextTa
    ? nextTaSoon
      ? `<span class="td-warn">${escapeHtml(nextTa.toLocaleDateString("lv-LV"))} (≤ 90 dienas — uzmanību!)</span>`
      : escapeHtml(nextTa.toLocaleDateString("lv-LV"))
    : "—";
  lines.push(`<tr><td>Nākamā apskate</td><td>${nextTaCell}</td></tr>`);
  lines.push(`<tr><td>VIN</td><td><code>${escapeHtml(p.vin ?? "—")}</code></td></tr>`);
  lines.push(
    `<tr><td>Sludinājuma saite</td><td>${p.listingUrl ? escapeHtml(p.listingUrl) : '<span class="na">—</span>'}</td></tr>`,
  );
  lines.push(`<tr><td>Pasūtījums</td><td><code>${escapeHtml(p.sessionId)}</code> · ${escapeHtml(p.paymentStatus)} · ${escapeHtml(money)}</td></tr>`);
  lines.push(`</tbody></table>`);

  const taSev = collectTaSeverityWarnings(p.csdd);
  if (taSev.length > 0) {
    lines.push(
      `<div class="callout-warn"><strong>TA / defekti:</strong> ${escapeHtml(taSev.join(" "))}</div>`,
    );
  }

  lines.push(`<h3 class="pdf-sub">Tehniskās apskates vēsture</h3>`);
  if (taBullets.length > 0) {
    lines.push("<ul class=\"ta-list\">");
    for (const b of taBullets) lines.push(`<li>${escapeHtml(b)}</li>`);
    lines.push("</ul>");
    lines.push(`<p class="hint">Iekļautas rindas no reģistra piezīmēm, kas satur TA / vērtējumu / defektu kontekstu.</p>`);
  } else {
    lines.push(workspaceBlockToHtml(p.csdd, "default"));
  }

  lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.attachments)}</h3>`);
  if (portfolio.length === 0) {
    lines.push('<p class="na">Nav pievienotu dokumentu.</p>');
  } else {
    lines.push("<ul>");
    for (const row of portfolio) {
      lines.push(
        `<li>${escapeHtml(sanitizeAttachmentFileNameForReport(row.name))} (${escapeHtml(formatBytes(row.size))})</li>`,
      );
    }
    lines.push("</ul>");
  }
  lines.push(exportRowHtml());

  /* 4. Odometrs */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.odometer)}</h2>`);
  lines.push(buildOdometerSvg(odoPts));
  lines.push(buildMileageForecastBlock(odoPts, p.csdd, p.tirgus));
  lines.push(`<h3 class="pdf-sub">Apvienotie punkti (hronoloģiski pēc nobraukuma)</h3>`);
  lines.push(
    `<table class="fmt odo bordered report-export"><thead><tr><th>Avots</th><th class="tabular">km</th><th>Datums / konteksts</th></tr></thead><tbody>`,
  );
  for (const pt of odoPts) {
    const { date, context } = splitPointDateAndContext(pt.label);
    lines.push(
      `<tr><td>${pt.emoji}</td><td class="tabular">${pt.km.toLocaleString("lv-LV")}</td><td>${escapeHtml(date)} · ${escapeHtml(context)}</td></tr>`,
    );
  }
  lines.push(`</tbody></table>`);
  lines.push(exportRowHtml());

  if (pdfInsights.length > 0) {
    lines.push(`<h3 class="pdf-sub">Īss izvilkums no portfeļa PDF</h3>`);
    for (const ins of pdfInsights) {
      const fn = sanitizeAttachmentFileNameForReport(ins.fileName);
      lines.push(`<h4 class="pdf-sub2">${escapeHtml(fn)}</h4>`);
      if (ins.highlights.length) {
        lines.push("<ul>");
        for (const h of ins.highlights) lines.push(`<li>${escapeHtml(h)}</li>`);
        lines.push("</ul>");
      }
    }
  }

  /* 5. Apdrošināšana */
  const insTitle =
    insRows.length > 0
      ? `${CLIENT_REPORT_PDF_SECTIONS.insurance} (${insRows.length} fiksēti gadījumi)`
      : CLIENT_REPORT_PDF_SECTIONS.insurance;
  lines.push(`<h2 class="pdf-sec">${escapeHtml(insTitle)}</h2>`);
  if (insRows.length > 0) {
    lines.push(
      `<table class="fmt ins bordered report-export"><thead><tr><th>Datums</th><th>Bojājuma vieta / piezīmes</th><th>Summa (tāme)</th><th class="flag-cell">Valsts</th></tr></thead><tbody>`,
    );
    for (const r of insRows) {
      const rowClass = r.emphasize ? " class=\"em\"" : "";
      const descCell = r.emphasize ? `<strong>${escapeHtml(r.descShort)}</strong>` : escapeHtml(r.descShort);
      lines.push(
        `<tr${rowClass}><td>${escapeHtml(r.date)}</td><td>${descCell}</td><td class="tabular">${escapeHtml(r.amount)}</td><td class="flag-cell">${flagEmoji(r.iso)}</td></tr>`,
      );
    }
    lines.push(`</tbody></table>`);
    lines.push(
      `<p class="hint">Treknraksts: „pilnīga bojāeja” / total loss / smags virsbūves bojājums vai summa ≥ 5000 €. Karogs pēc ISO koda rindas beigās.</p>`,
    );
  } else {
    lines.push(
      `<p class="hint">Nav automātiski strukturētu rindu — zemāk pilnais OCTA / apdrošināšanas teksts.</p>`,
    );
  }
  if (p.ltab.trim()) {
    lines.push(`<h3 class="pdf-sub">Pilns teksts</h3>`);
    lines.push(workspaceBlockToHtml(p.ltab, "default"));
  } else if (insRows.length === 0) {
    lines.push('<p class="na">Sadaļa nav aizpildīta.</p>');
  }

  if (p.citi.trim()) {
    lines.push(`<div class="visual-archive">`);
    lines.push(`<p class="va-title">📷 VIZUĀLAIS ARHĪVS UN PAPILDU KONTEKSTS</p>`);
    lines.push(workspaceBlockToHtml(p.citi, "default"));
    lines.push(`</div>`);
  }
  lines.push(exportRowHtml());

  /* 6. Sludinājums */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.listing)}</h2>`);
  lines.push("<ul class=\"ta-list\">");
  if (priceAd) {
    lines.push(`<li><strong>Cena sludinājumā:</strong> ${escapeHtml(priceAd)}</li>`);
  }
  if (minListingKm != null) {
    let mileLine = `<strong>Sludinājuma nobraukums:</strong> ${minListingKm.toLocaleString("lv-LV")} km`;
    if (listDelta && listDelta.deltaKm >= 400) {
      mileLine += ` <span class="listing-warn-amber" style="display:inline;padding:2px 6px;border-radius:4px">⚠️ <span class="listing-delta">−${escapeHtml(listDelta.deltaLabel)} pret pēdējo CSDD / reģistra fiksāciju</span></span>`;
    }
    lines.push(`<li>${mileLine}</li>`);
  }
  if (!priceAd && minListingKm == null) {
    lines.push("<li><span class=\"na\">Cenu un nobraukumu neizdevās automātiski izdalīt — skatīt piezīmes zemāk.</span></li>");
  }
  lines.push("</ul>");
  lines.push(`<h3 class="pdf-sub">Tirgus piezīmes un analīze</h3>`);
  if (listWarnLong) {
    lines.push(`<div class="callout-warn">${escapeHtml(listWarnLong)}</div>`);
  }
  lines.push(workspaceBlockToHtml(p.tirgus, "tirgus"));

  /* 7. Apskates plāns */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.inspectionPlan)}</h2>`);
  lines.push(`<p class="hint" style="margin-bottom:10px">Dodoties apskatīt auto klātienē, pievērsiet uzmanību šiem punktiem (ģenerēts pēc piezīmju atslēgvārdiem):</p>`);
  lines.push(`<ol class="checklist">`);
  for (const item of checklist) {
    lines.push(`<li>${item}</li>`);
  }
  lines.push(`</ol>`);

  /* 8. Eksperts */
  lines.push(`<h2 class="pdf-sec">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.expert)}</h2>`);
  lines.push(`<div class="expert-panel-bottom">`);
  if (expertParts.rating) {
    lines.push(`<div class="expert-verdict"><p class="expert-rating"><strong>Vērtējums:</strong> ${escapeHtml(expertParts.rating)}</p>`);
    if (expertParts.summary) {
      lines.push(`<p class="expert-summary-label"><strong>Kopsavilkums</strong></p>`);
      lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary)}</div>`);
    }
    lines.push(`</div>`);
  } else {
    lines.push(`<p class="expert-title">${escapeHtml(REPORT_PDF_STANDARDS.firstPageExpertBlockTitle)}</p>`);
    lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary || p.iriss.trim())}</div>`);
  }
  lines.push(`</div>`);

  /* Legenda */
  lines.push(`<div class="legend-box">`);
  lines.push(`<h3>${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.sourcesLegend)}</h3>`);
  lines.push(`<div class="legend-inline">`);
  for (const L of REPORT_ODOMETER_SOURCE_LEGEND) {
    lines.push(`<span>${L.emoji} <strong>${escapeHtml(L.label)}</strong></span>`);
  }
  lines.push(`</div>`);
  lines.push(
    `<p class="hint" style="margin-top:10px">Datu prioritāte: pārklājoties, priekšroka oficiālajiem reģistra datiem (${TIER_EMOJI.lv}).</p>`,
  );
  lines.push(`</div>`);

  if (p.isDemo) {
    lines.push('<p class="hint"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
  }

  lines.push('<div class="legal-block">');
  lines.push(`<p><strong>Juridisks pārskats.</strong> ${escapeHtml(CLIENT_REPORT_SERVICE_NOTICE)}</p>`);
  lines.push(`<p style="margin-top:8px">${escapeHtml(CLIENT_REPORT_FOOTER_DISCLAIMER)}</p>`);
  lines.push("</div>");

  lines.push(
    '<p class="no-print" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:10px;align-items:center">',
  );
  lines.push(
    '<button type="button" style="padding:10px 20px;font-size:13px;border-radius:999px;border:0;background:#0066d6;color:#fff;cursor:pointer;font-weight:600" onclick="window.print()">Drukāt / PDF</button>',
  );
  lines.push(
    '<button type="button" style="padding:10px 20px;font-size:13px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;cursor:pointer;font-weight:600" onclick="provinReportExport()">Eksportēt tabulas (CSV)</button>',
  );
  lines.push("</p>");

  lines.push(
    `<div class="report-foot">© PROVIN.LV · konsultatīva atskaite · ${escapeHtml(dateFmt.format(new Date()))}</div>`,
  );
  lines.push("</div>");

  const title = `PROVIN ${p.vin ?? p.sessionId}`;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>${escapeHtml(
    title,
  )}</title><style>${clientReportPrintCss()}</style></head><body>${lines.join("\n")}${reportFooterScript()}</body></html>`;
  return html;
}
