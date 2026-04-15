import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PkdCommissionInvoiceInput } from "@/lib/pkd-commission-invoice-pdf";

const STORE_RELATIVE_DIR = ".data/admin-pkd-commission-invoices";
const STORE_TMP_DIR = path.join(os.tmpdir(), "provin-admin-pkd-commission-invoices");
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
const OFF_VALUES = ["0", "false", "no", "off", "disabled"];

export type PkdCommissionInvoiceDraft = PkdCommissionInvoiceInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function resolveStoreDir(): string {
  const explicit = process.env.ADMIN_PKD_INVOICE_DIR?.trim() ?? "";
  if (explicit) return path.resolve(explicit);

  const orderDraftDirRaw = process.env.ADMIN_ORDER_DRAFT_DIR?.trim() ?? "";
  if (orderDraftDirRaw && !OFF_VALUES.includes(orderDraftDirRaw.toLowerCase())) {
    const base = path.resolve(orderDraftDirRaw);
    return path.join(base, "..", "admin-pkd-commission-invoices");
  }

  return path.join(process.cwd(), STORE_RELATIVE_DIR);
}

function storeDirs(): string[] {
  const preferred = resolveStoreDir();
  if (preferred === STORE_TMP_DIR) return [STORE_TMP_DIR];
  return [preferred, STORE_TMP_DIR];
}

function draftPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export function isSafePkdInvoiceId(id: string): boolean {
  return SAFE_ID_RE.test(id);
}

function formatInvoiceDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
}

function parseInvoiceNumberMeta(invoiceNumber: string): { year: number; seq: number } | null {
  const m = /^PKD-(\d{4})-(\d{3,})$/.exec(invoiceNumber.trim());
  if (!m) return null;
  const year = Number.parseInt(m[1], 10);
  const seq = Number.parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(seq)) return null;
  return { year, seq };
}

async function readDraftFile(id: string): Promise<PkdCommissionInvoiceDraft | null> {
  for (const dir of storeDirs()) {
    try {
      const raw = await fs.readFile(draftPath(dir, id), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const o = parsed as Record<string, unknown>;
      if (o.id !== id) return null;
      const must = [
        "invoiceNumber",
        "invoiceDate",
        "paymentDue",
        "serviceDescription",
        "amountEur",
        "supplierName",
        "supplierReg",
        "supplierAddress",
        "supplierBank",
        "supplierSwift",
        "supplierBankAccount",
        "supplierEmail",
        "supplierPhone",
        "recipientCompany",
        "recipientReg",
        "recipientAddress",
        "createdAt",
        "updatedAt",
      ] as const;
      for (const key of must) {
        if (typeof o[key] !== "string") return null;
      }
      return {
        id,
        invoiceNumber: o.invoiceNumber as string,
        invoiceDate: o.invoiceDate as string,
        paymentDue: o.paymentDue as string,
        serviceDescription: o.serviceDescription as string,
        amountEur: o.amountEur as string,
        supplierName: o.supplierName as string,
        supplierReg: o.supplierReg as string,
        supplierAddress: o.supplierAddress as string,
        supplierBank: o.supplierBank as string,
        supplierSwift: o.supplierSwift as string,
        supplierBankAccount: o.supplierBankAccount as string,
        supplierEmail: o.supplierEmail as string,
        supplierPhone: o.supplierPhone as string,
        recipientCompany: o.recipientCompany as string,
        recipientReg: o.recipientReg as string,
        recipientAddress: o.recipientAddress as string,
        createdAt: o.createdAt as string,
        updatedAt: o.updatedAt as string,
      };
    } catch {
      /* try next storage dir */
    }
  }
  return null;
}

async function writeDraftFile(draft: PkdCommissionInvoiceDraft): Promise<void> {
  let lastError: unknown = null;
  for (const dir of storeDirs()) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = draftPath(dir, draft.id);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(draft), "utf8");
      await fs.rename(tmp, fp);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("write_failed");
}

export async function listPkdCommissionInvoiceDrafts(): Promise<PkdCommissionInvoiceDraft[]> {
  try {
    const idSet = new Set<string>();
    for (const dir of storeDirs()) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isFile() || !e.name.endsWith(".json")) continue;
          const id = e.name.slice(0, -5);
          if (isSafePkdInvoiceId(id)) idSet.add(id);
        }
      } catch {
        /* this dir might not exist yet */
      }
    }
    const ids = [...idSet];
    const drafts = await Promise.all(ids.map((id) => readDraftFile(id)));
    return drafts
      .filter((d): d is PkdCommissionInvoiceDraft => d != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getPkdCommissionInvoiceDraft(id: string): Promise<PkdCommissionInvoiceDraft | null> {
  if (!isSafePkdInvoiceId(id)) return null;
  return readDraftFile(id);
}

function defaultDraft(now: Date, invoiceNumber: string): PkdCommissionInvoiceInput {
  return {
    invoiceNumber,
    invoiceDate: formatInvoiceDate(now),
    paymentDue: "14 dienas no rēķina datuma",
    serviceDescription:
      "Komisijas pakalpojumi par februārī sniegtajiem pakalpojumiem.\nAfilio numurs: 0220725002.\nKonts: nils.valainis@gmail.com",
    amountEur: "96.09",
    supplierName: "Nils Valainis",
    supplierReg: "09118711109",
    supplierAddress: "Jāņa iela 3-4, Tukums, LV3101",
    supplierBank: "A/S Industra Bank",
    supplierSwift: "MULTLV2X",
    supplierBankAccount: "LV87MULT1010B96770010",
    supplierEmail: "nils.valainis@gmail.com",
    supplierPhone: "+37126123193",
    recipientCompany: "AUTODNA Sp. z o.o.",
    recipientReg: "5492391545",
    recipientAddress: "Obywatelska 128/152, 94-104 Łódź, Polija",
  };
}

export async function createNextPkdCommissionInvoiceDraft(): Promise<PkdCommissionInvoiceDraft> {
  const now = new Date();
  const existing = await listPkdCommissionInvoiceDrafts();
  const metas = existing
    .map((d) => parseInvoiceNumberMeta(d.invoiceNumber))
    .filter((m): m is { year: number; seq: number } => m != null);
  const year = metas.length > 0 ? Math.max(...metas.map((m) => m.year)) : 2026;
  const seqs = metas.filter((m) => m.year === year).map((m) => m.seq);
  const seededLastSeq = year === 2026 ? 4 : 0;
  const maxSeq = Math.max(seededLastSeq, ...seqs, 0);
  const nextSeq = maxSeq + 1;
  const invoiceNumber = `PKD-${year}-${String(nextSeq).padStart(3, "0")}`;
  const id = invoiceNumber;
  const nowIso = now.toISOString();
  const draft: PkdCommissionInvoiceDraft = {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...defaultDraft(now, invoiceNumber),
  };
  await writeDraftFile(draft);
  return draft;
}

export async function updatePkdCommissionInvoiceDraft(
  id: string,
  input: PkdCommissionInvoiceInput,
): Promise<PkdCommissionInvoiceDraft | null> {
  if (!isSafePkdInvoiceId(id)) return null;
  const prev = await readDraftFile(id);
  if (!prev) return null;
  const draft: PkdCommissionInvoiceDraft = {
    ...prev,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeDraftFile(draft);
  return draft;
}
