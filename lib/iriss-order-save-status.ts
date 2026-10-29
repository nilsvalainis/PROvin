/**
 * Nils 29.10 «Saglabāt … neuzticos»: drošā saglabāšana pasūtījumam.
 * - galvenē redzams patiesais stāvoklis (nevis vienmēr «Saglabāts»);
 * - klusā saglabāšana, ja neizdodas, mēģina vēlreiz pati;
 * - nesaglabātās izmaiņas glabājas arī pārlūkā, lai pēc avārijas / aizvērtas cilnes tās var atjaunot.
 */

import type { IrissOfferAttachment, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissOrderSaveKind = "saved" | "pending" | "saving" | "error" | "offline";

export type IrissOrderSaveStatus = { kind: IrissOrderSaveKind; label: string };

export function irissOrderSaveStatus(input: {
  dirty: boolean;
  saving: boolean;
  error: string | null;
  offline: boolean;
  savedTime: string;
}): IrissOrderSaveStatus {
  if (input.saving) return { kind: "saving", label: "Saglabā..." };
  if (input.dirty && input.offline) return { kind: "offline", label: "Nav interneta - saglabāsies vēlāk" };
  if (input.dirty && input.error) return { kind: "error", label: "Nav saglabāts - mēģināt vēlreiz" };
  if (input.dirty) return { kind: "pending", label: "Nesaglabātas izmaiņas" };
  const t = input.savedTime.trim();
  return { kind: "saved", label: t ? `Saglabāts ${t}` : "Saglabāts" };
}

/** Kļūdas, kuras atkārtot nav jēgas (konfliktu rāda josla, tukšu ierakstu nesūta, rinda jau notiks). */
export function irissAutosaveShouldRetry(error: string): boolean {
  const e = error.trim();
  if (!e) return false;
  if (e === "empty_record" || e === "Saglabāšana rindā." || e === "Ielādē attēlus.") return false;
  if (/stale|konflikt/i.test(e)) return false;
  return true;
}

const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000];

/** 1. mēģinājums pēc 3 s, tad 10 s, 30 s, tālāk ik minūti. */
export function irissAutosaveRetryDelayMs(attempt: number): number {
  const i = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Math.floor(attempt)));
  return RETRY_DELAYS_MS[i]!;
}

/* ---------- Rezerves kopija pārlūkā ---------- */

export const IRISS_ORDER_BACKUP_PREFIX = "iriss-order-backup:";
/** Vecākas kopijas nepiedāvā (dati, visticamāk, jau sen mainīti citur). */
export const IRISS_ORDER_BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BACKUP_MAX_CHARS = 1_500_000;

export type IrissOrderBackup = { v: 1; at: string; rec: IrissPasutijumsRecord };

type KvStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function irissOrderBackupKey(id: string): string {
  return `${IRISS_ORDER_BACKUP_PREFIX}${id}`;
}

function attachmentForBackup(att: IrissOfferAttachment): IrissOfferAttachment | null {
  // Vēl neaugšupielādēta bilde ir tikai base64 - pārlūka krātuvē neietilpst, to neglabā.
  if (!att.blobPath?.trim()) return null;
  const next: IrissOfferAttachment = { ...att, dataUrl: "" };
  delete next.thumbDataUrl;
  return next;
}

/**
 * Kopija bez bilžu baitiem: foto albumi netiek glabāti vispār (atjaunojot paliek servera),
 * piedāvājumu pielikumiem tikai jau saglabātās atsauces.
 */
export function irissOrderRecordForBackup(rec: IrissPasutijumsRecord): IrissPasutijumsRecord {
  const { inspectionPhotos: _i, documentPhotos: _d, ...rest } = rec;
  void _i;
  void _d;
  return {
    ...rest,
    offers: rec.offers.map((o) => ({
      ...o,
      attachments: o.attachments.map(attachmentForBackup).filter((a): a is IrissOfferAttachment => a !== null),
    })),
  } as IrissPasutijumsRecord;
}

export function writeIrissOrderBackup(storage: KvStorage, rec: IrissPasutijumsRecord, now: Date): boolean {
  if (!rec.id) return false;
  try {
    const raw = JSON.stringify({ v: 1, at: now.toISOString(), rec: irissOrderRecordForBackup(rec) } satisfies IrissOrderBackup);
    if (raw.length > BACKUP_MAX_CHARS) return false;
    storage.setItem(irissOrderBackupKey(rec.id), raw);
    return true;
  } catch {
    return false;
  }
}

export function clearIrissOrderBackup(storage: KvStorage, id: string): void {
  try {
    storage.removeItem(irissOrderBackupKey(id));
  } catch {
    /* privātais režīms u.c. */
  }
}

export function readIrissOrderBackup(storage: KvStorage, id: string, now: Date): IrissOrderBackup | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(irissOrderBackupKey(id));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IrissOrderBackup>;
    if (parsed?.v !== 1 || typeof parsed.at !== "string" || !parsed.rec || parsed.rec.id !== id) return null;
    const at = Date.parse(parsed.at);
    if (!Number.isFinite(at) || now.getTime() - at > IRISS_ORDER_BACKUP_MAX_AGE_MS) return null;
    return parsed as IrissOrderBackup;
  } catch {
    return null;
  }
}

function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

/** Vai kopijā ir kas tāds, kā serverī nav (salīdzina bez bilžu baitiem un servera tehniskajiem laukiem). */
export function irissOrderBackupDiffers(backup: IrissPasutijumsRecord, server: IrissPasutijumsRecord): boolean {
  const strip = (r: IrissPasutijumsRecord) => {
    const { updatedAt: _u, workspaceRevision: _w, fieldUpdatedAt: _f, ...rest } = irissOrderRecordForBackup(r);
    void _u;
    void _w;
    void _f;
    return stableJson(rest);
  };
  return strip(backup) !== strip(server);
}

/** «29.10. 13:11» kopijas laikam (Rīgas laiks). */
export function formatIrissBackupTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}. ${get("hour")}:${get("minute")}`;
}
