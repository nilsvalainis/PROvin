/**
 * «Ātrie vērtējumi» automātika (Nils 26.11): pēc pieteikuma bez maksas ievāc visu (CSDD, VIN SCAN, sludinājums,
 * izsoļu arhīvs, AutoDNA / CARFAX priekšskatījumi, e.csdd / LTAB, ja Smart-ID sesija jau ir), atrod sarkanos
 * karogus un pretrunas un sastāda «Ieteicams piedāvāt» sarakstu - katrs punkts pamatots ar faktu.
 *
 * Šeit tikai tīras funkcijas (bez tīkla) - testējamas. Izpilde: `lib/quick-eval-auto.ts`.
 * Nekādu pirkumu un nekādas sūtīšanas klientam; klienta piedāvājuma melnrakstu neveido (Nils 26.11).
 * Nils 26.11: «Ieteicams piedāvāt» tekstos NEKAD nav avotu nosaukumu (AutoDNA, CARFAX, carVertical, CSDD u.c.) -
 * tikai datu tips un skaits. Kartēšana avots -> datu tips paliek iekšēji (`id`). Cena - tikai mūsu produkta.
 * 25.11: nekāda «pirkt / nepirkt» verdikta un avotu skaita tekstos - tikai ieteikumi, klients lemj.
 */
import type { CsddFormFields, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { autodnaPurchaseGuardFromIndicator } from "@/lib/autodna-purchase-guard";
import { buildAtraPreviews } from "@/lib/atra-prieksskatijums";
import { TP5_DEALER_COVERAGE_TIERS, type DealerCoverageTierId } from "@/lib/dealer-brands";
import { AUDIT_PRICE_CENTS, DEALER_CATALOG_CENTS, formatEurFromCents } from "@/lib/order-upsell";
import type { ProvinAlertBanner } from "@/lib/provin-alert-banners";
import { formatSourceIssueLine, type SourceIssue } from "@/lib/source-consistency";
import { vinScanRowHasLien } from "@/lib/vin-scan/lien-flag";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { isManufactureCountrySource, vinScanRowRegistrationCountry } from "@/lib/vin-scan/row-country";

/** Tas pats VIN pēdējās 24 h jau skenēts - VIN SCAN otrreiz nepalaiž (izmanto momentuzņēmumu). */
export const QUICK_EVAL_SCAN_CACHE_MS = 24 * 60 * 60 * 1000;
/** «Apstrādā…» ilgāk par šo = palaišana nomira (Vercel taimauts) - kartītē «Kļūda + Atkārtot». */
export const QUICK_EVAL_AUTO_STALE_MS = 10 * 60 * 1000;
/** Smart-ID gaidīšana: vecākus pieteikumus fona darbs vairs neaiztiek. */
export const QUICK_EVAL_SMARTID_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export type QuickEvalAutoStepId =
  | "plate_vin"
  | "free_sources"
  | "vin_scan"
  | "auctions"
  | "previews"
  | "ecsdd"
  | "ltab"
  | "analysis";

export type QuickEvalAutoStepState = "ok" | "none" | "skipped" | "error" | "smartid_wait" | "running";

export type QuickEvalAutoStep = { state: QuickEvalAutoStepState; note?: string };

export type QuickEvalRedFlagSeverity = "red" | "yellow" | "info";

export type QuickEvalRedFlag = { severity: QuickEvalRedFlagSeverity; text: string };

export type QuickEvalRecommendationId = "autodna" | "carfax" | "carvertical" | "csdd_sms" | "dealer";

export type QuickEvalOfferProduct = "audits" | "dealer";

export type QuickEvalRecommendation = {
  /** Tikai iekšēji (kurš avots dod šo datu tipu) - UI un tekstos nerāda. */
  id: QuickEvalRecommendationId;
  /** Datu tips un skaits bez avota nosaukuma, piem. «Pieejama papildu vēsture: 16 ieraksti, 67 arhīva fotogrāfijas». */
  text: string;
  /** Kurā PROVIN produktā avots ietilpst (cena no `order-upsell` konfigurācijas). */
  product: QuickEvalOfferProduct;
};

export type QuickEvalAutoState = "running" | "ready" | "error";

export type QuickEvalAutoStatus = {
  state: QuickEvalAutoState;
  /** VIN vai LV numurzīme, ar ko palaists (slēdzenes atslēgas daļa). */
  key: string;
  vin?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** VIN SCAN rezultāts paņemts no pēdējo 24 h momentuzņēmuma. */
  cacheHit?: boolean;
  steps: Partial<Record<QuickEvalAutoStepId, QuickEvalAutoStep>>;
  flags: QuickEvalRedFlag[];
  recommendations: QuickEvalRecommendation[];
};

const STATES: readonly QuickEvalAutoState[] = ["running", "ready", "error"];
const STEP_IDS: readonly QuickEvalAutoStepId[] = [
  "plate_vin",
  "free_sources",
  "vin_scan",
  "auctions",
  "previews",
  "ecsdd",
  "ltab",
  "analysis",
];
const STEP_STATES: readonly QuickEvalAutoStepState[] = ["ok", "none", "skipped", "error", "smartid_wait", "running"];
const REC_IDS: readonly QuickEvalRecommendationId[] = ["autodna", "carfax", "carvertical", "csdd_sms", "dealer"];

function str(v: unknown, max = 400): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function parseQuickEvalAutoStatus(raw: unknown): QuickEvalAutoStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  if (!state) return null;
  const steps: QuickEvalAutoStatus["steps"] = {};
  if (o.steps && typeof o.steps === "object") {
    for (const id of STEP_IDS) {
      const s = (o.steps as Record<string, unknown>)[id] as Record<string, unknown> | undefined;
      const st = STEP_STATES.find((x) => x === s?.state);
      if (st) steps[id] = { state: st, ...(str(s?.note) ? { note: str(s?.note) } : {}) };
    }
  }
  const flags = Array.isArray(o.flags)
    ? o.flags
        .map((f) => f as Record<string, unknown>)
        .filter((f) => (f.severity === "red" || f.severity === "yellow" || f.severity === "info") && str(f.text))
        .map((f) => ({ severity: f.severity as QuickEvalRedFlagSeverity, text: str(f.text, 600)! }))
    : [];
  const recommendations = Array.isArray(o.recommendations)
    ? o.recommendations
        .map((r) => r as Record<string, unknown>)
        .filter((r) => REC_IDS.includes(r.id as QuickEvalRecommendationId) && str(r.text))
        .map((r) => ({
          id: r.id as QuickEvalRecommendationId,
          text: str(r.text, 600)!,
          product: (r.product === "dealer" ? "dealer" : "audits") as QuickEvalOfferProduct,
        }))
    : [];
  return {
    state,
    key: str(o.key, 40) ?? "",
    startedAt: str(o.startedAt, 40) ?? new Date(0).toISOString(),
    steps,
    flags,
    recommendations,
    ...(str(o.vin, 20) ? { vin: str(o.vin, 20) } : {}),
    ...(str(o.finishedAt, 40) ? { finishedAt: str(o.finishedAt, 40) } : {}),
    ...(str(o.error) ? { error: str(o.error) } : {}),
    ...(o.cacheHit === true ? { cacheHit: true } : {}),
  };
}

/** Idempotences atslēga (tā pati Blob dedupe krātuve kā #1225): viena palaišana pieteikumam + VIN/numuram. */
export function quickEvalAutoLockKey(peekId: string, vinOrPlate: string, retry?: string): string {
  const base = `qe-auto_${peekId.trim()}_${vinOrPlate.trim().toUpperCase()}${retry ? `_r${retry}` : ""}`;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/** «Atkārtot» dubultklikšķis tajā pašā minūtē paliek viena palaišana. */
export function quickEvalAutoRetryBucket(nowMs: number): string {
  return String(Math.floor(nowMs / 60_000));
}

/** Vai momentuzņēmums ir pietiekami svaigs, lai VIN SCAN nepalaistu vēlreiz. */
export function isQuickEvalScanFresh(scannedAt: string | null | undefined, nowMs: number): boolean {
  const t = Date.parse(scannedAt ?? "");
  return Number.isFinite(t) && nowMs - t >= 0 && nowMs - t < QUICK_EVAL_SCAN_CACHE_MS;
}

/**
 * Momentuzņēmumu var izmantot VIN SCAN vietā, ja tas ir < 24 h vecs un tajā ir visi noklusējuma avoti
 * (cita «Ātrās pārbaudes» daļēja skenēšana nedrīkst aizstāt pilno).
 */
export function quickEvalScanCacheUsable(
  snapshot: { scannedAt: string; indicators: readonly { id: string }[] } | null | undefined,
  requiredIds: readonly string[],
  nowMs: number,
): boolean {
  if (!snapshot || !isQuickEvalScanFresh(snapshot.scannedAt, nowMs)) return false;
  const have = new Set(snapshot.indicators.map((r) => r.id));
  return requiredIds.every((id) => have.has(id));
}

export type QuickEvalAutoView = "none" | "running" | "ready" | "error";

/** Kartītes stāvoklis: iestrēdzis «running» (taimauts) = kļūda ar «Atkārtot». */
export function quickEvalAutoView(status: QuickEvalAutoStatus | null | undefined, nowMs: number): QuickEvalAutoView {
  if (!status) return "none";
  if (status.state === "running") {
    const t = Date.parse(status.startedAt);
    return Number.isFinite(t) && nowMs - t > QUICK_EVAL_AUTO_STALE_MS ? "error" : "running";
  }
  return status.state;
}

/** Vai palaišana jau notiek (cits izsaukums) - otru nesākam. */
export function quickEvalAutoInFlight(status: QuickEvalAutoStatus | null | undefined, nowMs: number): boolean {
  return quickEvalAutoView(status, nowMs) === "running";
}

// ── e.csdd / LTAB releja ref ātrajam vērtējumam ─────────────────────────

const QE_REF_RE = /^qe_([0-9a-f]{8})_([0-9a-f]{4})_([0-9a-f]{4})_([0-9a-f]{4})_([0-9a-f]{12})$/;

/** Releja `ref` (tikai [A-Za-z0-9_], kā pasūtījuma sessionId) ātrā vērtējuma statusa failam. */
export function quickEvalRelayRef(peekId: string): string {
  return `qe_${peekId.trim().toLowerCase().replace(/-/g, "_")}`;
}

/** `qe_…` ref -> pieteikuma id; citādi null (tas ir pasūtījums). */
export function quickEvalPeekIdFromRelayRef(ref: string): string | null {
  const m = QE_REF_RE.exec(ref.trim());
  return m ? m.slice(1, 6).join("-") : null;
}

// ── Sarkanie karogi ──────────────────────────────────────────────────

/** Vinjete u.c. informatīvi baneri nav sarkanie karogi. */
const BANNER_SKIP = new Set(["vignette"]);

function pushUnique(out: QuickEvalRedFlag[], flag: QuickEvalRedFlag) {
  if (!out.some((f) => f.text === flag.text)) out.push(flag);
}

export function buildQuickEvalRedFlags(args: {
  issues: readonly SourceIssue[];
  banners: readonly ProvinAlertBanner[];
  indicators: readonly VinScanIndicator[];
}): QuickEvalRedFlag[] {
  const out: QuickEvalRedFlag[] = [];
  for (const row of args.indicators) {
    if (row.status !== "found") continue;
    if (row.flags?.stolen) pushUnique(out, { severity: "red", text: `${row.label}: auto atzīmēts kā zagts` });
    else if (row.flags?.wanted) pushUnique(out, { severity: "red", text: `${row.label}: auto meklēšanā` });
    // 26.11: Bilbogen ķīla / parāds - sarkanais karogs, bet ne negadījums.
    if (vinScanRowHasLien(row)) pushUnique(out, { severity: "red", text: `${row.label}: reģistrēta ķīla / parāds` });
  }
  for (const issue of args.issues) {
    if (issue.severity === "info") continue;
    pushUnique(out, { severity: issue.severity === "critical" ? "red" : "yellow", text: formatSourceIssueLine(issue) });
  }
  for (const b of args.banners) {
    if (BANNER_SKIP.has(b.kind)) continue;
    pushUnique(out, { severity: b.severity, text: b.text });
  }
  for (const row of args.indicators) {
    if (row.status !== "found") continue;
    const recalls = row.flags?.recallCount ?? row.recalls?.length ?? 0;
    if (recalls > 0) pushUnique(out, { severity: "yellow", text: `${row.label}: atsaukumi ${recalls}` });
  }
  const countries = vehicleCountries(args.indicators);
  if (countries.length >= 2) pushUnique(out, { severity: "info", text: `Vēsture vairākās valstīs: ${countries.join(", ")}` });
  const order: Record<QuickEvalRedFlagSeverity, number> = { red: 0, yellow: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Valstis no VIN SCAN rindām (CARFAX.eu sadalījums, reģistri ar atrastu ierakstu). */
export function vehicleCountries(indicators: readonly VinScanIndicator[]): string[] {
  const set = new Set<string>();
  for (const row of indicators) {
    if (row.status !== "found") continue;
    // 26.11: WMI ražotājvalsts nav valsts, kur auto bijis (ne sarkanajiem karogiem, ne piedāvājumam).
    if (isManufactureCountrySource(row.id)) continue;
    for (const c of row.flags?.countries ?? []) if (/^[A-Z]{2}$/.test(c)) set.add(c);
    const reg = vinScanRowRegistrationCountry(row);
    if (reg && /^[A-Z]{2}$/.test(reg)) set.add(reg);
  }
  return [...set].sort();
}

// ── «Ieteicams piedāvāt» ─────────────────────────────────────────────

/** Mūsu produkta nosaukums un cena (no `order-upsell` konfigurācijas) - vienīgā cena, ko rāda. */
export function quickEvalProductPriceLabel(product: QuickEvalOfferProduct): string {
  return product === "dealer"
    ? `Dīlera dati ${formatEurFromCents(DEALER_CATALOG_CENTS)}`
    : `PROVIN AUDITS ${formatEurFromCents(AUDIT_PRICE_CENTS)}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`;
}

/** Avotu nosaukumi, kas nekad nedrīkst parādīties «Ieteicams piedāvāt» tekstā (tests to pārbauda). */
export const QUICK_EVAL_SOURCE_NAME_RE = /autodna|carfax|car\s*vertical|csdd|e\.csdd|thecarapi|ltab|copart|iaai|bid\.?cars|checkcar|tjekbil|mnt\.ee|carinfo|oneauto|joj/i;

/** Dīleru vēsture: pilna vai darbnīcu piezīmes (ierobežotās markas neiesakām). */
export function dealerCoverageForMake(makeModel: string | null | undefined): { brand: string; tier: DealerCoverageTierId } | null {
  const norm = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hay = ` ${norm(String(makeModel ?? ""))} `;
  if (!hay.trim()) return null;
  for (const tier of TP5_DEALER_COVERAGE_TIERS) {
    if (tier.id === "limited") continue;
    // Garākie nosaukumi pirmie («Land Rover» pirms citiem, «Mercedes-Benz» arī kā «Mercedes»).
    const brands = [...tier.brands].sort((a, b) => b.length - a.length);
    for (const brand of brands) {
      const n = norm(brand);
      const alt = n === "mercedes benz" ? [n, "mercedes"] : n === "volkswagen" ? [n, "vw"] : [n];
      if (alt.some((a) => hay.includes(` ${a} `))) return { brand, tier: tier.id };
    }
  }
  return null;
}

const MILEAGE_ISSUE_KINDS = new Set<SourceIssue["kind"]>(["mileage_drop", "mileage_same_day"]);

function isMileageIssue(i: SourceIssue): boolean {
  return i.severity !== "info" && (MILEAGE_ISSUE_KINDS.has(i.kind) || i.id === "listing_claim_km_below_recorded");
}

function csddMileageCount(csdd: Partial<CsddFormFields> | null | undefined): number {
  return (csdd?.mileageHistory ?? []).filter((r) => String(r?.odometer ?? "").trim() && String(r?.date ?? "").trim()).length;
}

export type QuickEvalRecommendationInput = {
  vin: string;
  indicators: readonly VinScanIndicator[];
  issues: readonly SourceIssue[];
  banners: readonly ProvinAlertBanner[];
  blocks: WorkspaceSourceBlocks;
  /** e.csdd stāvoklis šim pieteikumam: «ok» = dati ielasīti. */
  ecsddState?: QuickEvalAutoStepState;
  /** Izsoļu ieraksti no VIN SCAN / TheCarApi (pārdošanas + bojājumi). */
  auctionSales: number;
  nowMs?: number;
};

/**
 * Ko klientam var piedāvāt - tikai ar faktu no priekšskata vai bezmaksas avota; tekstā datu tips un skaits,
 * nekad avota nosaukums. Bez fakta punkta nav (nekādu «pēc noklusējuma» ieteikumu).
 */
export function buildQuickEvalRecommendations(input: QuickEvalRecommendationInput): QuickEvalRecommendation[] {
  const out: QuickEvalRecommendation[] = [];
  const byId = new Map(input.indicators.map((r) => [r.id, r]));
  const add = (id: QuickEvalRecommendationId, text: string, product: QuickEvalOfferProduct = "audits") => {
    if (!out.some((r) => r.text === text)) out.push({ id, text, product });
  };

  // Vēstures ieraksti / arhīva foto: tikai, ja priekšpārbaudē tie ir (Nila likums 25.11).
  const dna = autodnaPurchaseGuardFromIndicator(byId.get("autodna_precheck"), { nowMs: input.nowMs });
  if (dna?.allowed) {
    const parts = [
      (dna.history ?? 0) > 0 ? plural(dna.history!, "ieraksts", "ieraksti") : "",
      (dna.photos ?? 0) > 0 ? plural(dna.photos!, "arhīva fotogrāfija", "arhīva fotogrāfijas") : "",
    ].filter(Boolean);
    if (parts.length) add("autodna", `Pieejama papildu vēsture: ${parts.join(", ")}`);
  }

  // Ārvalstu vēsture: priekšskatā ir ieraksti (valstis, nobraukums, apskates).
  const carfaxRow = byId.get("carfax_eu");
  if (carfaxRow?.status === "found") {
    const preview = buildAtraPreviews(input.vin, [
      { id: "carfax_eu", status: carfaxRow.status, summary: carfaxRow.summary, detail: carfaxRow.detail, openUrl: carfaxRow.openUrl ?? "" },
    ])[0];
    const item = (label: string) => preview?.items.find((i) => i.label === label)?.value ?? "";
    const codes = [
      ...new Set([...(item("Valstis").match(/\b[A-Z]{2}\b/g) ?? []), ...(carfaxRow.flags?.countries ?? [])]),
    ].filter((c) => /^[A-Z]{2}$/.test(c));
    const num = (v: string) => Number(/\d+/.exec(v)?.[0] ?? NaN);
    const km = num(item("Nobraukums"));
    const insp = num(item("Apskates"));
    const records = Number(/(\d+)\s*ierakst/i.exec(carfaxRow.summary)?.[1] ?? NaN);
    const parts = [
      Number.isFinite(km) && km > 0 ? plural(km, "nobraukuma ieraksts", "nobraukuma ieraksti") : "",
      Number.isFinite(insp) && insp > 0 ? plural(insp, "tehniskā apskate", "tehniskās apskates") : "",
    ].filter(Boolean);
    if (codes.length || parts.length || (Number.isFinite(records) && records > 0)) {
      const head = codes.length ? `Vēstures ieraksti no ārvalstīm (${codes.join(", ")})` : "Ārvalstu vēstures ieraksti";
      const tail = parts.length ? parts.join(", ") : Number.isFinite(records) && records > 0 ? plural(records, "ieraksts", "ieraksti") : "";
      add("carfax", tail ? `${head}: ${tail}` : head);
    }
  }

  // Izsoļu / bojājumu vēsture vai vēsture vairākās valstīs.
  const countries = vehicleCountries(input.indicators);
  if (input.auctionSales > 0) add("carvertical", `Izsoļu vēsture: ${plural(input.auctionSales, "ieraksts", "ieraksti")}`);
  else if (countries.length >= 2) add("carvertical", `Vēsture vairākās valstīs (${countries.join(", ")})`);

  // Oficiālā reģistra izziņa: nobraukuma pretruna vai reģistra nobraukuma dati nepilnīgi (tikai LV auto).
  const lvPlate = String(input.blocks.csdd.registrationNumber ?? "").trim();
  const mileageIssue = input.issues.find(isMileageIssue);
  const odometerBanner = input.banners.find((b) => b.kind === "odometer");
  if (lvPlate) {
    if (mileageIssue || odometerBanner) add("csdd_sms", "Nobraukuma pretrunu var precizēt ar oficiālo reģistra izziņu");
    else if (input.ecsddState !== "ok" && csddMileageCount(input.blocks.csdd) === 0) {
      add("csdd_sms", "Nobraukuma vēsturi var precizēt ar oficiālo reģistra izziņu");
    }
  }

  // Ražotāja servisa vēsture: marka atbalstīta.
  const dealer = dealerCoverageForMake(input.blocks.csdd.makeModel || byId.get("vin_decode")?.vehicle?.make);
  if (dealer) add("dealer", dealer.tier === "full" ? "Servisa vēsture no ražotāja" : "Ražotāja darbnīcu piezīmes", "dealer");
  return out;
}
