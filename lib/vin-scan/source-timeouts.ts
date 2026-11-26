import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

const SLOW_SOURCES = new Set<VinScanSourceId>([
  "mnt_ee",
  "lkf_ee",
  "carinfo",
  "regitra",
  "traficom",
  "biluppgifter",
  "listing_history",
]);
const SLOW_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 14_000;
const CAPTCHA_TIMEOUT_MS = 90_000;
/**
 * Hetzner Chrome `/listings/page`: palaišana + Cloudflare izaicinājuma gaidīšana un atkārtojums.
 * Pašlaik neviens VIN SCAN avots to neizmanto (izsoļu avoti ir tikai pārlūkā); atstāts releja klientiem.
 */
export const VIN_SCAN_RELAY_PAGE_TIMEOUT_MS = 100_000;

/**
 * esyn un dsb veic 2-3 secīgus HTTP pieprasījumus (katrs līdz 12 s), tāpēc 14 s nepietiek.
 */
const MULTI_STEP_TIMEOUT_MS = 25_000;
const MULTI_STEP_SOURCES = new Set<VinScanSourceId>(["esyn", "dsb"]);

/**
 * mnt_ee iet caur releju ar `MNT_RELAY_TIMEOUT_MS` (100 s). Ārējam limitam jābūt lielākam,
 * lai operators redz releja īsto iemeslu, nevis "Avots neatbildēja laikā".
 */
const MNT_EE_TIMEOUT_MS = 105_000;

/**
 * TheCarApi: vēsture + detaļas + bildes + galerija. Ar 15 s VIN ar izsolēm vienmēr beidzās ar
 * „Avots neatbildēja laikā” (tieši tie, kuros ir dati). Zonde pati apstājas pirms šī termiņa.
 */
const THECARAPI_TIMEOUT_MS = 45_000;
const THECARAPI_SOURCES = new Set<VinScanSourceId>(["thecarapi_eu"]);

/**
 * stat_vin, checkcar_vin, plc_auction, bidfax, poctra un nicb tagad ir tikai
 * pārlūka avoti: zonde atgriež `browser_only` uzreiz bez tīkla, tāpēc tiem pietiek ar noklusējumu.
 */
const CAPTCHA_SOURCES = new Set<VinScanSourceId>([
  "lkf_ee",
  "carinfo",
  "nummerplade",
  "carpass",
]);

/**
 * bid.cars un CARFAX.eu iet caur releja Chrome (`/listings/vinsource`, ≤40 s + rinda).
 * Ārējam limitam jābūt lielākam par releja klienta 47 s, lai redz īsto iemeslu.
 */
const VINSOURCE_RELAY_SOURCES = new Set<VinScanSourceId>(["bid_cars", "carfax_eu"]);
const VINSOURCE_RELAY_TIMEOUT_MS = 50_000;

/** AutoDNA priekšskatījums: ~0,5 MB lapa; ar Turnstile (ja ieslēgts) + gaidīšana līdz ~36 s. */
const AUTODNA_PRECHECK_TIMEOUT_MS = 60_000;

export function vinScanSourceTimeoutMs(id: VinScanSourceId): number {
  if (id === "autodna_precheck") return AUTODNA_PRECHECK_TIMEOUT_MS;
  if (THECARAPI_SOURCES.has(id)) return THECARAPI_TIMEOUT_MS;
  if (VINSOURCE_RELAY_SOURCES.has(id)) return VINSOURCE_RELAY_TIMEOUT_MS;
  if (id === "mnt_ee") return MNT_EE_TIMEOUT_MS;
  if (MULTI_STEP_SOURCES.has(id)) return MULTI_STEP_TIMEOUT_MS;
  if (CAPTCHA_SOURCES.has(id)) return CAPTCHA_TIMEOUT_MS;
  if (SLOW_SOURCES.has(id)) return SLOW_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

/** CapSolver jābeidzas pirms avota ārējā timeout, lai pēc noildzes nepaliktu maksas poll. */
export const CAPSOLVER_TIMEOUT_MARGIN_MS = 8_000;
export const CAPSOLVER_MIN_TIMEOUT_MS = 4_000;

export function capsolverTimeoutMs(outerTimeoutMs: number, elapsedMs = 0): number {
  if (!Number.isFinite(outerTimeoutMs) || outerTimeoutMs <= 0) return 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.max(0, Math.floor(outerTimeoutMs - elapsed - CAPSOLVER_TIMEOUT_MARGIN_MS));
}

export function capsolverMayStart(outerTimeoutMs: number, elapsedMs = 0): boolean {
  return capsolverTimeoutMs(outerTimeoutMs, elapsedMs) >= CAPSOLVER_MIN_TIMEOUT_MS;
}
