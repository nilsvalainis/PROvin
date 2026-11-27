/**
 * Atverot pasūtījumu: vai šīs ierīces localStorage (melnraksts + rezerves kopijas) satur
 * vairāk aizpildītu lauku nekā servera versija. Tikai piedāvājums - nekad neatjauno automātiski.
 */
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { parseWorkspaceSnapshotSavedAtMs, type OrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import { countWorkspaceFilled } from "@/lib/admin-workspace-safety";
import { sourceBlockWipesSnapshotField } from "@/lib/admin-source-block-wipes";
import { deletedPhotoIdsSnapshotField } from "@/lib/admin-photo-tombstones";
import { clearedFieldsSnapshotField } from "@/lib/admin-cleared-fields";
import { technicalRiskMapSnapshotField } from "@/lib/admin-ai-technical-risk-map-types";
import { odometerAnomalyOverridesSnapshotField } from "@/lib/odometer-anomaly-classify";
import { contradictionFeedbackSnapshotField } from "@/lib/contradiction-feedback";
import { dealerMajorWorkOverridesSnapshotField } from "@/lib/dealer-major-works-override-persist";
import { dealerSignalsSnapshotField } from "@/lib/dealer-signals-persist";

export type LocalRestoreCandidate = {
  body: OrderWorkspacePersistBody;
  savedAtMs: number;
  localTotal: number;
  serverTotal: number;
};

type HydratedSnapshot = NonNullable<ReturnType<typeof hydrateWorkspaceFromStorage>>;

/**
 * Pilns darba zonas ķermenis no hidratēta momentuzņēmuma - VISI apakšlauki (riska karte, odometra/pretrunu/
 * lielo darbu labojumi, kapakmeņi, iztukšošanas marķieri). Lieto gan ielādes stāvoklim, gan apvienošanas bāzei,
 * lai bāze un lokālais būtu salīdzināmi (citādi trūkstošs lauks = viltus «lokāli mainīts»).
 */
export function hydratedSnapshotToPersistBody(h: HydratedSnapshot): OrderWorkspacePersistBody {
  return {
    sourceBlocks: h.sourceBlocks,
    iriss: h.iriss,
    apskatesPlāns: h.apskatesPlāns,
    tehniskoRiskuAnalize: h.tehniskoRiskuAnalize,
    cenasAtbilstiba: h.cenasAtbilstiba,
    previewConfirmed: Boolean(h.previewConfirmed),
    vehicleAiExtraction: h.vehicleAiExtraction ?? null,
    vehicleAiExtractionMeta: h.vehicleAiExtractionMeta ?? null,
    incidentPhotoGroups: h.incidentPhotoGroups ?? [],
    incidentPhotos: h.incidentPhotos ?? [],
    ...sourceBlockWipesSnapshotField(h.sourceBlockWipes),
    ...deletedPhotoIdsSnapshotField(h.deletedPhotoIds),
    ...clearedFieldsSnapshotField(h.clearedFields),
    ...technicalRiskMapSnapshotField(h.technicalRiskMap),
    ...odometerAnomalyOverridesSnapshotField(h.odometerAnomalyOverrides),
    ...contradictionFeedbackSnapshotField(h.contradictionFeedback),
    ...dealerMajorWorkOverridesSnapshotField(h.dealerMajorWorkOverrides),
    ...dealerSignalsSnapshotField(h.dealerSignals),
  };
}

export function snapshotRawToPersistBody(raw: string | null | undefined): OrderWorkspacePersistBody | null {
  if (!raw?.trim()) return null;
  const h = hydrateWorkspaceFromStorage(raw);
  if (!h) return null;
  return hydratedSnapshotToPersistBody(h);
}

function backupEntries(backupRaw: string | null): { savedAtMs: number; data: string }[] {
  if (!backupRaw) return [];
  try {
    const arr = JSON.parse(backupRaw) as { savedAt?: unknown; data?: unknown }[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.data === "string")
      .map((x) => ({
        data: x.data as string,
        savedAtMs: typeof x.savedAt === "string" && Number.isFinite(Date.parse(x.savedAt)) ? Date.parse(x.savedAt) : 0,
      }));
  } catch {
    return [];
  }
}

/** Bagātākā lokālā kopija, ja tajā ir vairāk aizpildītu lauku/bloku nekā serverī; citādi null. */
export function pickLocalRestoreCandidate(args: {
  localRaw: string | null;
  backupRaw: string | null;
  serverBody: OrderWorkspacePersistBody | null;
}): LocalRestoreCandidate | null {
  const serverTotal = countWorkspaceFilled(args.serverBody).total;
  const raws: { raw: string; savedAtMs: number }[] = [];
  if (args.localRaw) raws.push({ raw: args.localRaw, savedAtMs: parseWorkspaceSnapshotSavedAtMs(args.localRaw) });
  for (const e of backupEntries(args.backupRaw)) {
    raws.push({ raw: e.data, savedAtMs: Math.max(e.savedAtMs, parseWorkspaceSnapshotSavedAtMs(e.data)) });
  }
  let best: LocalRestoreCandidate | null = null;
  for (const r of raws) {
    const body = snapshotRawToPersistBody(r.raw);
    if (!body) continue;
    const total = countWorkspaceFilled(body).total;
    if (!best || total > best.localTotal || (total === best.localTotal && r.savedAtMs > best.savedAtMs)) {
      best = { body, savedAtMs: r.savedAtMs, localTotal: total, serverTotal };
    }
  }
  if (!best || best.localTotal <= serverTotal) return null;
  return best;
}

const DISMISS_KEY_PREFIX = "provin-admin-local-restore-dismissed-";

/** Noraidītais piedāvājums vairs nerādās tai pašai kopijai (katram `savedAtMs` atsevišķi). */
export function isLocalRestoreDismissed(sessionId: string, savedAtMs: number): boolean {
  try {
    const raw = localStorage.getItem(`${DISMISS_KEY_PREFIX}${sessionId}`);
    if (!raw) return false;
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) && list.includes(savedAtMs);
  } catch {
    return false;
  }
}

export function rememberLocalRestoreDismissed(sessionId: string, savedAtMs: number): void {
  try {
    const key = `${DISMISS_KEY_PREFIX}${sessionId}`;
    const raw = localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(prev) ? prev.filter((x) => typeof x === "number") : [];
    if (!list.includes(savedAtMs)) list.unshift(savedAtMs);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* quota */
  }
}
