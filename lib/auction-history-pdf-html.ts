/**
 * Izsoļu vēsture klienta PDF - Nila «jā» 27.11.2026 maketam, variants A.
 *
 * Augšā 4 faktu kartītes (Nobraukums / Izsoles / Solījumi / Bojājumi). Atkārtotas izsoles vienā platformā ar vienādiem
 * datiem (tas pats nobraukums un tie paši bojājumi) - viena grupas kartīte: datu josla, kompakta solījumu tabula,
 * kopīgie dati vienreiz un bojājumi vienreiz. Atšķirīgi dati - atsevišķa kartīte (vai atšķirība tabulas kolonnā).
 * Citas platformas - sava kartīte. Foto - visas, pa 2 rindā; viena un tā pati foto vairākās izsolēs - vienreiz.
 *
 * Grupēšana ir vispārīga (Openlane, Autorola, BCA, Autobid, cc_vin / izsoļu arhīvs) - nav piesaistīta konkrētam auto.
 * Klientam NErāda: atslēgas, piegādes laiku, arhīva tehniskos laukus (pirmoreiz fiksēts, pēdējoreiz redzēts, skatījumi).
 * Krāsas - tikai PROVIN PDF; sarkans tikai brīdinājumiem un datu trūkumam.
 * Tīrs modulis (neimportē client-report-html).
 */
import { buildAuctionArchiveSummary, formatIsoDayLv, formatKm } from "@/lib/auction-archive-offer";
import { auctionArchiveLotFacts, type ArchiveKv, type ArchiveLotFacts } from "@/lib/auction-archive-facts";
import {
  auctionArchiveDescriptionItems,
  auctionLotInspectionBlocksHtml,
  auctionLotPaintBlockHtml,
  auctionLotRecordKey,
  esc,
  secHead,
  type AuctionArchiveDescription,
} from "@/lib/auction-lot-cards-html";
import { auctionCardCount, auctionCardText, translateAuctionKvLabel, translateAuctionKvValue } from "@/lib/auction-lot-cards-i18n";
import { translateAuctionTerms } from "@/lib/auction-terms-i18n";
import { translateOpenlaneDamageText } from "@/lib/openlane-damage-locations";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { damageCarTopDataUri } from "@/lib/damage-car-top-uri";
import { DAMAGE_PANEL_PATHS, DAMAGE_PANEL_PINS, panelsFromOneLabel, type DamagePanelId } from "@/lib/damage-silhouette-panels";
import { buildThecarapiPdfModel, THECARAPI_NUMERIC_ZONE_RE, type ThecarapiPdfDamage, type ThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import { thecarapiSalePriceFromFields, thecarapiSaleStatus } from "@/lib/thecarapi-sale-price";
import type { ThecarapiAdminRecord, ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

/* ---------- Teksti (LV atslēga → EN/RU/DE) ---------- */

type Tr = { en: string; ru: string; de: string };
const tr = (en: string, ru: string, de: string): Tr => ({ en, ru, de });

const TEXT: Record<string, Tr> = {
  Nobraukums: tr("Mileage", "Пробег", "Laufleistung"),
  Izsoles: tr("Auctions", "Аукционы", "Auktionen"),
  Solījumi: tr("Bids", "Ставки", "Gebote"),
  Cenas: tr("Prices", "Цены", "Preise"),
  Bojājumi: tr("Damage", "Повреждения", "Schäden"),
  Periods: tr("Period", "Период", "Zeitraum"),
  Statuss: tr("Status", "Статус", "Status"),
  Datums: tr("Date", "Дата", "Datum"),
  "Izsoles nr.": tr("Lot no.", "№ лота", "Los-Nr."),
  Foto: tr("Photos", "Фото", "Fotos"),
  "augst.": tr("high", "макс.", "höchst."),
  "zem.": tr("low", "мин.", "niedr."),
  "Kopīgie dati": tr("Shared data", "Общие данные", "Gemeinsame Daten"),
  "dati vienādi": tr("same data", "данные совпадают", "gleiche Daten"),
  "Izsoļu foto": tr("Auction photos", "Фото с аукционов", "Auktionsfotos"),
  "arī izsolē": tr("also in auction", "также на аукционе", "auch in Auktion"),
  "pārdošana nav redzama": tr("no sale recorded", "продажа не видна", "kein Verkauf erkennbar"),
  pārdots: tr("sold", "продан", "verkauft"),
  Pārdots: tr("Sold", "Продан", "Verkauft"),
  "Nav pārdots": tr("Not sold", "Не продан", "Nicht verkauft"),
  "Izsole noslēgusies": tr("Auction closed", "Аукцион завершён", "Auktion beendet"),
  Noslēgušās: tr("Closed", "Завершены", "Beendet"),
  Izsole: tr("Auction", "Аукцион", "Auktion"),
  "Nav norādīti": tr("Not stated", "Не указаны", "Nicht angegeben"),
  "izsoļu datos": tr("in auction data", "в данных аукционов", "in Auktionsdaten"),
  Zona: tr("Zone", "Зона", "Zone"),
  Virsbūve: tr("Body", "Кузов", "Karosserie"),
  Pārdevējs: tr("Seller", "Продавец", "Verkäufer"),
  "Servisa vēsture": tr("Service history", "Сервисная история", "Servicehistorie"),
  "Aplēstā vērtība": tr("Estimated value", "Оценочная стоимость", "Schätzwert"),
  "Publiskā cena": tr("Public price", "Публичная цена", "Öffentlicher Preis"),
  "Aplēstā vērtība - portāla aplēse, nav pirkšanas cena.": tr(
    "Estimated value - the portal's estimate, not a purchase price.",
    "Оценочная стоимость - оценка портала, не цена покупки.",
    "Schätzwert - Schätzung des Portals, kein Kaufpreis.",
  ),
  "Pārdošanas un izsoļu vēsture": tr("Sales and auction history", "История продаж и аукционов", "Verkaufs- und Auktionshistorie"),
  "Transportlīdzekļa dati": tr("Vehicle data", "Данные автомобиля", "Fahrzeugdaten"),
};

function T(lv: string, lang: ClientReportLang): string {
  if (lang === "lv") return lv;
  const hit = TEXT[lv];
  return hit ? hit[lang] : auctionCardText(lv, lang);
}

function times(n: number, lang: ClientReportLang): string {
  if (lang === "en") return `${n} ${n === 1 ? "time" : "times"}`;
  if (lang === "ru") return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "раз" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "раза" : "раз"}`;
  if (lang === "de") return `${n}-mal`;
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "reize" : "reizes"}`;
}

/** «7 nedēļās» / «12 dienās» / «5 mēnešos» - laika posms starp pirmo un pēdējo izsoli. */
function spanText(days: number, lang: ClientReportLang): string {
  if (days < 14) {
    const n = Math.max(1, days + 1);
    if (lang === "en") return `within ${n} ${n === 1 ? "day" : "days"}`;
    if (lang === "ru") return `за ${n} дн.`;
    if (lang === "de") return `in ${n} ${n === 1 ? "Tag" : "Tagen"}`;
    return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "dienā" : "dienās"}`;
  }
  if (days <= 120) {
    const n = Math.ceil(days / 7);
    if (lang === "en") return `within ${n} weeks`;
    if (lang === "ru") return `за ${n} нед.`;
    if (lang === "de") return `in ${n} Wochen`;
    return `${n} nedēļās`;
  }
  const n = Math.max(1, Math.round(days / 30.44));
  if (lang === "en") return `within ${n} months`;
  if (lang === "ru") return `за ${n} мес.`;
  if (lang === "de") return `in ${n} Monaten`;
  return `${n} mēnešos`;
}

function sameInAll(n: number, lang: ClientReportLang): string {
  if (lang === "en") return `same in all ${n} auctions`;
  if (lang === "ru") return `одинаков на всех ${n} аукционах`;
  if (lang === "de") return `gleich in allen ${n} Auktionen`;
  return `vienāds visās ${n} izsolēs`;
}

function damagesSameInAll(n: number, lang: ClientReportLang): string {
  if (lang === "en") return `same in all ${n} auctions`;
  if (lang === "ru") return `одинаковы на всех ${n} аукционах`;
  if (lang === "de") return `gleich in allen ${n} Auktionen`;
  return `vienādi visās ${n} izsolēs`;
}

function photosSameNote(platform: string, n: number, period: string, lang: ClientReportLang): string {
  if (lang === "en") return `${platform} photos are the same in all ${n} auctions (${period}) - shown once.`;
  if (lang === "ru") return `Фото ${platform} одинаковы на всех ${n} аукционах (${period}) - показаны один раз.`;
  if (lang === "de") return `${platform}-Fotos sind in allen ${n} Auktionen gleich (${period}) - einmal gezeigt.`;
  return `${platform} foto vienādas visās ${n} izsolēs (${period}) - parādītas vienreiz.`;
}

/* ---------- Skaitļi un datumi ---------- */

function grp(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function eurRange(values: readonly number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${grp(min)} €` : `${grp(min)}-${grp(max)} €`;
}

/** «28.09-12.11.2026» (viens gads) vai «28.12.2025-04.01.2026». */
function periodText(fromIso: string, toIso: string): string {
  const a = formatIsoDayLv(fromIso);
  const b = formatIsoDayLv(toIso);
  if (!a || !b) return a || b;
  if (a === b) return a;
  return fromIso.slice(0, 4) === toIso.slice(0, 4) ? `${a.slice(0, 5)}-${b}` : `${a}-${b}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round(Math.abs(b - a) / 86_400_000) : 0;
}

function lowerFirst(s: string): string {
  return s.length > 1 && /\p{Ll}/u.test(s.charAt(1)) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/* ---------- Bojājumi ---------- */

/** Detaļa / zona / bojājuma veids klienta valodā: Openlane vārdnīca, tad izsoļu termini. */
const DAMAGE_PHRASES: [RegExp, { lv: string } & Tr][] = [
  [
    /^(user\s+)?damages?,?\s*all\s+around,?\s*(user\s+damages?)?$/i,
    { lv: "Lietošanas bojājumi visapkārt", en: "Wear damage all around", ru: "Следы эксплуатации по всему кузову", de: "Gebrauchsspuren rundum" },
  ],
  [/^user\s+damages?\s+all\s+around$/i, { lv: "Lietošanas bojājumi visapkārt", en: "Wear damage all around", ru: "Следы эксплуатации по всему кузову", de: "Gebrauchsspuren rundum" }],
];

function damageTerm(text: string, lang: ClientReportLang): string {
  if (!text) return text;
  const phrase = DAMAGE_PHRASES.find(([re]) => re.test(text.trim()))?.[1];
  if (phrase) return phrase[lang];
  return translateOpenlaneDamageText(text, lang) ?? translateAuctionTerms(text, lang);
}

/** «Text: X» piezīme, kas atkārto cita ieraksta veidu (Autorola), nav otrs bojājums. */
export function cleanAuctionDamages(list: readonly ThecarapiPdfDamage[]): ThecarapiPdfDamage[] {
  const types = new Set(list.map((d) => d.type.trim().toLowerCase()).filter(Boolean));
  const out: ThecarapiPdfDamage[] = [];
  const seen = new Set<string>();
  for (const d of list) {
    const note = d.notes.replace(/^text:\s*/i, "").trim();
    const notesOnly = !d.zone.trim() && !d.part.trim() && !d.type.trim();
    if (notesOnly && note && types.has(note.toLowerCase())) continue;
    const clean = { ...d, notes: /^text:/i.test(d.notes) ? note : d.notes };
    const key = damageKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function damageKey(d: ThecarapiPdfDamage): string {
  return [d.zone, d.part, d.type, d.size, d.quantity, d.repair, d.notes].map((x) => x.trim().toLowerCase()).join("|");
}

/** Bojājumu paraksts grupēšanai: «tie paši bojājumi» = tā pati kopa (secība nav svarīga). */
export function auctionDamageSignature(list: readonly ThecarapiPdfDamage[]): string {
  return list.map(damageKey).sort().join("\n");
}

export type AuctionDamagePlace = { label: string; panel: DamagePanelId | null };

const PLACE_IN_PART = /priek|aizmug|kreis|lab(ais|ā|ās|o)|jumt|bufer|pārseg|bagāžn|stikl|slieksn|statn|lukt/i;

/**
 * Zona/detaļa → vieta klienta valodā + detaļa siluetā (vienīgā vieta, kur zona kļūst par vietu).
 * Openlane numurus modelis jau pārvērš LV vietā (`openlane-damage-locations.ts`: 1 priekšējais buferis, 3 motora
 * pārsegs, 13 aizmugurējais buferis, 16 jumts); nezināms numurs paliek «Zona N» bez vietas siluetā.
 */
export function auctionDamagePlace(d: Pick<ThecarapiPdfDamage, "zone" | "part">, lang: ClientReportLang = "lv"): AuctionDamagePlace {
  const zone = d.zone.trim();
  const part = d.part.trim();
  const num = THECARAPI_NUMERIC_ZONE_RE.exec(zone) ?? /^(\d{1,3})$/.exec(zone);
  if (num) return { label: [`${T("Zona", lang)} ${num[1]}`, part ? damageTerm(part, lang) : ""].filter(Boolean).join(", "), panel: null };
  const lvLabel = part && (PLACE_IN_PART.test(part) || !zone) ? part : [zone, part].filter(Boolean).join(", ");
  const panel = [...panelsFromOneLabel(lvLabel)][0] ?? [...panelsFromOneLabel(`${zone} ${part}`)][0] ?? null;
  const label = (part && (PLACE_IN_PART.test(part) || !zone) ? [part] : [zone, part]).filter(Boolean).map((x) => damageTerm(x, lang)).join(", ");
  return { label, panel };
}

type PlaceRow = { n: number; label: string; panel: DamagePanelId | null; kinds: string[] };

function damageKindText(d: ThecarapiPdfDamage, lang: ClientReportLang): string {
  const q = Number.parseInt(d.quantity, 10);
  return [d.type ? damageTerm(d.type, lang) : "", d.size, q > 1 ? `${q}×` : "", d.repair, d.notes].filter(Boolean).join(" · ");
}

/** Saraksts grupēts pa vietām: «Zona 3 - šķemba, iespiedums». */
export function auctionDamagePlaceRows(list: readonly ThecarapiPdfDamage[], lang: ClientReportLang = "lv"): PlaceRow[] {
  const rows: PlaceRow[] = [];
  const byLabel = new Map<string, PlaceRow>();
  for (const d of list) {
    const place = auctionDamagePlace(d, lang);
    const label = place.label || T("Virsbūve", lang);
    let row = byLabel.get(label);
    if (!row) {
      row = { n: rows.length + 1, label, panel: place.panel, kinds: [] };
      byLabel.set(label, row);
      rows.push(row);
    }
    const kind = lowerFirst(damageKindText(d, lang));
    if (kind && !row.kinds.includes(kind)) row.kinds.push(kind);
  }
  return rows;
}

/** Esošais PROVIN siluets (`damage-car-top`) ar detaļām viegli zilā un numuriem ārpus virsbūves ar tievu līniju. */
function damageSilhouetteSvg(rows: readonly PlaceRow[]): string {
  const placed = rows.filter((r) => r.panel);
  if (placed.length === 0) return "";
  const panels = [...new Set(placed.map((r) => r.panel!))];
  const sides: Record<"l" | "r", { row: PlaceRow; cx: number; cy: number; y: number }[]> = { l: [], r: [] };
  for (const r of placed) {
    const pin = DAMAGE_PANEL_PINS[r.panel!];
    sides[pin.cx < 80 ? "l" : "r"].push({ row: r, cx: pin.cx, cy: pin.cy, y: pin.cy });
  }
  for (const list of Object.values(sides)) {
    list.sort((a, b) => a.cy - b.cy);
    for (let i = 0; i < list.length; i++) {
      const min = i === 0 ? 10 : list[i - 1]!.y + 19;
      list[i]!.y = Math.max(list[i]!.y, min);
    }
    const over = list.length ? list[list.length - 1]!.y - 260 : 0;
    if (over > 0) for (const it of list) it.y = Math.max(10, it.y - over);
  }
  const lines: string[] = [];
  const badges: string[] = [];
  for (const [side, list] of Object.entries(sides)) {
    for (const it of list) {
      const edge = side === "l" ? -4 : 176;
      const bx = side === "l" ? -28 : 176;
      lines.push(`<path d="M${it.cx} ${it.cy} L${side === "l" ? 20 : 160} ${it.y} L${edge} ${it.y}"/>`);
      badges.push(
        `<rect x="${bx}" y="${it.y - 8}" width="24" height="16" rx="5" fill="#334155"/><text x="${bx + 12}" y="${it.y + 3.5}" fill="#fff">${it.row.n}</text>`,
      );
    }
  }
  const car = damageCarTopDataUri();
  return `<svg class="ah-dmg__svg" viewBox="-28 0 236 270" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-hidden="true">
<rect x="0" y="0" width="180" height="270" fill="#ffffff"/>
<image href="${car}" xlink:href="${car}" x="0" y="0" width="180" height="270" preserveAspectRatio="xMidYMid meet"/>
<g fill="#0061D2" fill-opacity="0.16" stroke="#0061D2" stroke-opacity="0.55" stroke-width="1.2">${panels.map((p) => `<path d="${DAMAGE_PANEL_PATHS[p]}"/>`).join("")}</g>
<g stroke="#94A3B8" stroke-width="0.8" fill="none">${lines.join("")}</g>
<g font-family="Inter,sans-serif" font-size="9" font-weight="700" text-anchor="middle">${badges.join("")}</g>
</svg>`;
}

function damageBlockHtml(list: readonly ThecarapiPdfDamage[], label: string, lang: ClientReportLang): string {
  if (list.length === 0) return "";
  const rows = auctionDamagePlaceRows(list, lang);
  const svg = damageSilhouetteSvg(rows);
  const items = rows
    .map(
      (r) =>
        `<li><span class="ah-dmg__num">${r.n}</span><span class="ah-dmg__place">${esc(r.label)}</span><span class="ah-dmg__kind">${esc(r.kinds.join(", "))}</span></li>`,
    )
    .join("");
  return `<div class="ah-block"><p class="ah-lbl">${esc(label)}</p><div class="ah-dmg${svg ? "" : " ah-dmg--list"}">${svg}<ul>${items}</ul></div></div>`;
}

/* ---------- Izsoles un grupas ---------- */

type Lot = {
  key: string;
  record: ThecarapiAdminRecord;
  platform: string;
  date: string;
  km: number | null;
  priceEur: number | null;
  priceLabel: string;
  status: string;
  facts: ArchiveLotFacts;
  damages: ThecarapiPdfDamage[];
  model: ThecarapiPdfModel | null;
};

export type AuctionLotGroup = { platform: string; lots: Lot[] };

/** Arhīva tehniskie un klientam nevajadzīgie lauki (Nils 27.11): atslēgas, piegāde, fiksēšana arhīvā, skatījumi. */
const HIDDEN_KEYS = new Set([
  "Izsoles laiks",
  "Izsoles beigas",
  "Izsoles Nr.",
  "Pirmoreiz fiksēts arhīvā",
  "Pēdējoreiz redzēts portālā",
  "Skatījumi izsolē",
  "Piegādes laiks pēc izsoles",
  "Atslēgas",
  "Auto atrašanās vieta",
]);

const SHORT_LABEL: Record<string, string> = {
  "Pārdevēja atrašanās vieta": "Pārdevējs",
  "Virsbūves stāvoklis (izsoles vērtējums)": "Virsbūve",
  "Servisa vēsture izsolē": "Servisa vēsture",
  "Portāla aplēstā vērtība (nav pirkšanas cena)": "Aplēstā vērtība",
  "Portāla publiskā cena": "Publiskā cena",
};

const ESTIMATE_KEY = "Portāla aplēstā vērtība (nav pirkšanas cena)";

function labelText(k: string, lang: ClientReportLang): string {
  const short = SHORT_LABEL[k];
  return short ? T(short, lang) : translateAuctionKvLabel(k, lang);
}

function valueText(v: string, lang: ClientReportLang): string {
  return lang === "lv" ? v : translateAuctionKvValue(v, lang);
}

function statusText(s: string, lang: ClientReportLang): string {
  return T(s, lang);
}

function buildLots(records: readonly ThecarapiAdminRecord[], showPrices: boolean): Lot[] {
  const summary = buildAuctionArchiveSummary({ vin: "", title: "", block: { thecarapiRecords: [...records], photoGroups: [] } });
  const byKey = new Map(summary.auctions.map((a) => [a.key, a]));
  return records
    .map((r) => {
      const key = auctionLotRecordKey(r);
      const a = byKey.get(key);
      let model: ThecarapiPdfModel | null = null;
      try {
        model = buildThecarapiPdfModel(r);
      } catch {
        model = null;
      }
      const sp = thecarapiSalePriceFromFields(r.fields);
      const facts = auctionArchiveLotFacts(r, { showPrices });
      let priceEur = a?.priceEur ?? sp.eur;
      let priceLabel = sp.label;
      // Cenu lauks dod tikai publisko cenu, bet faktos ir solījums (Autorola) - galvenā cena ir solījums.
      if (!isBidLabel(priceLabel)) {
        const bid = facts.prices.find((x) => isBidLabel(x.k));
        const n = bid ? Number(bid.v.replace(/[^\d]/g, "")) : NaN;
        if (bid && n > 0) {
          priceEur = n;
          priceLabel = bid.k;
        }
      }
      return {
        key,
        record: r,
        platform: a?.platform || r.venue || r.site || "Izsole",
        date: a?.date || r.date || "",
        km: a?.km ?? null,
        priceEur,
        priceLabel,
        status: thecarapiSaleStatus(r.fields),
        facts,
        damages: cleanAuctionDamages(model?.damages ?? []),
        model,
      };
    })
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}

/**
 * Vienas platformas izsoles ar to pašu nobraukumu (± 0) un tiem pašiem bojājumiem - viena grupa.
 * Grupas secība - pēc pirmās izsoles datuma.
 */
export function groupAuctionLots<L extends Pick<Lot, "platform" | "km" | "damages" | "date">>(lots: readonly L[]): { platform: string; lots: L[] }[] {
  const groups = new Map<string, { platform: string; lots: L[] }>();
  for (const l of lots) {
    const key = [l.platform.trim().toLowerCase(), l.km ?? "-", auctionDamageSignature(l.damages)].join("\u0001");
    const g = groups.get(key) ?? { platform: l.platform, lots: [] };
    g.lots.push(l);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, lots: [...g.lots].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")) }))
    .sort((a, b) => (a.lots[0]!.date || "9999").localeCompare(b.lots[0]!.date || "9999"));
}

/* ---------- HTML primitīvi ---------- */

type Cell = { k: string; v: string; red?: boolean };

function strip(cells: readonly Cell[]): string {
  const list = cells.filter((c) => c.v);
  if (list.length === 0) return "";
  return `<div class="ah-strip">${list.map((c) => `<div><span>${esc(c.k)}</span><b${c.red ? ' class="ah-red"' : ""}>${esc(c.v)}</b></div>`).join("")}</div>`;
}

const ICONS: Record<string, string> = {
  odo: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  dmg: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

function tile(icon: string, label: string, value: string, note: string, alert = false): string {
  return `<div class="ah-tile${alert ? " ah-tile--alert" : ""}"><p class="ah-tile__label"><svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${
    ICONS[icon] ?? ""
  }</g></svg>${esc(label)}</p><p class="ah-tile__value">${esc(value)}</p>${note ? `<p class="ah-tile__note">${esc(note)}</p>` : ""}</div>`;
}

/* ---------- Faktu kartītes ---------- */

function isBidLabel(label: string): boolean {
  return label === "Pēdējais solījums" || label === "Noslēguma cena";
}

function factTilesHtml(lots: readonly Lot[], groups: readonly AuctionLotGroup[], showPrices: boolean, lang: ClientReportLang): string {
  const tiles: string[] = [];
  const n = lots.length;
  const dated = lots.filter((l) => l.date);

  const kms = lots.map((l) => l.km).filter((k): k is number => k != null);
  if (kms.length) {
    const last = [...lots].reverse().find((l) => l.km != null)!;
    const allSame = kms.length === n && new Set(kms).size === 1;
    const note = allSame ? (n > 1 ? sameInAll(n, lang) : formatIsoDayLv(last.date)) : formatIsoDayLv(last.date);
    tiles.push(tile("odo", T("Nobraukums", lang), formatKm(last.km), note));
  }

  const sold = lots.find((l) => l.status === "Pārdots");
  const span = dated.length > 1 ? spanText(daysBetween(dated[0]!.date, dated[dated.length - 1]!.date), lang) : dated[0] ? formatIsoDayLv(dated[0].date) : "";
  const saleNote = sold ? `${T("pārdots", lang)} ${formatIsoDayLv(sold.date)}`.trim() : T("pārdošana nav redzama", lang);
  tiles.push(tile("repeat", T("Izsoles", lang), times(n, lang), [span, saleNote].filter(Boolean).join(", ")));

  if (showPrices) {
    const bids = lots.filter((l) => l.priceEur != null && isBidLabel(l.priceLabel));
    const priced = bids.length ? bids : lots.filter((l) => l.priceEur != null);
    if (priced.length) {
      const platforms = [...new Set(priced.map((l) => l.platform))];
      tiles.push(
        tile("euro", T(bids.length ? "Solījumi" : "Cenas", lang), eurRange(priced.map((l) => l.priceEur!)), `${platforms.join(", ")}, ${auctionCardCount(priced.length, "izsole", lang)}`),
      );
    }
  }

  const perPlatform = new Map<string, Set<string>>();
  for (const g of groups) {
    const set = perPlatform.get(g.platform) ?? new Set<string>();
    for (const d of g.lots[0]!.damages) set.add(damageKey(d));
    perPlatform.set(g.platform, set);
  }
  const total = [...perPlatform.values()].reduce((s, x) => s + x.size, 0);
  if (total > 0) {
    const withDmg = [...perPlatform.entries()].filter(([, s]) => s.size > 0);
    const note = withDmg.length > 1 ? withDmg.map(([p, s]) => `${p} ${s.size}`).join(", ") : withDmg[0]![0];
    tiles.push(tile("dmg", T("Bojājumi", lang), String(total), note, true));
  } else if (lots.some((l) => l.facts.damagesDeclared === false)) {
    tiles.push(tile("dmg", T("Bojājumi", lang), T("Nav norādīti", lang), T("izsoļu datos", lang)));
  }
  return `<div class="ah-tiles ah-tiles--${tiles.length}">${tiles.join("")}</div>`;
}

/* ---------- Kartītes ---------- */

function factRows(l: Lot, hideDamageFlag: boolean): ArchiveKv[] {
  return [...l.facts.sale, ...l.facts.condition].filter((r) => !HIDDEN_KEYS.has(r.k) && !(hideDamageFlag && r.k === "Bojājumi izsoles datos"));
}

function placeMeta(l: Lot): string {
  const loc = l.facts.sale.find((r) => r.k === "Auto atrašanās vieta")?.v ?? "";
  return loc || l.facts.country || "";
}

function descriptionHtml(items: readonly AuctionArchiveDescription[], lang: ClientReportLang): string {
  if (items.length === 0) return "";
  return `<div class="ah-block"><p class="ah-lbl">${esc(auctionCardText("Izsoles apraksts", lang))}</p>${items
    .map((d) => `<p class="ah-desc">${esc(d.text)}</p>`)
    .join("")}</div>`;
}

/** Apraksti, krāsas mērījumi, riepas/bremzes - vienreiz grupai (vienādi bloki netiek atkārtoti). */
function extrasHtml(lots: readonly Lot[], lang: ClientReportLang): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (html: string) => {
    if (html && !seen.has(html)) {
      seen.add(html);
      out.push(html);
    }
  };
  for (const l of [...lots].reverse()) {
    if (l.model) push(auctionLotPaintBlockHtml(l.model, lang).replace('class="aa-block"', 'class="aa-block ah-block"'));
    if (l.model) push(auctionLotInspectionBlocksHtml(l.model, lang).replace(/class="aa-block"/g, 'class="aa-block ah-block"'));
  }
  const descSeen = new Set<string>();
  const descs: AuctionArchiveDescription[] = [];
  const norm = (x: string) => [...new Set(x.toLowerCase().replace(/^text:\s*/, "").replace(/[^\p{L}]+/gu, " ").split(" ").filter(Boolean).map((w) => w.replace(/s$/, "")))].sort().join(" ");
  const dmgTexts = new Set(lots.flatMap((l) => l.damages.flatMap((d) => [d.type, d.notes].filter(Boolean).map(norm))));
  for (const l of [...lots].reverse())
    for (const d of auctionArchiveDescriptionItems(l.record)) {
      const k = d.text.toLowerCase();
      if (dmgTexts.has(norm(d.text))) continue;
      if (!descSeen.has(k)) {
        descSeen.add(k);
        descs.push(d);
      }
    }
  push(descriptionHtml(descs.slice(0, 6), lang));
  return out.join("");
}

function photoCount(l: Lot): number {
  return l.record.photos.length;
}

function groupCardHtml(g: AuctionLotGroup, showPrices: boolean, lang: ClientReportLang): string {
  const lots = g.lots;
  const n = lots.length;
  const first = lots[0]!;
  const last = lots[n - 1]!;
  const dmg = first.damages;

  // Cenu kolonnas: solījums (vai cits galvenais cenas veids) + pārējās avota cenas (aplēstā vērtība u.c.).
  const bidLabels = [...new Set(lots.filter((l) => l.priceEur != null).map((l) => l.priceLabel || "Cena"))];
  const bidLabel = bidLabels.length === 1 ? bidLabels[0]! : "Cena";
  const priceKeys: string[] = [];
  if (showPrices)
    for (const l of lots) for (const r of l.facts.prices) if (!priceKeys.includes(r.k) && r.k !== l.priceLabel && r.k !== bidLabel) priceKeys.push(r.k);
  const priceOf = (l: Lot, k: string) => l.facts.prices.find((r) => r.k === k)?.v ?? "";

  // Kopīgie dati - vienādi visās izsolēs; atšķirīgie - kolonnā.
  const rowsBy = lots.map((l) => factRows(l, dmg.length > 0));
  const keys: string[] = [];
  for (const rows of rowsBy) for (const r of rows) if (!keys.includes(r.k)) keys.push(r.k);
  const common: ArchiveKv[] = [];
  const differing: string[] = [];
  for (const k of keys) {
    // Izsolē, kurā lauka nav (avots to vairs nedod), tas nav «cits» dati - salīdzina tikai esošās vērtības.
    const vals = rowsBy.map((rows) => rows.find((r) => r.k === k)).filter((v): v is ArchiveKv => !!v);
    if (new Set(vals.map((v) => v.v)).size === 1) common.push(vals[0]!);
    else differing.push(k);
  }

  const bids = lots.filter((l) => l.priceEur != null).map((l) => l.priceEur!);
  const maxBid = bids.length ? Math.max(...bids) : null;
  const minBid = bids.length ? Math.min(...bids) : null;
  const markExt = n >= 3 && maxBid != null && minBid != null && maxBid !== minBid;
  const maxLot = markExt ? [...lots].reverse().find((l) => l.priceEur === maxBid) : undefined;
  const minLot = markExt ? [...lots].reverse().find((l) => l.priceEur === minBid) : undefined;

  const head = [
    `<th>${esc(T("Datums", lang))}</th>`,
    `<th>${esc(T("Izsoles nr.", lang))}</th>`,
    showPrices && bids.length ? `<th class="ah-num">${esc(labelText(bidLabel, lang))}</th>` : "",
    ...priceKeys.map((k) => `<th class="ah-num">${esc(labelText(k, lang))}</th>`),
    ...differing.map((k) => `<th>${esc(labelText(k, lang))}</th>`),
    `<th class="ah-num">${esc(T("Foto", lang))}</th>`,
  ].join("");
  const body = lots
    .map((l) => {
      const ext = l === maxLot ? T("augst.", lang) : l === minLot ? T("zem.", lang) : "";
      const rows = factRows(l, dmg.length > 0);
      return `<tr${ext ? ' class="ah-ext"' : ""}><td>${esc(formatIsoDayLv(l.date) || "-")}</td><td class="ah-sub">${esc(l.facts.lotNo || "-")}</td>${
        showPrices && bids.length
          ? `<td class="ah-num ah-bid">${l.priceEur != null ? esc(`${grp(l.priceEur)} €`) : "-"}${ext ? `<span class="ah-ext-lbl">${esc(ext)}</span>` : ""}</td>`
          : ""
      }${priceKeys.map((k) => `<td class="ah-num ah-sub">${esc(priceOf(l, k) || "-")}</td>`).join("")}${differing
        .map((k) => `<td>${esc(valueText(rows.find((r) => r.k === k)?.v ?? "-", lang))}</td>`)
        .join("")}<td class="ah-num${photoCount(l) ? "" : " ah-sub"}">${photoCount(l) || "-"}</td></tr>`;
    })
    .join("");
  const table = `<table class="ah-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

  // Datu josla: periods, solījumu diapazons, citas cenas (pirmā → pēdējā), statuss.
  const statuses = [...new Set(lots.map((l) => l.status))];
  const soldLot = lots.find((l) => l.status === "Pārdots");
  const status = soldLot
    ? `${statusText("Pārdots", lang)} ${formatIsoDayLv(soldLot.date)}`.trim()
    : statuses.length === 1
      ? statuses[0] === "Izsole noslēgusies"
        ? T("Noslēgušās", lang)
        : statuses[0] === "Izsole"
          ? ""
          : statusText(statuses[0]!, lang)
      : statuses.filter((s) => s !== "Izsole").map((s) => statusText(s, lang)).join(", ");
  const priceCells: Cell[] = priceKeys.map((k) => {
    const vals = lots.map((l) => priceOf(l, k)).filter(Boolean);
    const a = vals[0] ?? "";
    const b = vals[vals.length - 1] ?? "";
    return { k: labelText(k, lang), v: a && b && a !== b ? `${a.replace(/\s*€$/, "")} → ${b}` : a };
  });
  const head1 = strip([
    { k: T("Periods", lang), v: periodText(first.date, last.date) },
    ...(showPrices && bids.length ? [{ k: labelText(bidLabel, lang), v: eurRange(bids) }] : []),
    ...priceCells,
    { k: T("Statuss", lang), v: status },
  ]);
  const commonHtml = common.length
    ? `<div class="ah-block"><p class="ah-lbl">${esc(T("Kopīgie dati", lang))}</p>${strip(
        common.map((r) => ({ k: labelText(r.k, lang), v: valueText(r.v, lang), red: r.missing || r.alert || /^nav norādīt/i.test(r.v) })),
      )}</div>`
    : "";
  const dmgHtml = damageBlockHtml(dmg, `${T("Bojājumi", lang)} · ${damagesSameInAll(n, lang)}`, lang);
  const foot = priceKeys.includes(ESTIMATE_KEY) ? `<p class="ah-foot">${esc(T("Aplēstā vērtība - portāla aplēse, nav pirkšanas cena.", lang))}</p>` : "";
  const pill = `${auctionCardCount(n, "izsole", lang)} · ${T("dati vienādi", lang)}`;
  return `<section class="ah-card"><div class="ah-plat"><span class="ah-plat__name">${esc(g.platform)}</span><span class="ah-plat__meta">${esc(
    valueText(placeMeta(last), lang),
  )}</span><span class="ah-grow"></span><span class="ah-pill">${esc(pill)}</span></div>${head1}<div class="ah-block">${table}${foot}</div>${commonHtml}${dmgHtml}${extrasHtml(
    lots,
    lang,
  )}</section>`;
}

function singleCardHtml(l: Lot, showPrices: boolean, lang: ClientReportLang): string {
  const textual = l.damages.length === 1 && !l.damages[0]!.zone.trim() && !l.damages[0]!.part.trim();
  const cells: Cell[] = [];
  if (showPrices) {
    if (l.priceEur != null) cells.push({ k: labelText(l.priceLabel || "Cena", lang), v: `${grp(l.priceEur)} €` });
    for (const r of l.facts.prices) if (r.k !== l.priceLabel) cells.push({ k: labelText(r.k, lang), v: r.v });
  }
  if (l.facts.lotNo) cells.push({ k: T("Izsoles nr.", lang), v: l.facts.lotNo });
  for (const r of factRows(l, l.damages.length > 0)) cells.push({ k: labelText(r.k, lang), v: valueText(r.v, lang), red: r.missing || r.alert || /^nav norādīt/i.test(r.v) });
  if (textual) cells.push({ k: T("Bojājumi", lang), v: damageKindText(l.damages[0]!, lang) });
  const meta = [formatIsoDayLv(l.date), valueText(placeMeta(l), lang)].filter(Boolean).join(" · ");
  const status = l.status === "Izsole" ? "" : statusText(l.status, lang);
  return `<section class="ah-card"><div class="ah-plat"><span class="ah-plat__name">${esc(l.platform)}</span><span class="ah-plat__meta">${esc(meta)}</span><span class="ah-grow"></span>${
    status ? `<span class="ah-pill">${esc(lowerFirst(status))}</span>` : ""
  }</div>${strip(cells)}${textual ? "" : damageBlockHtml(l.damages, T("Bojājumi", lang), lang)}${extrasHtml([l], lang)}</section>`;
}

/* ---------- Foto ---------- */

export type AuctionHistoryPhoto = {
  id: string;
  /** Izsole, kurā foto parādījās pirmo reizi. */
  lotKey: string;
  platform: string;
  date: string;
  index: number;
  total: number;
  /** Citas izsoles (datumi YYYY-MM-DD), kurās tā pati foto. */
  alsoDates: string[];
};

function photoKeys(p: { id?: string; sourceUrl?: string; contentHash?: string }): string[] {
  return [p.id ? `id:${p.id}` : "", p.sourceUrl?.trim() ? `url:${p.sourceUrl.trim()}` : "", p.contentHash?.trim() ? `hash:${p.contentHash.trim().toLowerCase()}` : ""].filter(Boolean);
}

/**
 * Visas izsoļu foto vienreiz (pēc id / saites / satura hash), hronoloģiski. Katra foto pieder izsolei, kurā tā parādījās
 * pirmo reizi; pārējās izsoles ar to pašu foto - `alsoDates` («arī izsolē DD.MM.GGGG»).
 */
export function auctionHistoryPhotos(
  lots: readonly Pick<Lot, "key" | "record" | "platform" | "date">[],
  photos: readonly Pick<ThecarapiStoredPhoto, "id" | "sourceUrl" | "contentHash">[],
): AuctionHistoryPhoto[] {
  const ordered = [...lots].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const out: AuctionHistoryPhoto[] = [];
  const seen = new Set<string>();
  const usable = new Map<string, string>();
  for (const p of photos) for (const k of photoKeys(p)) if (!usable.has(k)) usable.set(k, p.id);
  for (const lot of ordered) {
    const list = lot.record.photos;
    list.forEach((p, i) => {
      const keys = photoKeys(p);
      if (keys.some((k) => seen.has(k))) return;
      const id = keys.map((k) => usable.get(k)).find(Boolean);
      if (!id) return;
      const also = ordered
        .filter((o) => o !== lot && o.record.photos.some((q) => photoKeys(q).some((k) => keys.includes(k))))
        .map((o) => o.date)
        .filter(Boolean);
      for (const k of keys) seen.add(k);
      out.push({ id, lotKey: lot.key, platform: lot.platform, date: lot.date, index: i + 1, total: list.length, alsoDates: also });
    });
  }
  // Foto, kas nav nevienā ierakstā (bilžu grupā ar citu atslēgu) - beigās, bez izsoles saites.
  return out;
}

function galleryHtml(
  photos: readonly AuctionHistoryPhoto[],
  groups: readonly AuctionLotGroup[],
  dataUrls: ReadonlyMap<string, string>,
  lang: ClientReportLang,
): string {
  const list = photos.filter((p) => dataUrls.get(p.id));
  if (list.length === 0) return "";
  // Ja grupas visās izsolēs foto ir tās pašas - viena piezīme virs galerijas, nevis katrā parakstā.
  const notes: string[] = [];
  const quiet = new Set<string>();
  for (const g of groups) {
    if (g.lots.length < 2) continue;
    const keys = new Set(g.lots.map((l) => l.key));
    const mine = list.filter((p) => keys.has(p.lotKey));
    if (mine.length && mine.every((p) => p.alsoDates.length >= g.lots.length - 1)) {
      notes.push(photosSameNote(g.platform, g.lots.length, periodText(g.lots[0]!.date, g.lots[g.lots.length - 1]!.date), lang));
      for (const p of mine) quiet.add(p.id);
    }
  }
  const figs = list
    .map((p) => {
      const also =
        !quiet.has(p.id) && p.alsoDates.length
          ? ` · ${T("arī izsolē", lang)} ${p.alsoDates
              .slice(0, 2)
              .map((d) => formatIsoDayLv(d))
              .join(", ")}${p.alsoDates.length > 2 ? ` +${p.alsoDates.length - 2}` : ""}`
          : "";
      return `<figure class="ah-fig"><img src="${dataUrls.get(p.id)!}" alt=""/><figcaption><span>${esc(
        [p.platform, formatIsoDayLv(p.date)].filter(Boolean).join(" · ") + also,
      )}</span><b>${p.index}/${p.total}</b></figcaption></figure>`;
    })
    .join("");
  return `<section class="ah-gallery">${secHead(T("Izsoļu foto", lang), { icon: "camera", badge: auctionCardCount(list.length, "bilde", lang) })}${
    notes.length ? notes.map((t) => `<p class="ah-foot ah-foot--top">${esc(t)}</p>`).join("") : ""
  }<div class="ah-photos">${figs}</div></section>`;
}

/* ---------- Kopā ---------- */

export type AuctionHistoryInput = {
  records: readonly ThecarapiAdminRecord[];
  /** Izsoļu foto ar datiem (`dataUrls` pēc id) - jau atlasītas pasūtījuma bilžu grupās vai ierakstos. */
  photos?: readonly Pick<ThecarapiStoredPhoto, "id" | "sourceUrl" | "contentHash">[];
  dataUrls?: ReadonlyMap<string, string>;
  showPrices?: boolean;
  lang?: ClientReportLang;
  /** Transportlīdzekļa dati no izsolēm (jau tulkoti) - kompakta josla aiz kartītēm. */
  vehicleRows?: readonly ArchiveKv[];
};

export function buildAuctionHistoryHtml(input: AuctionHistoryInput): string {
  const records = input.records.filter((r) => r.fields.length > 0 || r.photos.length > 0);
  if (records.length === 0) return "";
  const lang: ClientReportLang = input.lang ?? "lv";
  const showPrices = input.showPrices !== false;
  const lots = buildLots(records, showPrices);
  const groups = groupAuctionLots(lots);
  const tiles = factTilesHtml(lots, groups, showPrices, lang);
  const cards = groups.map((g) => (g.lots.length > 1 ? groupCardHtml(g, showPrices, lang) : singleCardHtml(g.lots[0]!, showPrices, lang))).join("");
  const vehicle = input.vehicleRows?.length
    ? `<section class="ah-card ah-card--plain"><p class="ah-lbl">${esc(T("Transportlīdzekļa dati", lang))}</p>${strip(
        input.vehicleRows.filter((r) => !r.missing).map((r) => ({ k: r.k, v: r.v })),
      )}</section>`
    : "";
  const gallery = galleryHtml(auctionHistoryPhotos(lots, input.photos ?? []), groups, input.dataUrls ?? new Map(), lang);
  return `<div class="ah">${tiles}${cards}${vehicle}${gallery}</div>`;
}

/** Klienta PDF CSS (maketa A klases, PROVIN PDF mainīgie un krāsas). */
export const AUCTION_HISTORY_CSS = `
.ah{margin:14px 0 0;display:flex;flex-direction:column;gap:12px}
.ah p{margin:0}
.ah-red{color:#B91C1C!important}
.ah-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px;break-inside:avoid;page-break-inside:avoid}
.ah-tiles--3{grid-template-columns:repeat(3,minmax(0,1fr))}.ah-tiles--2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ah-tile{padding:12px 14px;border:1px solid var(--pdf-line);border-radius:10px;background:#fff;min-width:0;display:flex;flex-direction:column;gap:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ah-tile__label{display:flex;align-items:center;gap:7px;font:600 var(--pdf-fs-label)/1.3 Inter,sans-serif;color:#86868b;letter-spacing:.06em;text-transform:uppercase}
.ah-tile__label svg{width:14px;height:14px;color:#0061D2;flex:none}
.ah-tile--alert .ah-tile__label::after{content:"";width:7px;height:7px;border-radius:999px;background:#FF4D4D;margin-left:auto;flex:none}
.ah-tile__value{font:750 16px/1.15 Inter,sans-serif;white-space:nowrap;color:#0f172a;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.ah-tile__note{font:500 10px/1.4 Inter,sans-serif;color:#64748b}
.ah-card{border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-outer);background:#fff;padding:14px;display:flex;flex-direction:column;gap:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ah-card--plain{gap:6px;break-inside:avoid;page-break-inside:avoid}
.ah-plat{display:flex;align-items:center;gap:10px;flex-wrap:wrap;break-after:avoid;page-break-after:avoid}
.ah-plat__name{font:800 15px/1.2 Inter,sans-serif;letter-spacing:-.01em;color:#0f172a}
.ah-plat__meta{font:600 11px/1.3 Inter,sans-serif;color:#64748b}
.ah-grow{flex:1}
.ah-pill{font:700 10px/1.3 Inter,sans-serif;border-radius:999px;padding:2px 8px;background:#F1F5F9;color:#475569;white-space:nowrap}
.ah-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 12px;padding:10px 12px;border-radius:8px;background:#FCFDFF;border:1px solid var(--pdf-line);break-inside:avoid;page-break-inside:avoid}
.ah-strip span{display:block;font:600 9px/1.3 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#64748b}
.ah-strip b{display:block;margin-top:2px;font:750 12px/1.3 Inter,sans-serif;color:#0f172a;font-variant-numeric:tabular-nums}
.ah-block{display:block}
.ah-card .aa-block{margin-top:0}
.ah-lbl{font:700 9.5px/1.3 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 4px!important;break-after:avoid;page-break-after:avoid}
.ah-table{width:100%;border-collapse:collapse;font:500 10.5px/1.35 Inter,sans-serif;font-variant-numeric:tabular-nums}
.ah-table th{font:700 9px/1.3 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#64748b;text-align:left;padding:5px 6px;border-bottom:1px solid var(--pdf-line);white-space:nowrap}
.ah-table td{padding:5px 6px;border-bottom:1px solid var(--pdf-line-soft);white-space:nowrap;color:#0f172a}
.ah-table tr{break-inside:avoid;page-break-inside:avoid}
.ah-table .ah-num{text-align:right}
.ah-table .ah-sub{color:#64748b}
.ah-bid{font-weight:600}
.ah-ext .ah-bid{font-weight:800}
.ah-ext-lbl{display:inline-block;font:700 8.5px/1 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#475569;margin-left:5px}
.ah-foot{font:500 var(--pdf-fs-fine)/1.45 Inter,sans-serif;color:#64748b;margin:6px 0 0!important}
.ah-foot--top{margin:0 0 8px!important}
.ah-dmg{display:grid;grid-template-columns:170px minmax(0,1fr);gap:22px;align-items:center;break-inside:avoid;page-break-inside:avoid}
.ah-dmg--list{grid-template-columns:minmax(0,1fr)}
.ah-dmg__svg{display:block;width:100%;height:auto}
.ah-dmg ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ah-dmg li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--pdf-line-soft)}
.ah-dmg li:last-child{border-bottom:0}
.ah-dmg__num{width:26px;height:20px;border-radius:6px;background:#334155;color:#fff;font:700 10px/20px Inter,sans-serif;text-align:center;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ah-dmg__place{font:650 12px/1.3 Inter,sans-serif;color:#0f172a}
.ah-dmg__kind{font:500 11px/1.3 Inter,sans-serif;color:#475569;text-align:right}
.ah-desc{font:500 var(--pdf-fs-table)/1.5 Inter,sans-serif;color:#0f172a;margin:0 0 4px!important}
.ah-gallery .pdf-sec-head--brand{margin:4px 0 10px;padding-bottom:8px}
.ah-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
.ah-fig{margin:0;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.ah-fig img{display:block;width:100%;height:62mm;object-fit:cover;background:var(--pdf-line-soft)}
.ah-fig figcaption{display:flex;justify-content:space-between;gap:6px;align-items:baseline;padding:4px 8px 5px;font:500 8.5px/1.3 Inter,sans-serif;color:#64748b}
.ah-fig figcaption b{color:#0f172a;font-weight:700;font-variant-numeric:tabular-nums}
`;
