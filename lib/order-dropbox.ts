import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import { getOrderDraftBlobConfig, getOrderDraftStorageDir, isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { DropboxApiError, getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import {
  orderDropboxFolderName,
  orderDropboxNameWithCategory,
  orderDropboxParentPath,
  orderDropboxShouldRename,
  parseOrderDropboxRecord,
  type OrderDropboxCategory,
  type OrderDropboxRecord,
} from "@/lib/order-dropbox-folder";

/**
 * PROVIN pasūtījuma Dropbox mape (servera puse): izveide uzreiz pēc pasūtījuma, pārdēvēšana, kad zināma marka/modelis,
 * failu saglabāšana. Nekad neizmet kļūdu uz augšu - pasūtījums neapstājas; kļūda paliek ierakstā (admin rāda sarkanā).
 * Ieraksts: {draft dir|blob prefix}/order_dropbox/<sessionId>.json
 */

const LOG = "[order-dropbox]";
const DIR = "order_dropbox";

/**
 * Ieraksts + vai lasīšana izdevās. `readError` - krātuve neatbildēja (nevis "nav ieraksta"): tad jaunu mapi NEVEIDO,
 * citādi pārejoša Blob kļūda radītu otru mapi ar citu nosaukumu (marka jau zināma) un pārrakstītu ierakstu.
 */
export async function readOrderDropboxRecordResult(
  sessionId: string,
): Promise<{ record: OrderDropboxRecord | null; readError: boolean }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { record: null, readError: false };
  const file = `${DIR}/${sessionId}.json`;
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${file}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return { record: parseOrderDropboxRecord(JSON.parse(await new Response(res.stream).text())), readError: false };
      }
      // `get` atgriež null tikai 404 gadījumā - ieraksta nav.
      if (!res) return { record: null, readError: false };
    } catch (e) {
      if (process.env.VERCEL === "1") {
        console.warn(`${LOG} record read failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
        return { record: null, readError: true };
      }
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return { record: parseOrderDropboxRecord(JSON.parse(await fs.readFile(path.join(dir, file), "utf8"))), readError: false };
    } catch {
      /* nav ieraksta */
    }
  }
  return { record: null, readError: false };
}

export async function readOrderDropboxRecord(sessionId: string): Promise<OrderDropboxRecord | null> {
  return (await readOrderDropboxRecordResult(sessionId)).record;
}

async function writeRecord(rec: OrderDropboxRecord): Promise<void> {
  const file = `${DIR}/${rec.sessionId}.json`;
  const body = JSON.stringify(rec);
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${file}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return;
    } catch (e) {
      if (process.env.VERCEL === "1") throw e;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return;
  const fp = path.join(dir, file);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

type CarParts = { make: string; model: string; plate: string; vin: string };

async function carFromDraft(sessionId: string, fallback: { vin?: string | null; plate?: string | null }): Promise<CarParts> {
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  const reg = csdd.registry?.data;
  const [makeFromForm, ...modelParts] = (csdd.makeModel ?? "").trim().split(/\s+/);
  const vinOrPlate = (fallback.vin ?? "").trim();
  return {
    make: (reg?.make || makeFromForm || "").trim(),
    model: (reg?.model || modelParts.join(" ") || "").trim(),
    plate: (reg?.registrationNumber || csdd.registrationNumber || draft?.orderEdits?.licensePlate || fallback.plate || vinOrPlate || "").trim(),
    vin: (reg?.vin || csdd.vin || draft?.orderEdits?.vin || vinOrPlate || "").trim(),
  };
}

function errCode(e: unknown): string {
  if (e instanceof DropboxApiError) return `dropbox_${e.status}${e.summary ? `:${e.summary.slice(0, 80)}` : ""}`;
  return e instanceof Error ? e.message.slice(0, 120) : "unknown";
}

/**
 * Izveido (vai atrod) pasūtījuma mapi un, ja parādījusies marka/modelis/VIN, pārdēvē to. Idempotenti.
 * `category` vajag pirmajā reizē (pēc tam ņem no ieraksta). Atgriež ierakstu vai null (nav kategorijas / Dropbox).
 */
export async function ensureOrderDropboxFolder(
  sessionId: string,
  opts: {
    category?: OrderDropboxCategory | null;
    createdMs?: number;
    vin?: string | null;
    plate?: string | null;
    client?: DropboxClient | null;
    /** Produkts mainījies (manuālais pasūtījums: AUDITI -> BUSINESS): `category` ir noteicošā, esošo mapi pārvieto. */
    recategorize?: boolean;
  } = {},
): Promise<OrderDropboxRecord | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const { record: prev, readError } = await readOrderDropboxRecordResult(sessionId);
  // Nevar nolasīt ierakstu - nezinām, vai mape jau ir. Labāk šoreiz neko nedarīt nekā izveidot otru mapi.
  if (readError) return null;
  const category = (opts.recategorize ? opts.category : null) ?? prev?.category ?? opts.category ?? null;
  if (!category) return null;
  const now = new Date().toISOString();
  const orderCreatedMs = prev?.orderCreatedMs ?? opts.createdMs ?? Date.now();
  const base: OrderDropboxRecord = {
    sessionId,
    category,
    state: prev?.state ?? "error",
    ...(prev?.folderId ? { folderId: prev.folderId } : {}),
    ...(prev?.path ? { path: prev.path } : {}),
    orderCreatedMs,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  const client = opts.client === undefined ? getDropboxClient() : opts.client;
  if (!client) {
    if (prev?.state === "ok") return prev;
    const rec = { ...base, state: "error" as const, error: "not_configured" };
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
  try {
    const car = await carFromDraft(sessionId, opts);
    const desiredName = orderDropboxFolderName({ sessionId, category, createdMs: orderCreatedMs, ...car });
    const parent = orderDropboxParentPath(category);
    if (prev?.state === "ok" && prev.folderId) {
      const meta = await client.getMetadata(prev.folderId);
      if (meta && meta.tag === "folder") {
        let current = meta.pathDisplay || prev.path || "";
        // Produkta maiņa: tā pati mape (ar visiem failiem) uz citu virsmapi - nevis otra mape.
        const categoryChange = prev.category !== category;
        let finalCategory = category;
        // Jaunajā virsmapē nosaukums nedrīkst kļūt nabadzīgāks (marka / VIN, kas jau bija nosaukumā, paliek).
        const swapped = categoryChange ? orderDropboxNameWithCategory(meta.name, prev.category, category) : meta.name;
        const targetName = orderDropboxShouldRename(swapped, desiredName) ? desiredName : swapped;
        if (categoryChange || targetName !== meta.name) {
          try {
            const moved = await client.move(current, `${parent}/${targetName}`, { autorename: false });
            current = moved.pathDisplay || `${parent}/${targetName}`;
          } catch (e) {
            // Ja tāda mape jau ir (cits pasūtījums ar to pašu auto un dienu) - paliek vecais nosaukums / virsmape.
            if (categoryChange) finalCategory = prev.category;
            console.warn(`${LOG} ${categoryChange ? "move" : "rename"} skipped`, { sessionId: sessionId.slice(-8), error: errCode(e) });
          }
        }
        if (current === prev.path && finalCategory === prev.category) return prev;
        const rec = { ...base, category: finalCategory, state: "ok" as const, path: current };
        delete (rec as Partial<OrderDropboxRecord>).error;
        await writeRecord(rec);
        return rec;
      }
      // Mape izdzēsta vai pārvietota ārpus Dropbox - izveido no jauna.
    }
    const entry = await client.ensureFolder(`${parent}/${desiredName}`);
    const rec: OrderDropboxRecord = { ...base, state: "ok", folderId: entry.id || undefined, path: entry.pathDisplay || `${parent}/${desiredName}` };
    delete rec.error;
    await writeRecord(rec);
    return rec;
  } catch (e) {
    console.error(`${LOG} ensure failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    // Kategoriju maina tikai pēc veiksmīgas pārvietošanas - nākamreiz mēģina vēlreiz.
    const rec = {
      ...base,
      category: prev?.category ?? category,
      state: prev?.state === "ok" ? ("ok" as const) : ("error" as const),
      error: errCode(e),
    };
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
}

/**
 * Fails pasūtījuma mapē. Tas pats nosaukums otrreiz netiek dublēts (`add` bez autorename -> konflikts = jau ir).
 * Atgriež Dropbox ceļu vai null (kļūda ierakstīta logā; pasūtījums neapstājas).
 */
export async function saveFileToOrderDropboxFolder(
  sessionId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<{ path: string; duplicate: boolean } | null> {
  const client = getDropboxClient();
  if (!client) return null;
  const rec = await ensureOrderDropboxFolder(sessionId, { client });
  if (!rec || rec.state !== "ok" || !rec.path) return null;
  const name = sanitizeDropboxName(fileName, 140) || "fails.pdf";
  const target = `${rec.path}/${name}`;
  try {
    const up = await client.upload(target, bytes, "add", { autorename: false });
    return { path: up.pathDisplay || target, duplicate: false };
  } catch (e) {
    if (e instanceof DropboxApiError && e.conflict) return { path: target, duplicate: true };
    console.error(`${LOG} upload failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return null;
  }
}

/**
 * Produkts mainījies pēc mapes izveides (manuālais pasūtījums kļūst par Business / Dīlera datiem): esošo mapi
 * pārvieto uz pareizo virsmapi. Ja ieraksta nav (vecie pasūtījumi) vai kategorija tā pati - neko nedara.
 */
export async function moveOrderDropboxFolderToCategory(
  sessionId: string,
  category: OrderDropboxCategory,
  client?: DropboxClient | null,
): Promise<OrderDropboxRecord | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const { record, readError } = await readOrderDropboxRecordResult(sessionId);
  if (readError || !record) return null;
  if (record.category === category) return record;
  return ensureOrderDropboxFolder(sessionId, { category, recategorize: true, ...(client !== undefined ? { client } : {}) });
}

/** Pēc apmaksas / izveides: tikai fona solis, kļūda neaptur pasūtījumu. */
export function ensureOrderDropboxFolderSafe(
  sessionId: string,
  opts: Parameters<typeof ensureOrderDropboxFolder>[1],
): Promise<void> {
  return ensureOrderDropboxFolder(sessionId, opts).then(
    () => undefined,
    (e) => console.error(`${LOG} ensure crashed`, e instanceof Error ? e.message.slice(0, 120) : "unknown"),
  );
}

/**
 * Fails pasūtījuma mapē visiem avotiem (CarVertical, AutoDNA, LTAB, CARFAX, atskaites PDF kopija):
 *  - pasūtījumam ir mapes ieraksts (jaunie, no 23.11) -> TIKAI tā mape (`AUDITI/...`, `DILERA DATI/...`);
 *    ja saglabāt neizdodas - kļūda (nevis otra mape `/_PROv` saknē);
 *  - ieraksta nav (vecie pasūtījumi) -> `legacy()` (mape pēc VIN `/_PROv` saknē kā līdz šim).
 */
export async function saveFileToOrderFolderOrLegacy<T extends { path: string }>(
  sessionId: string,
  fileName: string,
  bytes: Uint8Array,
  legacy: () => Promise<T>,
): Promise<{ path: string; duplicate: boolean; legacy: boolean }> {
  const { record, readError } = isSafeOrderDraftSessionId(sessionId)
    ? await readOrderDropboxRecordResult(sessionId)
    : { record: null, readError: false };
  if (readError) throw new Error("order_dropbox_record_unreadable");
  if (record) {
    const saved = await saveFileToOrderDropboxFolder(sessionId, fileName, bytes);
    if (!saved) throw new Error("order_dropbox_save_failed");
    return { ...saved, legacy: false };
  }
  const saved = await legacy();
  return { path: saved.path, duplicate: false, legacy: true };
}
