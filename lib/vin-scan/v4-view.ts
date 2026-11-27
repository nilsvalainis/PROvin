/**
 * VIN SCAN v4 (Nila makets v4, 26.11): viena komponente visās vietās (Ātrā pārbaude, Ātrie vērtējumi,
 * klienta un manuālais pasūtījums). Tīra loģika: bloku secība, avotu sadale (ar datiem / tukši / kļūdas /
 * tikai saites), statusa skaitītājs un «Uzmanību» kartīte.
 *
 * Nila bloku kārtība (26.11, stingri):
 *  1) Galvenā informācija + «Uzmanību», 2) CSDD 3 soļos, 3) LTAB, 4) izsoļu dati, 5) ārvalstu reģistri,
 *  6) maksas pakalpojumi, 7) maksas atskaišu bezmaksas priekšskatījumi, 8) viss pārējais, 9) atsaukumi beigās.
 */
import type { AtraFacts } from "@/lib/atra-parbaude-facts";
import { vinScanSourceCategory, vinScanSourceLinkOnly, groupVinScanByCategory } from "@/lib/vin-scan/catalog";

/** Avotu bloki, kas zīmējas no VIN SCAN rindām (CSDD, LTAB un maksas saraksts ir atsevišķi). */
export type VinScanV4BlockId = "izsoles" | "arvalstu" | "prieksskati" | "citi" | "atsaukumi";

export const VIN_SCAN_V4_BLOCKS: readonly { id: VinScanV4BlockId; label: string }[] = [
  { id: "izsoles", label: "Izsoļu dati" },
  { id: "arvalstu", label: "Ārvalstu reģistri" },
  { id: "prieksskati", label: "Maksas atskaišu priekšskatījumi" },
  { id: "citi", label: "Citi avoti" },
  { id: "atsaukumi", label: "Atsaukumi" },
];

/** Maksas atskaišu bezmaksas priekšskatījumi (7. bloks). */
export const VIN_SCAN_V4_PREVIEW_IDS = ["autodna_precheck", "carfax_eu", "checkcar_vin"] as const;

/** Ārvalstu reģistri ārpus kategorijas «Reģistri» (apskates / apdrošināšanas reģistri citās valstīs). */
const FOREIGN_EXTRA_IDS = new Set<string>(["dvsa_mot", "kfz_at", "lkf_ee"]);

/** CSDD rinda ir CSDD bloka 1. solī, nevis avotu sarakstā. */
export const VIN_SCAN_V4_CSDD_ID = "csdd";

export type VinScanV4Status =
  | "found"
  | "none"
  | "unknown"
  | "blocked"
  | "timeout"
  | "config_missing"
  | "browser_only"
  | "manual"
  | "skipped"
  | "needs_input"
  | "idle"
  | "checking";

/** Minimālais rindas veids, ko saprot v4 skats (VIN SCAN panelis un pasūtījuma ieraksts dod vairāk lauku). */
export type VinScanV4RowLike = { id: string; status: string; summary?: string; label?: string; note?: string };

export function vinScanV4BlockOf(id: string): VinScanV4BlockId | "csdd" | null {
  if (id === VIN_SCAN_V4_CSDD_ID) return "csdd";
  if ((VIN_SCAN_V4_PREVIEW_IDS as readonly string[]).includes(id)) return "prieksskati";
  const category = vinScanSourceCategory(id);
  if (!category) return null;
  if (category === "izsoles") return "izsoles";
  if (category === "atsaukumi") return "atsaukumi";
  if (category === "registri" || FOREIGN_EXTRA_IDS.has(id)) return "arvalstu";
  return "citi";
}

export type VinScanV4Kind = "data" | "empty" | "error" | "pending" | "link";

const EMPTY_STATUSES = new Set(["none", "skipped", "needs_input", "config_missing", "manual"]);
/** Vienmēr īstas kļūdas: avots neatbildēja laikā / bloķēja (403, Cloudflare). */
const HARD_ERROR_STATUSES = new Set(["timeout", "blocked", "error"]);

/**
 * 26.11 (Nils): kļūdu skaitā tikai īstas kļūdas - tīkls, 5xx, captcha, taimauts.
 * Teksts, kas to norāda (arī relejā, ne tikai avotā).
 */
const REAL_ERROR_TEXT_RE =
  /captcha|cloudflare|taimaut|timeout|neatbildēja|nav pieejam|neizdevās|fetch failed|econn|enotfound|socket|tīkl|network|\bhttp\s*5\d\d\b|\b5\d\d\b|pauze|kļūd/i;
/** Informatīvi teksti: auto citam tirgum vai jāpārbauda saitē - tas nav kļūda. */
const INFO_TEXT_RE = /var neattiekties|attiecas tikai|nav starp .* jaunākajiem|pārbaudi saitē|pārbaude pārlūkā|lapa bez šī VIN/i;

/** Austrijas §57a: bez cilvēka nav iespējams (reCAPTCHA + precīzs datums) - nekad nav «kļūda». */
export const VIN_SCAN_V4_KFZ_ID = "kfz_at";

function rowText(row: VinScanV4RowLike): string {
  return `${row.summary ?? ""} ${row.note ?? ""}`;
}

/** Vai rinda ir īsta kļūda (tīkls, 5xx, captcha, taimauts), nevis «nav atrasts» / «nav piemērojams». */
export function vinScanV4IsRealError(row: VinScanV4RowLike): boolean {
  if (row.id === VIN_SCAN_V4_KFZ_ID) return false;
  if (HARD_ERROR_STATUSES.has(row.status)) return true;
  const text = rowText(row);
  if (row.status === "unknown") return !INFO_TEXT_RE.test(text) || REAL_ERROR_TEXT_RE.test(text.replace(INFO_TEXT_RE, ""));
  if (row.status === "browser_only") return REAL_ERROR_TEXT_RE.test(text);
  return false;
}

/** Kā rindu rādīt: ar datiem (blokā), tukša / kļūda (saliktajā sarakstā), vēl lasa, tikai saite. */
export function vinScanV4Kind(row: VinScanV4RowLike): VinScanV4Kind {
  if (row.status === "found") return "data";
  if (vinScanSourceLinkOnly(row.id)) return "link";
  if (row.status === "idle" || row.status === "checking") return "pending";
  if (EMPTY_STATUSES.has(row.status)) return "empty";
  return vinScanV4IsRealError(row) ? "error" : "empty";
}

/* ---------------- Saliktā saraksta rinda (26.11: bez dubultiem un jaukta teksta) ---------------- */

export type VinScanV4Notice = {
  /** Īss statuss labajā kolonnā: «nav atrasts» / «nav piemērojams» / «vajag numuru» / «kļūda». */
  status: string;
  /** Papildu skaidrojums zem nosaukuma (tikai ja tas nav tas pats, kas statuss). */
  detail: string;
  error: boolean;
  /** Sarkans, arī ja nav kļūda (piem. Austrija - vajag cilvēku). */
  risk: boolean;
};

const MAX_DETAIL = 140;

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > MAX_DETAIL ? `${t.slice(0, MAX_DETAIL - 1).trimEnd()}…` : t;
}

/**
 * Garais tehniskais teksts -> īss latviski. Piem. «CARFAX.eu: no pārlūka (from browser) · relejs: CARFAX.eu: pēc
 * reCAPTCHA atteikuma pauze līdz 21:09 - pārbaudi pārlūka joslā» -> «pauze līdz 21:09 (reCAPTCHA) - izmanto pārlūka joslu».
 */
export function vinScanV4ShortText(raw: string, label = ""): string {
  let t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const captcha = /captcha/i.test(t);
  const pause = /pauze līdz (\d{1,2}:\d{2})/i.exec(t);
  if (pause) return `pauze līdz ${pause[1]}${captcha ? " (reCAPTCHA)" : ""} - izmanto pārlūka joslu`;
  // «X: no pārlūka (from browser) · relejs: Y» -> Y (pārlūka josla ir noklusējums, to nerakstām).
  t = t.replace(/^[^·]*?no pārlūka \(from browser\)\s*(?:·\s*)?/i, "");
  t = t.replace(/\(from browser\)/gi, "").replace(/^relejs:\s*/i, "").replace(/\s*·\s*relejs:\s*/gi, " · ");
  // Avota nosaukums jau ir kreisajā kolonnā - «CARFAX.eu: …», «Chrome relejs: …» prefiksu noņemam.
  const first = (label.split(/[\s(·]/)[0] ?? "").trim().toLowerCase();
  for (let i = 0; i < 3; i += 1) {
    const m = /^([^\s:]{2,30}(?: [^\s:]{1,20})?):\s+/.exec(t);
    if (!m) break;
    const head = m[1]!.toLowerCase();
    const same = (first.length >= 3 && head.startsWith(first)) || /\.[a-z]{2,3}$/.test(head) || /relejs$/.test(head);
    if (!same) break;
    t = t.slice(m[0].length);
  }
  if (!t) return captcha ? "reCAPTCHA - izmanto pārlūka joslu" : "";
  return clip(t);
}

function needsStatus(text: string): string {
  if (/sludinājum/i.test(text)) return "vajag sludinājumu";
  if (/datum/i.test(text)) return "vajag datumu";
  if (/reģ\. ?nr|numur|plate/i.test(text)) return "vajag numuru";
  if (/\bVIN\b/.test(text)) return "vajag VIN";
  return "vajag datus";
}

/** Saliktā saraksta rinda: kreisajā nosaukums (+ īss skaidrojums zem), labajā īss statuss. Teksts vienreiz. */
export function vinScanV4Notice(row: VinScanV4RowLike): VinScanV4Notice {
  const label = row.label ?? "";
  const text = (row.note || row.summary || "").trim();
  if (vinScanV4IsRealError(row)) {
    const short = vinScanV4ShortText(row.status === "timeout" && !text ? "neatbildēja laikā" : text, label);
    return { status: "kļūda", detail: short || (row.status === "timeout" ? "neatbildēja laikā" : ""), error: true, risk: true };
  }
  const plain = (status: string, detail = ""): VinScanV4Notice => ({ status, detail, error: false, risk: false });
  switch (row.status) {
    case "none":
      return plain("nav atrasts", /pārbaudi saitē/i.test(text) ? "pārbaudi saitē" : "");
    case "skipped":
      return plain("nav piemērojams");
    case "needs_input":
      return plain(needsStatus(text));
    case "config_missing":
      return plain("nav iestatīts");
    case "manual":
      return plain("pārbaudi pats");
    case "unknown":
      // Safety Gate: marka nav starp jaunākajiem - nevar apgalvot «nav», bet tā nav kļūda.
      return plain("nav atrasts", "pārbaudi saitē");
    case "browser_only":
      if (/var neattiekties|attiecas tikai/i.test(text)) return plain("nav piemērojams");
      if (/lapa bez šī VIN/i.test(text)) return plain("nav atrasts");
      if (/no pārlūka|from browser/i.test(text)) return plain("pārlūka joslā");
      return plain("pārbaudi pārlūkā");
    default:
      return plain("nav datu");
  }
}

export type VinScanV4Group<T> = { id: VinScanV4BlockId; label: string; items: T[] };

export type VinScanV4Layout<T> = {
  /** CSDD rinda (VIN SCAN «csdd» avots), ja ir dati. */
  csdd: T | null;
  /** Bloki Nila secībā; tukšie bloki izlaisti. Bloka iekšā - kategoriju secība. */
  groups: VinScanV4Group<T>[];
  empty: T[];
  errors: T[];
  pending: T[];
  /** Avoti, kas ir tikai saite (netiek skaitīti statusā). */
  links: T[];
  /** Statusa rinda: ar datiem / visi (bez tikai-saitēm). */
  counted: number;
  withData: number;
  done: number;
};

export function buildVinScanV4Layout<T extends VinScanV4RowLike>(rows: readonly T[]): VinScanV4Layout<T> {
  const buckets = new Map<VinScanV4BlockId, T[]>();
  const empty: T[] = [];
  const errors: T[] = [];
  const pending: T[] = [];
  const links: T[] = [];
  let csdd: T | null = null;
  let counted = 0;
  let withData = 0;
  let done = 0;
  for (const row of rows) {
    const block = vinScanV4BlockOf(row.id);
    if (!block) continue;
    const kind = vinScanV4Kind(row);
    if (kind === "link") {
      links.push(row);
      continue;
    }
    counted += 1;
    if (kind !== "pending") done += 1;
    if (kind === "pending") pending.push(row);
    else if (kind === "empty") empty.push(row);
    else if (kind === "error") errors.push(row);
    else {
      withData += 1;
      if (block === "csdd") {
        csdd = row;
        continue;
      }
      const list = buckets.get(block) ?? [];
      list.push(row);
      buckets.set(block, list);
    }
  }
  const groups = VIN_SCAN_V4_BLOCKS.flatMap((b) => {
    const items = buckets.get(b.id);
    if (!items?.length) return [];
    // Bloka iekšā - avotu kategoriju secība (#1259), kategorijas iekšā - ievades secība.
    const ordered = groupVinScanByCategory(items).flatMap((g) => g.items);
    return [{ id: b.id, label: b.label, items: ordered }];
  });
  return { csdd, groups, empty, errors, pending, links, counted, withData, done };
}

/** «Ar datiem 9 no 26» / «Lasa 12 no 26». */
export function vinScanV4StatusLine(layout: Pick<VinScanV4Layout<unknown>, "counted" | "withData" | "done">, busy: boolean): string {
  if (!layout.counted) return "";
  if (busy && layout.done < layout.counted) return `Lasa ${layout.done} no ${layout.counted}`;
  return `Ar datiem ${layout.withData} no ${layout.counted}`;
}

/* ---------------- «Uzmanību» ---------------- */

export type VinScanV4Flag = { text: string; source: string };

/** Sarkanie karogi no faktiem (tikai augstas ticamības: km kritums, meklēšana, negadījumi, totāla bojāeja, atsaukumi). */
export function buildVinScanV4Attention(facts: AtraFacts | null, extra: readonly VinScanV4Flag[] = []): VinScanV4Flag[] {
  if (!facts) return [...extra];
  const out: VinScanV4Flag[] = [];
  const drop = facts.mileage.drop;
  if (drop) {
    out.push({
      text: `Nobraukuma kritums -${formatKmLv(drop.km)} km`,
      source: [lvDateFromSortable(drop.to.date), drop.to.source].filter(Boolean).join(" · "),
    });
  }
  if (facts.wanted.length) out.push({ text: "Meklēšanā / zagts", source: facts.wanted.join(" · ") });
  // 26.11: ķīla / parāds ir apgrūtinājums, ne negadījums - atsevišķs karogs.
  if (facts.liens?.length) out.push({ text: "Ķīla / parāds", source: facts.liens.join(" · ") });
  if (facts.flags.totalLoss) out.push({ text: "Totāla bojāeja (total loss)", source: "izsoļu / vēstures dati" });
  if (facts.incidents.count) {
    out.push({
      text: `Negadījumi / bojājumi: ${facts.incidents.count}`,
      source: facts.incidents.sources.join(" · "),
    });
  }
  if (facts.recalls.count) {
    out.push({ text: `Atsaukumi: ${facts.recalls.count}`, source: facts.recalls.sources.join(" · ") });
  }
  if (facts.listing.kmDeviates) out.push({ text: "Sludinājuma km mazāks par zināmo", source: "Sludinājuma vēsture" });
  return [...out, ...extra];
}

function lvDateFromSortable(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
}

export function formatKmLv(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** VIN SCAN Smart-ID releju atsauce (e.csdd / LTAB) bez pasūtījuma: `vs_<vin>`. */
export function vinScanRelayRef(vin: string): string {
  return `vs_${vin.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

const VS_REF_RE = /^vs_([a-hj-npr-z0-9]{17})$/;

/** `vs_…` ref -> VIN (lielajiem burtiem); citādi null (tas ir pasūtījums vai ātrais vērtējums). */
export function vinScanVinFromRelayRef(ref: string): string | null {
  const m = VS_REF_RE.exec(ref.trim());
  return m ? m[1]!.toUpperCase() : null;
}

/* ---------------- Nobraukuma tabula ---------------- */

export type VinScanV4MileageRow = {
  /** «24.02.2026». */
  date: string;
  km: number;
  /** Starpība pret iepriekšējo (vecāko) rādījumu; pirmajam `null`. */
  diff: number | null;
  source: string;
  country: string;
  /** Rādījums mazāks par iepriekšējo maksimumu (kritums). */
  drop: boolean;
};

/**
 * Visi nobraukuma rādījumi no visiem avotiem (Nils 26.11: «man vajag redzēt visus, nevis tikai pēdējo»),
 * jaunākais augšā. Starpība pret iepriekšējo hronoloģisko rādījumu; kritums pret iepriekšējo maksimumu - sarkans.
 */
export function vinScanV4MileageRows(points: AtraFacts["mileage"]["points"]): VinScanV4MileageRow[] {
  const asc = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.km - b.km));
  let max = 0;
  const out: VinScanV4MileageRow[] = asc.map((p, i) => {
    const prev = i > 0 ? asc[i - 1]! : null;
    const drop = max > 0 && p.km < max;
    max = Math.max(max, p.km);
    return { date: lvDateFromSortable(p.date), km: p.km, diff: prev ? p.km - prev.km : null, source: p.source, country: p.country, drop };
  });
  return out.reverse();
}

/** «489 009 km · 24.02.2026 · e.csdd»; bez datiem - tukšs (UI rāda sarkanu «nav datu», nekad «- km»). */
export function vinScanV4LastOdometerLine(last: AtraFacts["mileage"]["last"]): string {
  if (!last || !(last.km > 0)) return "";
  return [`${formatKmLv(last.km)} km`, lvDateFromSortable(last.date), last.source].filter(Boolean).join(" · ");
}

/* ---------------- LTAB un CSDD konsekvence ---------------- */

/** LTAB izlaišanas teksti, kas apgalvo, ka auto nav LV (sk. `LTAB_SKIP_REASON_LV`). */
const LTAB_NOT_LV_RE = /nav\s+re[gģ]istr[eē]ts\s+latvij|nav\s+latvijas\s+numurz|nav\s+lv\s+numur/i;

export type VinScanV4CsddRegistration = {
  /** CSDD API (1. solis) numurzīme. */
  apiPlate?: string;
  /** e.csdd (2. solis): `true` - «Uzskaitē»; `false` - noņemts / izvests. */
  ecsddRegistered?: boolean | null;
  ecsddPlate?: string;
};

/** Vai CSDD (API vai e.csdd) apstiprina LV reģistrāciju. Noņemts no uzskaites e.csdd tekstā - nē. */
export function vinScanV4CsddRegisteredLv(r: VinScanV4CsddRegistration): { registered: boolean; plate: string } {
  if (r.ecsddRegistered === false) return { registered: false, plate: "" };
  const plate = (r.apiPlate || r.ecsddPlate || "").trim();
  return { registered: Boolean(plate) || r.ecsddRegistered === true, plate };
}

/**
 * Konsekvences noteikums (26.11, «LTAB ir pretruna!»): ja CSDD saka «reģistrēts LV», neviens cits avots
 * nedrīkst rādīt «nav reģistrēts Latvijā». Atgriež aizvietojošo tekstu vai `null`, ja pretrunas nav.
 */
export function vinScanV4LtabContradiction(
  ltabMessage: string | null | undefined,
  reg: VinScanV4CsddRegistration,
): string | null {
  const msg = String(ltabMessage ?? "");
  if (!LTAB_NOT_LV_RE.test(msg)) return null;
  const r = vinScanV4CsddRegisteredLv(reg);
  if (!r.registered) return null;
  return `CSDD: reģistrēts Latvijā${r.plate ? ` (${r.plate})` : ""} - LTAB vēl nav pārbaudīts, spied «Atkārtot»`;
}

/* ---------------- Transportlīdzekļa nosaukums ---------------- */

const V4_VEHICLE_RANK = ["csdd", "tjekbil", "rdw", "vegvesen", "carinfo", "cz_rsv", "dvsa_mot", "carfax_eu", "esyn", "biluppgifter", "plc_auction"];

type V4VehicleRow = VinScanV4RowLike & { vehicle?: { make?: string; model?: string; year?: string } };

/**
 * 27.11 (Nils): nekad tikai «Auto», ja kāds avots marku zina. Reģistri pirms citiem; WMI / vPIC (`vin_decode`)
 * pēdējais - tikai marka («Renault · Ražots: Francija» -> «Renault»). Gads, ja zināms. Nav nekā - tukšs.
 */
export function vinScanV4VehicleTitle(rows: readonly V4VehicleRow[]): string {
  const found = rows.filter((r) => r.status === "found");
  const name = (r: V4VehicleRow) => [r.vehicle?.make, r.vehicle?.model].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
  const rank = (id: string) => {
    const i = V4_VEHICLE_RANK.indexOf(id);
    return i < 0 ? V4_VEHICLE_RANK.length + (id === "vin_decode" ? 1 : 0) : i;
  };
  const ranked = found.filter((r) => name(r)).sort((a, b) => rank(a.id) - rank(b.id));
  const year = found.map((r) => String(r.vehicle?.year ?? "").trim()).find((y) => /^(19|20)\d{2}$/.test(y)) ?? "";
  const best = ranked.find((r) => r.id !== "vin_decode" && r.vehicle?.make && r.vehicle?.model) ?? ranked[0];
  let title = best ? name(best) : "";
  if (!title) {
    const wmi = found.find((r) => r.id === "vin_decode");
    const head = String(wmi?.summary ?? "").split("·")[0]!.trim();
    if (head && !/ražot|nav |nezin/i.test(head) && head.length <= 40) title = head;
  }
  if (!title) return "";
  return year && !title.includes(year) ? `${title} · ${year}` : title;
}
