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
export type VinScanV4RowLike = { id: string; status: string; summary?: string };

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
const ERROR_STATUSES = new Set(["unknown", "blocked", "timeout", "browser_only", "error"]);

/** Kā rindu rādīt: ar datiem (blokā), tukša / kļūda (saliktajā sarakstā), vēl lasa, tikai saite. */
export function vinScanV4Kind(row: VinScanV4RowLike): VinScanV4Kind {
  if (row.status === "found") return "data";
  if (vinScanSourceLinkOnly(row.id)) return "link";
  if (row.status === "idle" || row.status === "checking") return "pending";
  if (EMPTY_STATUSES.has(row.status)) return "empty";
  if (ERROR_STATUSES.has(row.status)) return "error";
  return "empty";
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
