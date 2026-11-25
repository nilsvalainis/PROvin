import "server-only";

/**
 * Automātika pēc apmaksas (25.11): VIN SCAN pēc CSDD sēklas + bezmaksas imports blokos + viena push ziņa.
 * Palaiž Stripe webhook (ja pēc CSDD sēklas pietiek laika) vai fona maršruts
 * `/api/cron/order-auto-intake` ar savu 300 s budžetu. Nekādu pirkumu.
 */
import { sendAdminPush } from "@/lib/admin-push";
import { collectCcVinPhotoIdsFromWorkspace } from "@/lib/admin-cc-vin-photo-store";
import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import type { OrderDraftState, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { mergeImportedPhotoGroups } from "@/lib/auction-photo-group-merge";
import { CC_VIN_MAX_PHOTOS, makeCcVinPhotoGroupId, syncCcVinPhotoGroupsAndFlat } from "@/lib/cc-vin-photo-types";
import { cronSecretGate } from "@/lib/cron-bearer";
import { getSiteOrigin } from "@/lib/email/mail-config";
import {
  applyVinScanImportsToBlocks,
  buildOrderAutoIntakePush,
  orderAutoIntakeScanInputFromCsdd,
  ORDER_AUTO_INTAKE_PHOTO_MIN_MS,
} from "@/lib/order-auto-intake-core";
import { parseOrderVinScanRecord } from "@/lib/order-vin-scan";
import { importVinScanAuctionPhotoGroupsToCcVin, plansToImportGroups } from "@/lib/order-vin-scan-photo-import";
import { collectVinScanAuctionPhotoGroups } from "@/lib/order-vin-scan-photos";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { fetchThecarapiCcVinMerge } from "@/lib/thecarapi-cc-vin";
import { thecarapiAdminFlag, thecarapiConfigured } from "@/lib/vin-scan/thecarapi-flags";

const LOG = "[order-auto-intake]";

export type OrderAutoIntakeInput = {
  vin?: string | null;
  listingUrl?: string | null;
  /** Epoch ms: līdz kuram jābeidz (saglabāšana jau ieskaitīta). */
  deadlineAt: number;
  trigger: "webhook" | "background";
  /** Dīlera datu produkts: savs paziņojums - push šeit nesūta. */
  skipPush?: boolean;
};

export type OrderAutoIntakeResult = {
  ok: boolean;
  reason?: string;
  scanFound?: number;
  imported?: boolean;
  auctionSales?: number;
  photosImported?: number;
  thecarapiAuctions?: number;
  pushed?: number;
};

function emptyWorkspace(): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

/**
 * Bloku izmaiņa ar optimistisko revīziju (operators var tieši tobrīd atvērt pasūtījumu): katrā mēģinājumā
 * `mutate` saņem jaunāko melnrakstu; `null` = nav ko rakstīt.
 */
async function patchDraftSourceBlocks(
  sessionId: string,
  mutate: (blocks: WorkspaceSourceBlocks, draft: OrderDraftState | null) => WorkspaceSourceBlocks | null,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const draft = await readOrderDraft(sessionId).catch(() => null);
    const baseline = draft?.workspace ?? emptyWorkspace();
    const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
    const next = mutate(blocks, draft);
    if (!next) return false;
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: next } },
      draft?.workspaceRevision ? { expectedWorkspaceRevision: draft.workspaceRevision } : {},
    );
    if (res.ok) return true;
    if (res.error !== "stale_revision") {
      console.warn(LOG, "draft write failed", { sessionId: sessionId.slice(-8), error: res.error });
      return false;
    }
  }
  return false;
}

function vehicleLabel(blocks: WorkspaceSourceBlocks): string {
  return [blocks.csdd.makeModel, blocks.csdd.modelYear].map((s) => (s ?? "").trim()).filter(Boolean).join(" ").slice(0, 60);
}

/** VIN SCAN izsoļu foto (tikai bezmaksas avotu URL) -> Izsoļu portālu arhīva foto grupas. */
async function importAuctionPhotos(sessionId: string, indicators: Parameters<typeof collectVinScanAuctionPhotoGroups>[0]): Promise<number> {
  const plans = collectVinScanAuctionPhotoGroups(indicators);
  if (!plans.some((plan) => plan.urls.length > 0)) return 0;
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const existingCount = collectCcVinPhotoIdsFromWorkspace(draft?.workspace ?? null).size;
  if (existingCount >= CC_VIN_MAX_PHOTOS) return 0;
  const cc = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks).cc_vin;
  const groups = cc.photoGroups ?? [];
  const result = await importVinScanAuctionPhotoGroupsToCcVin(sessionId, plansToImportGroups(plans), {
    existingCount,
    existingSourceUrls: groups.flatMap((g) => g.photos.map((p) => p.sourceUrl).filter((u): u is string => Boolean(u))),
    existingContentHashes: groups.flatMap((g) => g.photos.map((p) => p.contentHash).filter((h): h is string => Boolean(h))),
  });
  const incoming = result.groups
    .map((g) => ({ title: g.title || "VIN SCAN", photos: g.photos }))
    .filter((g) => g.photos.length > 0);
  if (incoming.length === 0) return 0;
  const saved = await patchDraftSourceBlocks(sessionId, (blocks) => {
    const merged = mergeImportedPhotoGroups(blocks.cc_vin.photoGroups ?? [], incoming, makeCcVinPhotoGroupId);
    const synced = syncCcVinPhotoGroupsAndFlat(merged);
    return { ...blocks, cc_vin: { ...blocks.cc_vin, photoGroups: synced.photoGroups, photos: synced.photos } };
  });
  return saved ? result.imported : 0;
}

/** TheCarApi -> Izsoļu portālu arhīvs (+ VIN atmiņa / izsoļu arhīvs, + galerija ar datumiem). Pakete jau apmaksāta. */
async function importThecarapi(
  sessionId: string,
  vin: string,
  deadlineAt: number,
  scanStatus: string | undefined,
): Promise<number> {
  if (!thecarapiConfigured() || !thecarapiAdminFlag()) return 0;
  // VIN SCAN jau pajautāja un izsoļu nav - otru reizi nesaucam.
  if (scanStatus === "none") return 0;
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const prev = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks).cc_vin;
  const res = await fetchThecarapiCcVinMerge({ vin, prev, sessionId, deadline: deadlineAt });
  if (res.error || (res.parse.status !== "found" && res.records.length === 0)) return 0;
  const prevJson = JSON.stringify(prev);
  const saved = await patchDraftSourceBlocks(sessionId, (blocks) => {
    // Ja operators cc_vin starplaikā mainīja - neko nepārrakstām (poga paliek).
    if (JSON.stringify(blocks.cc_vin) !== prevJson) return null;
    return { ...blocks, cc_vin: res.block };
  });
  return saved ? (res.parse.auctions ?? []).length : 0;
}

export async function runOrderAutoIntake(sessionId: string, input: OrderAutoIntakeInput): Promise<OrderAutoIntakeResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, reason: "invalid_session" };
  const before = await readOrderDraft(sessionId).catch(() => null);
  const seededBlocks = mergeSourceBlocksWithDefaults(before?.workspace?.sourceBlocks);
  const vinRaw = normalizeVin(input.vin ?? "");
  const csddVin = normalizeVin(seededBlocks.csdd.vin || seededBlocks.csdd.registry?.data.vin || "");
  const vin = isValidVin(vinRaw) ? vinRaw : isValidVin(csddVin) ? csddVin : "";
  if (!vin) return { ok: false, reason: "no_vin" };

  // 1) VIN SCAN pēc CSDD: LV numurzīme + precīzs 1. reģistrācijas datums.
  const scanInput = orderAutoIntakeScanInputFromCsdd(seededBlocks.csdd);
  const scan = await runOrderFreeVinScan(sessionId, {
    vin,
    listingUrl: input.listingUrl,
    plates: scanInput.plates,
    firstRegDate: scanInput.firstRegDate,
  });
  console.info(LOG, "vin scan", { sessionId: sessionId.slice(-8), trigger: input.trigger, ...scan });

  const record = parseOrderVinScanRecord((await readOrderDraft(sessionId).catch(() => null))?.vinScan);
  const indicators = record?.vin === vin ? record.indicators : [];

  // 2) Imports blokos (tas, ko dara pogas «Importēt»): izsoles -> arhīvs, CSDD, sludinājums.
  let auctionSales = 0;
  const imported = indicators.length
    ? await patchDraftSourceBlocks(sessionId, (blocks) => {
        const applied = applyVinScanImportsToBlocks(blocks, indicators);
        auctionSales = applied.sales;
        return applied.changed ? applied.blocks : null;
      })
    : false;

  // 3) Foto un TheCarApi - tikai ja laiks atļauj (bloki jau saglabāti).
  let photosImported = 0;
  let thecarapiAuctions = 0;
  if (input.deadlineAt - Date.now() > ORDER_AUTO_INTAKE_PHOTO_MIN_MS) {
    photosImported = await importAuctionPhotos(sessionId, indicators).catch((err) => {
      console.warn(LOG, "photos failed", err instanceof Error ? err.message : "unknown");
      return 0;
    });
  }
  if (input.deadlineAt - Date.now() > ORDER_AUTO_INTAKE_PHOTO_MIN_MS) {
    const tcStatus = indicators.find((row) => row.id === "thecarapi_eu")?.status;
    thecarapiAuctions = await importThecarapi(sessionId, vin, input.deadlineAt - 10_000, tcStatus).catch((err) => {
      console.warn(LOG, "thecarapi failed", err instanceof Error ? err.message : "unknown");
      return 0;
    });
  }

  // 4) Viena push ziņa Nilam ar AutoDNA / CARFAX priekšskatījumu skaitiem. Pirkums - tikai ar klikšķi.
  let pushed = 0;
  if (!input.skipPush) {
    const latest = mergeSourceBlocksWithDefaults((await readOrderDraft(sessionId).catch(() => null))?.workspace?.sourceBlocks);
    const msg = buildOrderAutoIntakePush({
      sessionId,
      vehicleLabel: vehicleLabel(latest),
      indicators,
      auctionSales,
      photosImported,
      thecarapiAuctions,
    });
    pushed = (await sendAdminPush(msg).catch(() => ({ sent: 0 }))).sent;
  }

  return {
    ok: true,
    scanFound: indicators.filter((row) => row.status === "found").length,
    imported,
    auctionSales,
    photosImported,
    thecarapiAuctions,
    pushed,
  };
}

export const ORDER_AUTO_INTAKE_ROUTE = "/api/cron/order-auto-intake";

/** Fona maršruta vārti: tas pats CRON_SECRET, ko lieto Vercel Cron. */
export function orderAutoIntakeRouteGate(authorization: string | null | undefined) {
  return cronSecretGate(authorization);
}

/** Vai drīkst atlikt fona maršrutā (tikai production, kur ir CRON_SECRET un vietnes adrese). */
export function canDispatchOrderAutoIntake(): boolean {
  return process.env.VERCEL_ENV === "production" && Boolean(process.env.CRON_SECRET?.trim());
}

/**
 * Atliek darbu fona maršrutā ar savu 300 s budžetu. Maršruts atbild uzreiz (darbs iet `after()`).
 * false = neizdevās nodot (izsaucējs dara pats, cik laiks atļauj).
 */
export async function dispatchOrderAutoIntake(
  sessionId: string,
  body: { vin?: string | null; listingUrl?: string | null; skipPush?: boolean },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return false;
  try {
    const res = await fetch(`${getSiteOrigin()}${ORDER_AUTO_INTAKE_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ sessionId, ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch (err) {
    console.warn(LOG, "dispatch failed", err instanceof Error ? err.message : "unknown");
    return false;
  }
}
