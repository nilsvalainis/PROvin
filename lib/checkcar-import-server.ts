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
  orderHasListedVin,
  orderKnownVins,
  orderTargetsForVin,
  pickCheckcarTarget,
  quickEvalCheckcarPhotoSession,
  quickEvalTargetsForVin,
  type CheckcarAutobidHint,
  type CheckcarQuickEvalCandidate,
  type CheckcarTarget,
  type CheckcarTargetKind,
  usableVin,
} from "@/lib/checkcar-import-orders";
import { loadAdminGlobalSearch } from "@/lib/admin-global-search-load";
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

/** Cik jaunāko pasūtījumu bez VIN (pasūtīti pēc numurzīmes) melnrakstus pārlasām, meklējot VIN. */
const ORDER_DRAFT_SCAN = 120;
const ORDER_DRAFT_SCAN_CONCURRENCY = 8;

type OrderRow = Awaited<ReturnType<typeof listAdminOrders>>["rows"][number];

function usableOrderRow(row: OrderRow | undefined): row is OrderRow {
  return Boolean(row && !row.isDemo && row.checkoutLine !== "provin_select");
}

async function orderVinsFromDraft(row: { id: string; vin: string | null }, indexVin: string | null): Promise<string[]> {
  const draft = await readOrderDraft(row.id).catch(() => null);
  return orderKnownVins({ stripeVin: row.vin, indexVin, draft });
}

/** Pasūtījumi, kuru VIN ir tikai melnrakstā (CSDD bloks, numurzīmes atrisinājums, VIN SCAN u.c.). */
async function orderTargetsFromDrafts(
  vin: string,
  rows: readonly OrderRow[],
  indexVin: ReadonlyMap<string, string | null>,
  skip: ReadonlySet<string>,
): Promise<CheckcarTarget[]> {
  const want = usableVin(vin);
  const queue = rows
    .filter((r) => usableOrderRow(r) && !skip.has(r.id) && !orderHasListedVin(r, indexVin.get(r.id)))
    .slice(0, ORDER_DRAFT_SCAN);
  const out: CheckcarTarget[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(ORDER_DRAFT_SCAN_CONCURRENCY, queue.length) }, async () => {
      while (next < queue.length) {
        const row = queue[next++]!;
        const vins = await orderVinsFromDraft(row, indexVin.get(row.id) ?? null);
        if (vins.includes(want)) out.push({ kind: "order", id: row.id, at: row.created * 1000 });
      }
    }),
  );
  return out;
}

/** Admin meklēšanas indeksa trāpījumi (tas pats, ko rāda /api/admin/search). */
async function orderIdsFromAdminSearch(vin: string): Promise<string[]> {
  const groups = await loadAdminGlobalSearch(vin).catch(() => []);
  return groups.flatMap((g) => g.hits.filter((h) => h.kind === "pro-order").map((h) => h.id));
}

export type CheckcarHintMismatch = {
  kind: CheckcarTargetKind;
  id: string;
  /** Atvērtās lapas zināmie VIN (var būt tukšs). */
  vins: string[];
};

export type CheckcarTargetResult = {
  target: CheckcarTarget | null;
  alternatives: CheckcarTarget[];
  /** Atvērtā lapa ir cita auto - vajag operatora apstiprinājumu (`confirmHint`). */
  hintMismatch?: CheckcarHintMismatch;
};

async function hintedTarget(
  vin: string,
  hint: { kind: CheckcarTargetKind; id: string },
  rows: readonly OrderRow[],
  indexVin: ReadonlyMap<string, string | null>,
): Promise<{ target: CheckcarTarget | null; vins: string[]; exists: boolean }> {
  const want = usableVin(vin);
  if (hint.kind === "order") {
    const listed = rows.find((r) => r.id === hint.id);
    const detail = listed ?? (await getCheckoutSessionDetail(hint.id).catch(() => null));
    if (!detail || detail.isDemo || detail.checkoutLine === "provin_select") return { target: null, vins: [], exists: false };
    const vins = await orderVinsFromDraft(detail, indexVin.get(hint.id) ?? null);
    const target: CheckcarTarget = { kind: "order", id: hint.id, at: detail.created * 1000 };
    return { target: vins.includes(want) ? target : null, vins, exists: true };
  }
  const peek = await readQuickEval(hint.id).catch(() => null);
  if (!peek) return { target: null, vins: [], exists: false };
  const vins = [...new Set([usableVin(peek.vin), usableVin(peek.sourceBlocks.csdd.vin)].filter(Boolean))];
  const target: CheckcarTarget = { kind: "quick_eval", id: hint.id, at: Date.parse(peek.createdAt ?? "") || 0 };
  return { target: vins.includes(want) ? target : null, vins, exists: true };
}

/**
 * Visi mērķi ar šo VIN un izvēlētais. VIN salīdzina ar VISIEM avotiem: Stripe, melnrakstā labotais /
 * numurzīmes atrisinātais VIN, VIN SCAN, CSDD un citi avotu bloki, admin meklēšanas indekss.
 * Atvērtā pasūtījuma lapa (hint) uzvar; ja tai ir cits VIN - `hintMismatch` (apstiprina operators,
 * `confirmHint` = ielikt tik un tā).
 */
export async function findCheckcarTarget(
  vin: string,
  hint?: { kind: CheckcarTargetKind; id: string } | null,
  opts: { confirmHint?: boolean } = {},
): Promise<CheckcarTargetResult> {
  const [{ rows }, index, quick] = await Promise.all([
    listAdminOrders(),
    listAllDashboardDraftIndexEntries().catch(() => []),
    quickEvalCandidates(vin),
  ]);
  const indexVin = new Map(index.map((e) => [e.sessionId, e.vin]));
  const candidates = [...orderTargetsForVin(vin, rows, index), ...quickEvalTargetsForVin(vin, quick)];
  const known = new Set(candidates.map((c) => c.id));

  for (const id of await orderIdsFromAdminSearch(vin)) {
    const row = rows.find((r) => r.id === id);
    if (!usableOrderRow(row) || known.has(id)) continue;
    candidates.push({ kind: "order", id, at: row.created * 1000 });
    known.add(id);
  }

  if (hint && !known.has(hint.id)) {
    const h = await hintedTarget(vin, hint, rows, indexVin);
    if (h.target) {
      candidates.push(h.target);
      known.add(h.target.id);
    } else if (opts.confirmHint && h.exists) {
      /* Operators apstiprināja: atvērtajā lapā cits / nezināms VIN, bet ielikt tieši tur. */
      return pickCheckcarTarget([{ kind: hint.kind, id: hint.id, at: Number.MAX_SAFE_INTEGER }, ...candidates], hint);
    } else if (h.exists) {
      const picked = pickCheckcarTarget(candidates);
      return {
        target: null,
        alternatives: [...(picked.target ? [picked.target] : []), ...picked.alternatives],
        hintMismatch: { ...hint, vins: h.vins },
      };
    }
  }

  if (!candidates.some((c) => c.kind === "order")) {
    candidates.push(...(await orderTargetsFromDrafts(vin, rows, indexVin, known)));
  }
  return pickCheckcarTarget(candidates, hint);
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
