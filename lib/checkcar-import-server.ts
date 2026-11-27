import "server-only";

/**
 * CheckCar.vin pilnās atskaites imports: mērķa atrašana pēc VIN (pasūtījums vai ātrais vērtējums)
 * un `cc_vin` bloka ierakstīšana. Pasūtījumam - melnraksts (coalesce + force kā dīlera datu ķēdē),
 * ātrajam vērtējumam - tā fails (`quick-evals/<peekId>.json`). Foto - tā pati cc_vin JPEG krātuve;
 * ātrajam vērtējumam ar „sesiju” `qe_<peekId>`, kas eksportā pāriet uz pasūtījumu.
 */

import { listAllDashboardDraftIndexEntries } from "@/lib/admin-dashboard-draft-index";
import { readCcVinPhotoJpeg, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { getCheckoutSessionDetail, listAdminOrders } from "@/lib/admin-orders";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { flattenCcVinPhotoGroups, normalizeCcVinPhotoGroups } from "@/lib/cc-vin-photo-types";
import {
  autobidOriginalHint,
  orderTargetsForVin,
  pickCheckcarTarget,
  quickEvalCheckcarPhotoSession,
  quickEvalTargetsForVin,
  type CheckcarAutobidHint,
  type CheckcarQuickEvalCandidate,
  type CheckcarTarget,
  type CheckcarTargetKind,
} from "@/lib/checkcar-import-orders";
import { listListingPeeks } from "@/lib/listing-peek-store";
import { readQuickEval, updateQuickEval } from "@/lib/quick-eval-store";
import { readVinMemory } from "@/lib/vin-memory-store";

/** Cik jaunāko ātro vērtējumu failus lasām, ja VIN ir tikai CSDD datos (pieteikumā numurzīme). */
const QUICK_EVAL_DOC_SCAN = 80;

function emptyWorkspaceBody(): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

function vinKey(raw: string | null | undefined): string {
  return String(raw || "").replace(/[\s-]/g, "").toUpperCase();
}

async function quickEvalCandidates(vin: string): Promise<CheckcarQuickEvalCandidate[]> {
  const peeks = await listListingPeeks(500).catch(() => []);
  const want = vinKey(vin);
  const out: CheckcarQuickEvalCandidate[] = [];
  let scanned = 0;
  for (const p of peeks) {
    if (vinKey(p.vin) === want) {
      out.push({ peekId: p.id, createdAt: p.createdAt, vin: want });
      continue;
    }
    if (p.vin || scanned >= QUICK_EVAL_DOC_SCAN) continue;
    scanned += 1;
    const doc = await readQuickEval(p.id).catch(() => null);
    const docVin = vinKey(doc?.vin) || vinKey(doc?.sourceBlocks.csdd.vin);
    if (docVin === want) out.push({ peekId: p.id, createdAt: p.createdAt, vin: want });
  }
  return out;
}

/** Visi mērķi ar šo VIN un izvēlētais (lapas norāde vai jaunākais). */
export async function findCheckcarTarget(
  vin: string,
  hint?: { kind?: string; id?: string } | null,
): Promise<{ target: CheckcarTarget | null; alternatives: CheckcarTarget[] }> {
  const [{ rows }, index, quick] = await Promise.all([
    listAdminOrders(),
    listAllDashboardDraftIndexEntries().catch(() => []),
    quickEvalCandidates(vin),
  ]);
  return pickCheckcarTarget([...orderTargetsForVin(vin, rows, index), ...quickEvalTargetsForVin(vin, quick)], hint);
}

/** Pārbauda, vai mērķis eksistē un der (pasūtījums nav konsultācija; ātrais vērtējums ir). */
export async function checkcarTargetExists(kind: CheckcarTargetKind, id: string): Promise<boolean> {
  if (kind === "order") {
    const order = await getCheckoutSessionDetail(id).catch(() => null);
    return Boolean(order && order.checkoutLine !== "provin_select");
  }
  return Boolean(quickEvalCheckcarPhotoSession(id)) && Boolean(await readQuickEval(id).catch(() => null));
}

/** JPEG krātuves sesija mērķim. */
export function checkcarPhotoSession(kind: CheckcarTargetKind, id: string): string {
  return kind === "order" ? id : quickEvalCheckcarPhotoSession(id);
}

/** Nolasa jaunāko stāvokli, maina tikai `cc_vin` un ieraksta atpakaļ. */
export async function writeCheckcarBlock(
  kind: CheckcarTargetKind,
  id: string,
  mutate: (block: CcVinBlockState) => CcVinBlockState,
): Promise<{ ok: true; block: CcVinBlockState } | { ok: false; error: string }> {
  if (kind === "quick_eval") {
    let block = null as CcVinBlockState | null;
    const next = await updateQuickEval(id, (doc) => {
      const blocks = mergeSourceBlocksWithDefaults(doc.sourceBlocks);
      block = mutate(blocks.cc_vin);
      const count = flattenCcVinPhotoGroups(normalizeCcVinPhotoGroups(block.photoGroups, block.photos)).length;
      return {
        ...doc,
        sourceBlocks: { ...blocks, cc_vin: block },
        ccVin: { at: new Date().toISOString(), count },
      };
    }).catch(() => null);
    if (!next || !block) return { ok: false, error: "quick_eval_write_failed" };
    return { ok: true, block };
  }
  const prev = await readOrderDraft(id);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  const cc_vin = mutate(blocks.cc_vin);
  const incoming = persistBodyToOrderDraftWorkspace(
    { ...orderDraftWorkspaceToPersistBody(baseline), sourceBlocks: { ...blocks, cc_vin } },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );
  const patched = await patchOrderDraft(id, { workspace: incoming }, { force: true });
  if (!patched.ok) return { ok: false, error: patched.error };
  return { ok: true, block: cc_vin };
}

/**
 * Ātrā vērtējuma eksportā uz pasūtījumu: CheckCar foto no `qe_<peekId>` krātuves nokopē uz
 * pasūtījuma cc_vin krātuvi (citādi pasūtījumā grupas būtu bez bildēm).
 */
export async function copyQuickEvalCheckcarPhotosToOrder(
  peekId: string,
  sessionId: string,
  block: CcVinBlockState,
): Promise<number> {
  const from = quickEvalCheckcarPhotoSession(peekId);
  if (!from || from === sessionId) return 0;
  let copied = 0;
  for (const ph of flattenCcVinPhotoGroups(normalizeCcVinPhotoGroups(block.photoGroups, block.photos))) {
    if (await readCcVinPhotoJpeg(sessionId, ph.id).catch(() => null)) continue;
    const buf = await readCcVinPhotoJpeg(from, ph.id).catch(() => null);
    if (!buf) continue;
    await writeCcVinPhotoJpeg(sessionId, ph.id, buf)
      .then(() => {
        copied += 1;
      })
      .catch(() => undefined);
  }
  return copied;
}

/** Vai Autobid arhīvā (VIN atmiņa) ir šis auto - oriģinālās bildes bez ūdenszīmēm. */
export async function readAutobidOriginalHint(vin: string): Promise<CheckcarAutobidHint | null> {
  const entry = await readVinMemory(vin).catch(() => null);
  return autobidOriginalHint(entry);
}
