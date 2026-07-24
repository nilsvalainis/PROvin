import "server-only";

import fs from "fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { extractCsddMakeModelFromWorkspace } from "@/lib/admin-csdd-make-model";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";

const INDEX_FILENAME = "admin-dashboard-draft-index.json";

export type DashboardDraftIndexEntry = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoicePdfUrl: string | null;
  /** CSDD „Marka, modelis” — kad ievadīts darba zonā. */
  makeModel: string | null;
  /** 48 h termiņa manuāla „Izpildīts” atzīme (ISO laiks; `null` = nav atzīmēts). */
  auditCompletedAt: string | null;
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
  makeModel: null,
  auditCompletedAt: null,
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
    makeModel: typeof o.makeModel === "string" && o.makeModel.trim() ? o.makeModel.trim() : null,
    auditCompletedAt:
      typeof o.auditCompletedAt === "string" && o.auditCompletedAt.trim()
        ? o.auditCompletedAt.trim()
        : null,
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
      useCache: true,
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
    makeModel: patch.makeModel !== undefined ? patch.makeModel : prev.makeModel,
    auditCompletedAt:
      patch.auditCompletedAt !== undefined ? patch.auditCompletedAt : prev.auditCompletedAt,
  };
  doc.updatedAt = new Date().toISOString();
  await writeDashboardDraftIndexDoc(doc);
}

async function readMakeModelFromDraftFile(sessionId: string): Promise<string | null> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();

  if (dir) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, `${sessionId}.json`), "utf8")) as {
        workspace?: unknown;
      };
      const mm = extractCsddMakeModelFromWorkspace(raw.workspace);
      if (mm) return mm;
    } catch {
      /* try blob */
    }
  }

  if (blob) {
    try {
      const res = await get(`${blob.prefix}${sessionId}.json`, {
        access: "private",
        token: blob.token,
        useCache: true,
      });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const raw = JSON.parse(await new Response(res.stream).text()) as { workspace?: unknown };
      return extractCsddMakeModelFromWorkspace(raw.workspace);
    } catch {
      return null;
    }
  }

  return null;
}

/** Viena JSON lasīšana visiem dashboard laukiem; trūkstošo makeModel mēģina aizpildīt no melnraksta. */
export async function readDashboardDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, DashboardDraftIndexEntry>> {
  const doc = await readDashboardDraftIndexDoc();
  const out = new Map<string, DashboardDraftIndexEntry>();
  const missingMakeModel: string[] = [];

  for (const id of sessionIds) {
    const entry = doc.entries[id] ?? EMPTY_ENTRY;
    out.set(id, entry);
    if (!entry.makeModel) missingMakeModel.push(id);
  }

  if (missingMakeModel.length > 0) {
    const BACKFILL_CAP = 40;
    const toFill = missingMakeModel.slice(0, BACKFILL_CAP);
    const found: { id: string; makeModel: string }[] = [];
    await Promise.all(
      toFill.map(async (id) => {
        const mm = await readMakeModelFromDraftFile(id);
        if (mm) {
          found.push({ id, makeModel: mm });
          out.set(id, { ...(out.get(id) ?? EMPTY_ENTRY), makeModel: mm });
        }
      }),
    );
    if (found.length > 0) {
      void (async () => {
        try {
          const latest = await readDashboardDraftIndexDoc();
          for (const { id, makeModel } of found) {
            const prev = latest.entries[id] ?? EMPTY_ENTRY;
            latest.entries[id] = { ...prev, makeModel };
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
  } | null | undefined,
  invoicePdfUrl?: string | null,
  workspace?: unknown,
): Partial<DashboardDraftIndexEntry> {
  const email = orderEdits?.customerEmail?.trim();
  const name = orderEdits?.customerName?.trim();
  const phone = orderEdits?.customerPhone?.trim();
  return {
    customerEmail: email || null,
    customerName: name || null,
    customerPhone: phone || null,
    invoicePdfUrl: invoicePdfUrl ?? null,
    makeModel: extractCsddMakeModelFromWorkspace(workspace),
  };
}
