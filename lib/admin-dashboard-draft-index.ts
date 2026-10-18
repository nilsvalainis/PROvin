import "server-only";

import fs from "fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { extractCsddMakeModelFromWorkspace } from "@/lib/admin-csdd-make-model";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  parseOrderVinScanDashboardHint,
  parseOrderVinScanRecord,
  orderVinScanDashboardHintFromRecord,
  type OrderVinScanDashboardHint,
} from "@/lib/order-vin-scan";

const INDEX_FILENAME = "admin-dashboard-draft-index.json";

export type DashboardDraftIndexEntry = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoicePdfUrl: string | null;
  invoiceNumber: string | null;
  clientReportReadyAt: string | null;
  /** CSDD „Marka, modelis” — kad ievadīts darba zonā. */
  makeModel: string | null;
  /** 48 h termiņa manuāla „Izpildīts” atzīme (ISO laiks; `null` = nav atzīmēts). */
  auditCompletedAt: string | null;
  vin: string | null;
  notes: string | null;
  /** Bezmaksas VIN SCAN kopsavilkums jaunajām dashboard kartītēm. */
  vinScan: OrderVinScanDashboardHint | null;
};

type DashboardDraftIndexDoc = {
  version: 1;
  updatedAt: string;
  entries: Record<string, DashboardDraftIndexEntry>;
};

const EMPTY_ENTRY: DashboardDraftIndexEntry = {
  customerEmail: null,
  customerName: null,
  customerPhone: null,
  invoicePdfUrl: null,
  invoiceNumber: null,
  clientReportReadyAt: null,
  makeModel: null,
  auditCompletedAt: null,
  vin: null,
  notes: null,
  vinScan: null,
};

function indexFsPath(dir: string): string {
  return path.join(dir, INDEX_FILENAME);
}

function indexBlobPath(prefix: string): string {
  return `${prefix}${INDEX_FILENAME}`;
}

function normalizeEntry(raw: unknown): DashboardDraftIndexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    customerEmail: typeof o.customerEmail === "string" ? o.customerEmail : null,
    customerName: typeof o.customerName === "string" ? o.customerName : null,
    customerPhone: typeof o.customerPhone === "string" ? o.customerPhone : null,
    invoicePdfUrl: typeof o.invoicePdfUrl === "string" ? o.invoicePdfUrl : null,
    invoiceNumber: typeof o.invoiceNumber === "string" && o.invoiceNumber.trim() ? o.invoiceNumber.trim() : null,
    clientReportReadyAt:
      typeof o.clientReportReadyAt === "string" && o.clientReportReadyAt.trim()
        ? o.clientReportReadyAt.trim()
        : null,
    makeModel: typeof o.makeModel === "string" && o.makeModel.trim() ? o.makeModel.trim() : null,
    auditCompletedAt:
      typeof o.auditCompletedAt === "string" && o.auditCompletedAt.trim()
        ? o.auditCompletedAt.trim()
        : null,
    vin: typeof o.vin === "string" && o.vin.trim() ? o.vin.trim() : null,
    notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
    vinScan: parseOrderVinScanDashboardHint(o.vinScan),
  };
}

function normalizeDoc(raw: unknown): DashboardDraftIndexDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.entries || typeof o.entries !== "object") return null;
  const entries: Record<string, DashboardDraftIndexEntry> = {};
  for (const [id, val] of Object.entries(o.entries as Record<string, unknown>)) {
    const entry = normalizeEntry(val);
    if (entry) entries[id] = entry;
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    entries,
  };
}

async function readIndexFromFs(dir: string): Promise<DashboardDraftIndexDoc | null> {
  try {
    const raw = JSON.parse(await fs.readFile(indexFsPath(dir), "utf8")) as unknown;
    return normalizeDoc(raw);
  } catch {
    return null;
  }
}

async function readIndexFromBlob(blob: { token: string; prefix: string }): Promise<DashboardDraftIndexDoc | null> {
  try {
    const res = await get(indexBlobPath(blob.prefix), {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const raw = JSON.parse(await new Response(res.stream).text()) as unknown;
    return normalizeDoc(raw);
  } catch {
    return null;
  }
}

function pickNewer(a: DashboardDraftIndexDoc | null, b: DashboardDraftIndexDoc | null): DashboardDraftIndexDoc | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

async function readDashboardDraftIndexDoc(): Promise<DashboardDraftIndexDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readIndexFromFs(dir) : null;
  const fromBlob = blob ? await readIndexFromBlob(blob) : null;
  return pickNewer(fromFs, fromBlob) ?? { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
}

async function writeDashboardDraftIndexDoc(doc: DashboardDraftIndexDoc): Promise<void> {
  indexReadCache = null;
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return;

  const body = JSON.stringify(doc);

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFsPath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, fp);
    } catch {
      /* ignore */
    }
  }

  if (blob) {
    try {
      await put(indexBlobPath(blob.prefix), body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } catch {
      /* ignore */
    }
  }
}

export async function upsertDashboardDraftIndexEntry(
  sessionId: string,
  patch: Partial<DashboardDraftIndexEntry>,
): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const doc = await readDashboardDraftIndexDoc();
  const prev = doc.entries[id] ?? EMPTY_ENTRY;
  doc.entries[id] = {
    customerEmail: patch.customerEmail !== undefined ? patch.customerEmail : prev.customerEmail,
    customerName: patch.customerName !== undefined ? patch.customerName : prev.customerName,
    customerPhone: patch.customerPhone !== undefined ? patch.customerPhone : prev.customerPhone,
    invoicePdfUrl: patch.invoicePdfUrl !== undefined ? patch.invoicePdfUrl : prev.invoicePdfUrl,
    invoiceNumber: patch.invoiceNumber !== undefined ? patch.invoiceNumber : prev.invoiceNumber,
    clientReportReadyAt:
      patch.clientReportReadyAt !== undefined ? patch.clientReportReadyAt : prev.clientReportReadyAt,
    makeModel: patch.makeModel !== undefined ? patch.makeModel : prev.makeModel,
    auditCompletedAt:
      patch.auditCompletedAt !== undefined ? patch.auditCompletedAt : prev.auditCompletedAt,
    vin: patch.vin !== undefined ? patch.vin : prev.vin,
    notes: patch.notes !== undefined ? patch.notes : prev.notes,
    vinScan: patch.vinScan !== undefined ? patch.vinScan : prev.vinScan,
  };
  doc.updatedAt = new Date().toISOString();
  await writeDashboardDraftIndexDoc(doc);
}

function summaryFieldsFromDraftRaw(raw: {
  workspace?: unknown;
  orderEdits?: { vin?: unknown; notes?: unknown };
  vinScan?: unknown;
  invoiceNumber?: unknown;
  invoicePdfUrl?: unknown;
  clientReportReadyAt?: unknown;
}): {
  makeModel: string | null;
  vin: string | null;
  notes: string | null;
  vinScan: OrderVinScanDashboardHint | null;
  invoiceNumber: string | null;
  invoicePdfUrl: string | null;
  clientReportReadyAt: string | null;
} {
  const vin = typeof raw.orderEdits?.vin === "string" && raw.orderEdits.vin.trim() ? raw.orderEdits.vin.trim() : null;
  const notes =
    typeof raw.orderEdits?.notes === "string" && raw.orderEdits.notes.trim() ? raw.orderEdits.notes.trim() : null;
  return {
    makeModel: extractCsddMakeModelFromWorkspace(raw.workspace),
    vin,
    notes,
    vinScan: orderVinScanDashboardHintFromRecord(parseOrderVinScanRecord(raw.vinScan)),
    invoiceNumber: typeof raw.invoiceNumber === "string" && raw.invoiceNumber.trim() ? raw.invoiceNumber.trim() : null,
    invoicePdfUrl: typeof raw.invoicePdfUrl === "string" && raw.invoicePdfUrl.trim() ? raw.invoicePdfUrl.trim() : null,
    clientReportReadyAt:
      typeof raw.clientReportReadyAt === "string" && raw.clientReportReadyAt.trim()
        ? raw.clientReportReadyAt.trim()
        : null,
  };
}

async function readDraftFileSummaryFields(sessionId: string): Promise<{
  makeModel: string | null;
  vin: string | null;
  notes: string | null;
  vinScan: OrderVinScanDashboardHint | null;
  invoiceNumber: string | null;
  invoicePdfUrl: string | null;
  clientReportReadyAt: string | null;
}> {
  const empty = {
    makeModel: null as string | null,
    vin: null as string | null,
    notes: null as string | null,
    vinScan: null as OrderVinScanDashboardHint | null,
    invoiceNumber: null as string | null,
    invoicePdfUrl: null as string | null,
    clientReportReadyAt: null as string | null,
  };
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();

  if (dir) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, `${sessionId}.json`), "utf8")) as {
        workspace?: unknown;
        orderEdits?: { vin?: unknown; notes?: unknown };
        vinScan?: unknown;
        invoiceNumber?: unknown;
        invoicePdfUrl?: unknown;
        clientReportReadyAt?: unknown;
      };
      const fields = summaryFieldsFromDraftRaw(raw);
      if (
        fields.makeModel ||
        fields.vin ||
        fields.notes ||
        fields.vinScan ||
        fields.invoiceNumber ||
        fields.invoicePdfUrl ||
        fields.clientReportReadyAt
      ) {
        return fields;
      }
    } catch {
      /* try blob */
    }
  }

  if (blob) {
    try {
      const res = await get(`${blob.prefix}${sessionId}.json`, {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (!res || res.statusCode !== 200 || !res.stream) return empty;
      const raw = JSON.parse(await new Response(res.stream).text()) as {
        workspace?: unknown;
        orderEdits?: { vin?: unknown; notes?: unknown };
        vinScan?: unknown;
        invoiceNumber?: unknown;
        invoicePdfUrl?: unknown;
        clientReportReadyAt?: unknown;
      };
      return summaryFieldsFromDraftRaw(raw);
    } catch {
      return empty;
    }
  }

  return empty;
}

/**
 * Melnraksti, kuriem backfill jau mēģināts šajā instancē (lauks tur tiešām tukšs, piem. nav piezīmju).
 * Bez šī katrs saraksta / VIN vēstures pieprasījums atkārtoti lasīja līdz 40 pilniem melnrakstiem.
 */
const BACKFILL_RETRY_MS = 10 * 60 * 1000;
const backfillTriedAt = new Map<string, number>();

const INDEX_READ_TTL_MS = 3000;
let indexReadCache: { at: number; doc: DashboardDraftIndexDoc } | null = null;
let indexReadInflight: Promise<DashboardDraftIndexDoc> | null = null;

/** Tikai lasīšanai: viens GET uz ~3 s (vienā lapā summaries izsauc vairākas funkcijas). */
async function readDashboardDraftIndexDocCached(): Promise<DashboardDraftIndexDoc> {
  if (indexReadCache && Date.now() - indexReadCache.at < INDEX_READ_TTL_MS) return indexReadCache.doc;
  if (indexReadInflight) return indexReadInflight;
  indexReadInflight = readDashboardDraftIndexDoc()
    .then((doc) => {
      indexReadCache = { at: Date.now(), doc };
      return doc;
    })
    .finally(() => {
      indexReadInflight = null;
    });
  return indexReadInflight;
}

/** Viena JSON lasīšana visiem dashboard laukiem; trūkstošo makeModel aizpilda no melnraksta. */
export async function readDashboardDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, DashboardDraftIndexEntry>> {
  const doc = await readDashboardDraftIndexDocCached();
  const out = new Map<string, DashboardDraftIndexEntry>();
  const needsBackfill: string[] = [];

  for (const id of sessionIds) {
    const entry = doc.entries[id] ?? EMPTY_ENTRY;
    out.set(id, entry);
    if (!entry.makeModel || !entry.vin || !entry.notes || !entry.vinScan) {
      const tried = backfillTriedAt.get(id);
      if (!tried || Date.now() - tried > BACKFILL_RETRY_MS) needsBackfill.push(id);
    }
  }

  if (needsBackfill.length > 0) {
    const BACKFILL_CAP = 40;
    const toFill = needsBackfill.slice(0, BACKFILL_CAP);
    const found: {
      id: string;
      makeModel: string | null;
      vin: string | null;
      notes: string | null;
      vinScan: OrderVinScanDashboardHint | null;
      invoiceNumber: string | null;
      invoicePdfUrl: string | null;
      clientReportReadyAt: string | null;
    }[] = [];
    await Promise.all(
      toFill.map(async (id) => {
        const prev = out.get(id) ?? EMPTY_ENTRY;
        if (prev.makeModel && prev.vin && prev.notes && prev.vinScan) return;
        const fromDraft = await readDraftFileSummaryFields(id);
        backfillTriedAt.set(id, Date.now());
        const next = {
          ...prev,
          makeModel: prev.makeModel || fromDraft.makeModel,
          vin: prev.vin || fromDraft.vin,
          notes: prev.notes || fromDraft.notes,
          vinScan: prev.vinScan || fromDraft.vinScan,
          invoiceNumber: prev.invoiceNumber || fromDraft.invoiceNumber,
          invoicePdfUrl: prev.invoicePdfUrl || fromDraft.invoicePdfUrl,
          clientReportReadyAt: prev.clientReportReadyAt || fromDraft.clientReportReadyAt,
        };
        if (
          next.makeModel !== prev.makeModel ||
          next.vin !== prev.vin ||
          next.notes !== prev.notes ||
          next.vinScan !== prev.vinScan ||
          next.invoiceNumber !== prev.invoiceNumber ||
          next.invoicePdfUrl !== prev.invoicePdfUrl ||
          next.clientReportReadyAt !== prev.clientReportReadyAt
        ) {
          found.push({
            id,
            makeModel: next.makeModel,
            vin: next.vin,
            notes: next.notes,
            vinScan: next.vinScan,
            invoiceNumber: next.invoiceNumber,
            invoicePdfUrl: next.invoicePdfUrl,
            clientReportReadyAt: next.clientReportReadyAt,
          });
          out.set(id, next);
        }
      }),
    );
    if (found.length > 0) {
      void (async () => {
        try {
          const latest = await readDashboardDraftIndexDoc();
          for (const row of found) {
            const prev = latest.entries[row.id] ?? EMPTY_ENTRY;
            latest.entries[row.id] = {
              ...prev,
              makeModel: prev.makeModel || row.makeModel,
              vin: prev.vin || row.vin,
              notes: prev.notes || row.notes,
              vinScan: prev.vinScan || row.vinScan,
              invoiceNumber: prev.invoiceNumber || row.invoiceNumber,
              invoicePdfUrl: prev.invoicePdfUrl || row.invoicePdfUrl,
              clientReportReadyAt: prev.clientReportReadyAt || row.clientReportReadyAt,
            };
          }
          latest.updatedAt = new Date().toISOString();
          await writeDashboardDraftIndexDoc(latest);
        } catch {
          /* ignore background index warm */
        }
      })();
    }
  }

  return out;
}

export function dashboardDraftEntryFromOrderEdits(
  orderEdits: {
    customerEmail?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    vin?: string | null;
    notes?: string | null;
  } | null | undefined,
  invoicePdfUrl?: string | null,
  workspace?: unknown,
  extras?: {
    invoiceNumber?: string | null;
    clientReportReadyAt?: string | null;
  },
): Partial<DashboardDraftIndexEntry> {
  const email = orderEdits?.customerEmail?.trim();
  const name = orderEdits?.customerName?.trim();
  const phone = orderEdits?.customerPhone?.trim();
  const vin = orderEdits?.vin?.trim();
  const notes = orderEdits?.notes?.trim();
  return {
    customerEmail: email || null,
    customerName: name || null,
    customerPhone: phone || null,
    invoicePdfUrl: invoicePdfUrl ?? null,
    makeModel: extractCsddMakeModelFromWorkspace(workspace),
    vin: vin || null,
    notes: notes || null,
    ...(extras?.invoiceNumber !== undefined ? { invoiceNumber: extras.invoiceNumber } : {}),
    ...(extras?.clientReportReadyAt !== undefined ? { clientReportReadyAt: extras.clientReportReadyAt } : {}),
  };
}
