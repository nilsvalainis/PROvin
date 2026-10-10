import "server-only";

import fs from "fs/promises";
import path from "path";
import { del, get, put } from "@vercel/blob";
import { isSafeListingPeekId } from "@/lib/listing-peek-photos";
import type { FreeSourceSeedParts } from "@/lib/admin-free-source-seed";
import { mergeSourceBlocksWithDefaults, type SourceBlockKey, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

/**
 * Ātrā vērtējuma darba zona: tie paši avotu bloki kā pasūtījumam, bet atsevišķā failā katram
 * vērtējumam (`quick-evals/<peekId>.json`), nevis kopējā `listing-peeks/index.json`.
 * Pasūtījumu sarakstā tie neparādās; pēc apmaksas dati pāriet uz pasūtījumu (`quick-eval-service`).
 */

const RELATIVE_DIR = ".data/quick-evals";
const BLOB_PREFIX = "quick-evals/";

export type QuickEvalReuseRecord = {
  /** No kurienes: pasūtījuma `sessionId` vai cita ātrā vērtējuma `qe:<peekId>`. */
  fromId: string;
  keys: SourceBlockKey[];
  at: string;
  /** Kad avota darbs pēdējo reizi saglabāts (rāda datu vecumu). */
  sourceSavedAt: string | null;
};

export type QuickEvalExportRecord = {
  sessionId: string;
  at: string;
  mode: "auto" | "manual";
  copied: SourceBlockKey[];
  conflicts: SourceBlockKey[];
};

export type QuickEvalLtabMark = "clean" | "claims";

export type QuickEvalDoc = {
  version: 1;
  peekId: string;
  /** VIN pēc CSDD (ja klients deva numurzīmi). */
  vin: string;
  sourceBlocks: WorkspaceSourceBlocks;
  seed?: { at: string; parts: FreeSourceSeedParts };
  reusedFrom?: QuickEvalReuseRecord[];
  exports?: QuickEvalExportRecord[];
  /** Kad katrs bezmaksas avots pēdējo reizi ielasīts (atslēga = seed daļa: listing, csdd, tjekbil…). */
  sourceAt?: Record<string, string>;
  /** VIN SCAN: maksas avotu pieejamība bez pirkuma. */
  vinScan?: { at: string; indicators: import("@/lib/vin-scan/types").VinScanIndicator[] };
  /** CC-VIN foto skaits (PROVIN skripts pārlūkā). */
  ccVin?: { at: string; count: number | null; error?: string };
  /** LTAB pārbaudi dara operators; atzīme saglabājas un aiziet vēstulē / eksportā. */
  ltab?: { at: string; mark: QuickEvalLtabMark };
  createdAt: string;
  updatedAt: string;
};

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function fsPath(peekId: string): string {
  return path.join(process.cwd(), RELATIVE_DIR, `${peekId}.json`);
}

function safeId(peekId: string): string | null {
  const id = peekId.trim().toLowerCase();
  return isSafeListingPeekId(id) ? id : null;
}

export function emptyQuickEvalDoc(peekId: string, now = new Date()): QuickEvalDoc {
  const iso = now.toISOString();
  return {
    version: 1,
    peekId,
    vin: "",
    sourceBlocks: mergeSourceBlocksWithDefaults(null),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function parseQuickEvalDoc(raw: string, peekId: string): QuickEvalDoc | null {
  try {
    const o = JSON.parse(raw) as Partial<QuickEvalDoc>;
    if (!o || typeof o !== "object") return null;
    const base = emptyQuickEvalDoc(peekId);
    return {
      ...base,
      vin: typeof o.vin === "string" ? o.vin : "",
      sourceBlocks: mergeSourceBlocksWithDefaults(o.sourceBlocks),
      ...(o.seed && typeof o.seed === "object" ? { seed: o.seed } : {}),
      ...(Array.isArray(o.reusedFrom) ? { reusedFrom: o.reusedFrom } : {}),
      ...(Array.isArray(o.exports) ? { exports: o.exports } : {}),
      ...(o.sourceAt && typeof o.sourceAt === "object" ? { sourceAt: o.sourceAt } : {}),
      ...(o.vinScan && Array.isArray(o.vinScan.indicators) ? { vinScan: o.vinScan } : {}),
      ...(o.ccVin && typeof o.ccVin === "object" ? { ccVin: o.ccVin } : {}),
      ...(o.ltab && (o.ltab.mark === "clean" || o.ltab.mark === "claims") ? { ltab: o.ltab } : {}),
      createdAt: typeof o.createdAt === "string" ? o.createdAt : base.createdAt,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function readQuickEval(peekId: string): Promise<QuickEvalDoc | null> {
  const id = safeId(peekId);
  if (!id) return null;
  const token = blobToken();
  if (token) {
    try {
      const res = await get(`${BLOB_PREFIX}${id}.json`, { access: "private", token, useCache: false });
      if (res && res.statusCode === 200 && res.stream) {
        const doc = parseQuickEvalDoc(await new Response(res.stream).text(), id);
        if (doc) return doc;
      }
    } catch {
      /* fallback uz disku */
    }
  }
  try {
    return parseQuickEvalDoc(await fs.readFile(fsPath(id), "utf8"), id);
  } catch {
    return null;
  }
}

export async function writeQuickEval(doc: QuickEvalDoc): Promise<void> {
  const id = safeId(doc.peekId);
  if (!id) throw new Error("invalid_peek_id");
  const body = JSON.stringify({ ...doc, peekId: id, updatedAt: new Date().toISOString() });
  const token = blobToken();
  if (token) {
    await put(`${BLOB_PREFIX}${id}.json`, body, {
      access: "private",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    if (process.env.VERCEL === "1") return;
  }
  const fp = fsPath(id);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, fp);
}

/** Nolasa, izmaina un saglabā (viens vērtējums = viens fails, tāpēc citu ierakstus neaizskar). */
export async function updateQuickEval(
  peekId: string,
  fn: (doc: QuickEvalDoc) => QuickEvalDoc | Promise<QuickEvalDoc>,
): Promise<QuickEvalDoc | null> {
  const id = safeId(peekId);
  if (!id) return null;
  const current = (await readQuickEval(id)) ?? emptyQuickEvalDoc(id);
  const next = await fn(current);
  await writeQuickEval(next);
  return next;
}

export async function deleteQuickEval(peekId: string): Promise<void> {
  const id = safeId(peekId);
  if (!id) return;
  const token = blobToken();
  if (token) {
    try {
      await del(`${BLOB_PREFIX}${id}.json`, { token });
    } catch {
      /* jau nav */
    }
  }
  await fs.rm(fsPath(id), { force: true }).catch(() => {});
}
