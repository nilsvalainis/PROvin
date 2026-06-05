import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import { repairPaidOrderInvoiceNumbers } from "@/lib/invoice-sequence-repair";

const COUNTER_FILENAME = "invoice-year-sequence.json";
const REPAIR_FLAG_FILENAME = "invoice-sequence-repaired-v1.json";
const META_DIRNAME = "_meta";

type CounterData = Record<string, number>;

function counterBlobPathname(prefix: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}${META_DIRNAME}/${COUNTER_FILENAME}`;
}

function repairFlagBlobPathname(prefix: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}${META_DIRNAME}/${REPAIR_FLAG_FILENAME}`;
}

function counterFilesystemPath(base: string): string {
  return path.join(base, META_DIRNAME, COUNTER_FILENAME);
}

function repairFlagFilesystemPath(base: string): string {
  return path.join(base, META_DIRNAME, REPAIR_FLAG_FILENAME);
}

function parseCounterJson(raw: string): CounterData {
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return {};
    const out: CounterData = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

async function readCounterFromBlob(prefix: string, token: string): Promise<CounterData> {
  try {
    const res = await get(counterBlobPathname(prefix), {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return {};
    const text = await new Response(res.stream).text();
    return parseCounterJson(text);
  } catch {
    return {};
  }
}

async function writeCounterToBlob(prefix: string, token: string, data: CounterData): Promise<void> {
  await put(counterBlobPathname(prefix), JSON.stringify(data), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readRepairFlagFromBlob(prefix: string, token: string): Promise<boolean> {
  try {
    const res = await get(repairFlagBlobPathname(prefix), {
      access: "private",
      token,
      useCache: false,
    });
    return Boolean(res && res.statusCode === 200);
  } catch {
    return false;
  }
}

async function writeRepairFlagToBlob(prefix: string, token: string): Promise<void> {
  await put(repairFlagBlobPathname(prefix), JSON.stringify({ repairedAt: new Date().toISOString() }), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readCounterFromFilesystem(base: string): Promise<CounterData> {
  try {
    const raw = await fs.readFile(counterFilesystemPath(base), "utf8");
    return parseCounterJson(raw);
  } catch {
    return {};
  }
}

async function writeCounterToFilesystem(base: string, data: CounterData): Promise<void> {
  const fp = counterFilesystemPath(base);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), "utf8");
  await fs.rename(tmp, fp);
}

async function readRepairFlagFromFilesystem(base: string): Promise<boolean> {
  try {
    await fs.access(repairFlagFilesystemPath(base));
    return true;
  } catch {
    return false;
  }
}

async function writeRepairFlagToFilesystem(base: string): Promise<void> {
  const fp = repairFlagFilesystemPath(base);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify({ repairedAt: new Date().toISOString() }), "utf8");
}

let repairOncePromise: Promise<CounterData> | null = null;

/** Vienreiz salabo vēsturiskos dublikātus un sinhronizē skaitītāju (Stripe apmaksātie pēc datuma). */
async function ensureInvoiceSequenceRepairedOnce(): Promise<CounterData> {
  if (!repairOncePromise) {
    repairOncePromise = (async () => {
      const blob = getOrderDraftBlobConfig();
      const base = getOrderDraftStorageDir();
      const alreadyRepaired =
        blob ?
          await readRepairFlagFromBlob(blob.prefix, blob.token)
        : base ?
          await readRepairFlagFromFilesystem(base)
        : true;
      if (alreadyRepaired) {
        if (blob) return readCounterFromBlob(blob.prefix, blob.token);
        if (base) return readCounterFromFilesystem(base);
        return {};
      }

      const counter = await repairPaidOrderInvoiceNumbers();
      if (blob) {
        await writeCounterToBlob(blob.prefix, blob.token, counter);
        await writeRepairFlagToBlob(blob.prefix, blob.token);
      } else if (base) {
        await writeCounterToFilesystem(base, counter);
        await writeRepairFlagToFilesystem(base);
      }
      console.info("[invoice-counter] repaired invoice sequence", counter);
      return counter;
    })().catch((e) => {
      repairOncePromise = null;
      throw e;
    });
  }
  return repairOncePromise;
}

/** Admin / webhook fons — nebloķē klienta rēķina lejupielādi. */
export function triggerInvoiceSequenceRepairInBackground(): void {
  void ensureInvoiceSequenceRepairedOnce().catch((e) => {
    console.error("[invoice-counter] background repair failed", e);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Atomiski palielina gada secības skaitītāju un atgriež nākamo numuru (1…).
 * Produkcijā skaitītājs glabājas Vercel Blob (`_meta/invoice-year-sequence.json`), nevis /tmp.
 */
export async function nextInvoiceSequenceForYear(year: number): Promise<number> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const data = await readCounterFromBlob(blob.prefix, blob.token);
      const next = (data[String(year)] ?? 0) + 1;
      data[String(year)] = next;
      try {
        await writeCounterToBlob(blob.prefix, blob.token, data);
        return next;
      } catch (e) {
        if (attempt === 7) throw e;
        await sleep(40 * (attempt + 1));
      }
    }
    throw new Error("invoice_counter_blob_failed");
  }

  const base = getOrderDraftStorageDir();
  if (!base) {
    throw new Error("invoice_counter_no_storage");
  }

  const fp = counterFilesystemPath(base);
  await fs.mkdir(path.dirname(fp), { recursive: true });

  let data: CounterData = {};
  try {
    const raw = await fs.readFile(fp, "utf8");
    data = parseCounterJson(raw);
  } catch {
    /* jauna datne */
  }

  const key = String(year);
  const next = (data[key] ?? 0) + 1;
  data[key] = next;

  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), "utf8");
  await fs.rename(tmp, fp);

  return next;
}
