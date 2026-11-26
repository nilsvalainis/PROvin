/**
 * Automātika pēc apmaksas (25.11, FLASH MAX audita P1): VIN SCAN pēc CSDD (ar LV numurzīmi un 1. reģ.
 * datumu), automātisks bezmaksas datu imports blokos un viena push ziņa Nilam ar AutoDNA / CARFAX
 * priekšskatījumu skaitiem pirkuma lēmumam.
 *
 * Šeit tikai tīras funkcijas (bez tīkla, bez server-only) - testējamas. Izpilde: `lib/order-auto-intake.ts`.
 * Nekādu pirkumu: maksas avoti (AutoDNA / CarVertical / CARFAX / OneAuto / JoJ) paliek tikai ar Nila klikšķi.
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import type { CsddFormFields, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { kfzExactDateDdMmYyyy } from "@/lib/kfzgutachten/kfzgutachten";
import { applyVinScanAuctionsToCcVin } from "@/lib/order-vin-scan";
import { applyVinScanCsddToBlock, applyVinScanListingToBlock } from "@/lib/order-vin-scan-apply";
import { emptyVinScanPlates, isValidScanPlate, normalizeScanPlate, type VinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

/** Vercel funkcijas griesti (webhook un fona maršruts): `maxDuration = 300`. */
export const ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS = 300_000;
/** Rezerve saglabāšanai un žurnālam pirms Vercel aptur funkciju. */
export const ORDER_AUTO_INTAKE_SAFETY_MS = 25_000;
/**
 * Cik laika vajag VIN SCAN (lēnākā zonde ~105 s, mnt.ee) + importam blokos + foto. Ja webhook pēc CSDD
 * sēklas paliek mazāk - darbu atliek fona maršrutā ar savu 300 s budžetu (kā dīlera fona darbs).
 */
export const ORDER_AUTO_INTAKE_INLINE_MIN_MS = 150_000;
/** Mazāk par šo līdz termiņam - foto un TheCarApi galeriju vairs nesāk (bloki jau saglabāti). */
export const ORDER_AUTO_INTAKE_PHOTO_MIN_MS = 40_000;

/** Idempotences atslēga (Stripe dedupe krātuvē): viena automātikas palaišana pasūtījumam + VIN. */
export function orderAutoIntakeLockKey(sessionId: string, vin: string): string {
  return `auto-intake_${sessionId.trim()}_${vin.trim().toUpperCase()}`.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export type OrderAutoIntakeMode = "inline" | "background";

/** Webhook: vai pēc CSDD sēklas pietiek laika palikt šajā izsaukumā. */
export function decideOrderAutoIntakeMode(input: {
  elapsedMs: number;
  canDispatch: boolean;
  budgetMs?: number;
}): OrderAutoIntakeMode {
  const budget = input.budgetMs ?? ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS;
  const remaining = budget - ORDER_AUTO_INTAKE_SAFETY_MS - Math.max(0, input.elapsedMs);
  if (remaining >= ORDER_AUTO_INTAKE_INLINE_MIN_MS) return "inline";
  return input.canDispatch ? "background" : "inline";
}

export type OrderAutoIntakeScanInput = {
  plates: VinScanPlates;
  /** DD.MM.YYYY (kfzgutachten.at) vai tukšs. */
  firstRegDate: string;
};

/** No CSDD bloka (aizpildīts sēklā): LV numurzīme un precīzs 1. reģistrācijas datums VIN SCAN avotiem. */
export function orderAutoIntakeScanInputFromCsdd(csdd: Partial<CsddFormFields> | null | undefined): OrderAutoIntakeScanInput {
  const plates = emptyVinScanPlates();
  const lv = normalizeScanPlate(String(csdd?.registrationNumber ?? ""));
  if (isValidScanPlate("lv", lv)) plates.lv = lv;
  return { plates, firstRegDate: kfzExactDateDdMmYyyy(String(csdd?.firstRegistration ?? "")) };
}

export type VinScanBlockImport = {
  blocks: WorkspaceSourceBlocks;
  changed: boolean;
  /** Izsoļu pārdošanas / bojājumu rindas cc_vin blokā no VIN SCAN. */
  sales: number;
  damages: number;
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Tas pats, ko pasūtījumā dara pogas «Importēt» (izsoles -> Izsoļu portālu arhīvs, CSDD, sludinājums).
 * Operatora ievadīto nepārraksta (apply* funkcijas aizpilda tikai tukšo). Tikai atrastās rindas.
 */
export function applyVinScanImportsToBlocks(
  blocks: WorkspaceSourceBlocks,
  indicators: readonly VinScanIndicator[],
): VinScanBlockImport {
  let next = blocks;
  let sales = 0;
  let damages = 0;
  const auctionRows = indicators.filter((row) => row.status === "found" && (row.auctions?.length ?? 0) > 0);
  if (auctionRows.length > 0) {
    const applied = applyVinScanAuctionsToCcVin(next.cc_vin, auctionRows);
    sales = applied.sales;
    damages = applied.damages;
    if (!same(applied.block, next.cc_vin)) next = { ...next, cc_vin: applied.block };
  }
  const csddRow = indicators.find((row) => row.id === "csdd" && row.status === "found");
  if (csddRow) {
    const csdd = applyVinScanCsddToBlock(next.csdd, csddRow);
    if (!same(csdd, next.csdd)) next = { ...next, csdd };
  }
  const listingRow = indicators.find((row) => row.id === "listing_history" && row.status === "found");
  if (listingRow) {
    const listing = applyVinScanListingToBlock(next.listing_analysis, listingRow);
    if (!same(listing, next.listing_analysis)) next = { ...next, listing_analysis: listing };
  }
  return { blocks: next, changed: next !== blocks, sales, damages };
}

export type OrderAutoIntakeSummary = {
  sessionId: string;
  /** Marka / modelis pasūtījuma virsrakstam ziņā (bez VIN un personas datiem). */
  vehicleLabel: string;
  indicators: readonly VinScanIndicator[];
  auctionSales: number;
  photosImported: number;
  thecarapiAuctions: number;
};

function previewLine(label: string, row: VinScanIndicator | undefined): string {
  if (!row) return `${label}: nav pārbaudīts`;
  if (row.status === "found" || row.status === "none") return `${label}: ${row.summary}`;
  return `${label}: nav datu (${row.summary || row.status})`;
}

/**
 * Viena push ziņa pēc fona ielases: ko atrada bezmaksas avoti un AutoDNA / CARFAX priekšskatījumi
 * (ierakstu / foto skaits) - pirkuma lēmumam. Pirkums tikai ar Nila klikšķi pasūtījumā.
 */
export function buildOrderAutoIntakePush(s: OrderAutoIntakeSummary): AdminPushMessage {
  const found = s.indicators.filter((row) => row.status === "found").length;
  const head = [
    `VIN SCAN: ${found} avoti ar datiem`,
    s.auctionSales + s.thecarapiAuctions > 0 ? `izsoles ${s.auctionSales + s.thecarapiAuctions}` : "",
    s.photosImported > 0 ? `foto ${s.photosImported}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = [
    head,
    previewLine("AutoDNA", s.indicators.find((row) => row.id === "autodna_precheck")),
    previewLine("CARFAX", s.indicators.find((row) => row.id === "carfax_eu")),
    "Pirkums tikai ar Tavu klikšķi pasūtījumā.",
  ].join("\n");
  const title = `Pasūtījums gatavs pārskatam${s.vehicleLabel ? `: ${s.vehicleLabel}` : ""}`.slice(0, 120);
  return {
    title,
    body: body.slice(0, 600),
    url: `/admin/orders/${encodeURIComponent(s.sessionId)}`,
    tag: `intake-${s.sessionId}`,
    audience: "pro",
  };
}
