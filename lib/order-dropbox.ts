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
 * PROVIN pasūtījuma Dropbox mape (servera puse): izveide uzreiz pēc pasūtījuma (AUDITS / MINI / BUSINESS; dīlera
 * datiem - pie pirmā saglabātā faila, Nils 27.11), pārdēvēšana, kad zināma marka/modelis,
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
    /** Izveidot mapi arī dīlera datiem (tikai faila saglabāšana - Nils 27.11: dīlera datiem mapi neveido uzreiz). */
    materialize?: boolean;
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
  // Dīlera dati (Nils 27.11): mape NEtiek veidota pie pasūtījuma ienākšanas - tikai ieraksts `pending` (kategorija,
  // datums), lai pirmais saglabātais fails (dīlera PDF, CheckThisReg, CSDD PDF) izveidotu pareizo mapi DILERA DATI/...
  if (category === "dealer" && !opts.materialize && !(prev?.state === "ok" && prev.folderId)) {
    const vin = (opts.vin ?? "").trim() || prev?.vin;
    const plate = (opts.plate ?? "").trim() || prev?.plate;
    if (prev?.state === "pending" && prev.category === category && prev.vin === vin && prev.plate === plate) return prev;
    const rec: OrderDropboxRecord = { ...base, state: "pending", ...(vin ? { vin } : {}), ...(plate ? { plate } : {}) };
    delete rec.folderId;
    delete rec.path;
    delete rec.error;
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
  const client = opts.client === undefined ? getDropboxClient() : opts.client;
  if (!client) {
    if (prev?.state === "ok") return prev;
    const rec = { ...base, state: "error" as const, error: "not_configured" };
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
  try {
    const car = await carFromDraft(sessionId, {
      vin: (opts.vin ?? "").trim() || prev?.vin || null,
      plate: (opts.plate ?? "").trim() || prev?.plate || null,
    });
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
            // Paralēls izsaukums (LTAB + CSDD + dīlera dati vienlaikus) var mapi jau būt pārdēvējis: tad `current`
            // ir novecojis ceļš - augšupielāde uz to izveidotu otru mapi ar veco nosaukumu (Nils 26.11, 540i).
            const fresh = await client.getMetadata(prev.folderId).catch(() => null);
            if (fresh && fresh.tag === "folder" && fresh.pathDisplay) current = fresh.pathDisplay;
            const movedByOther = current.toLowerCase().startsWith(`${parent.toLowerCase()}/`);
            if (categoryChange && !movedByOther) finalCategory = prev.category;
            console.warn(`${LOG} ${categoryChange ? "move" : "rename"} skipped`, {
              sessionId: sessionId.slice(-8),
              error: errCode(e),
              ...(fresh?.pathDisplay && fresh.pathDisplay !== meta.pathDisplay ? { movedByOther: true } : {}),
            });
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
  const rec = await ensureOrderDropboxFolder(sessionId, { client, materialize: true });
  if (!rec || rec.state !== "ok" || !rec.path) return null;
  const name = sanitizeDropboxName(fileName, 140) || "fails.pdf";
  const folder = await currentOrderDropboxFolderPath(client, rec);
  const target = `${folder}/${name}`;
  try {
    const up = await client.upload(target, bytes, "add", { autorename: false });
    const finalPath = await keepFileInOrderFolder(client, rec, folder, up.pathDisplay || target, sessionId);
    return { path: finalPath, duplicate: false };
  } catch (e) {
    if (e instanceof DropboxApiError && e.conflict) return { path: target, duplicate: true };
    console.error(`${LOG} upload failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return null;
  }
}

/**
 * Pasūtījuma mapes ceļš TAGAD (pēc mapes id). Ieraksta `path` var būt novecojis, ja mapi tikko pārdēvēja paralēls
 * izsaukums; augšupielāde uz veco ceļu Dropbox klusām izveidotu otru mapi ar veco nosaukumu.
 */
export async function currentOrderDropboxFolderPath(client: DropboxClient, rec: OrderDropboxRecord): Promise<string> {
  if (rec.folderId) {
    const meta = await client.getMetadata(rec.folderId).catch(() => null);
    if (meta && meta.tag === "folder" && meta.pathDisplay) return meta.pathDisplay;
  }
  return rec.path ?? "";
}

function parentDir(p: string): string {
  const i = p.lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "";
}

/**
 * Pēc augšupielādes: ja mapi tieši tobrīd pārdēvēja (fails nonāca jaunizveidotā mapē ar veco nosaukumu),
 * fails tiek pārcelts uz īsto mapi, un tukšā liekā mape - uz Dropbox atkritni (atjaunojama). Atgriež faila ceļu.
 */
export async function keepFileInOrderFolder(
  client: DropboxClient,
  rec: OrderDropboxRecord,
  usedFolder: string,
  filePath: string,
  sessionId: string,
): Promise<string> {
  if (!rec.folderId) return filePath;
  const now = await currentOrderDropboxFolderPath(client, rec);
  if (!now || now.toLowerCase() === usedFolder.toLowerCase()) return filePath;
  try {
    const moved = await client.move(filePath, `${now}/${filePath.slice(filePath.lastIndexOf("/") + 1)}`, { autorename: true });
    const stray = parentDir(filePath);
    if (stray && stray.toLowerCase() !== now.toLowerCase()) {
      const left = await client.listFolder(stray).catch(() => null);
      if (left && left.entries.length === 0 && !left.hasMore) await client.deleteFile(stray).catch(() => undefined);
    }
    console.warn(`${LOG} file moved into renamed folder`, { sessionId: sessionId.slice(-8) });
    return moved.pathDisplay || filePath;
  } catch (e) {
    console.error(`${LOG} move into folder failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return filePath;
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

/**
 * PDF lejupielāde pēc statusā saglabātā Dropbox ceļa ar rezervi: ja pa šo ceļu faila vairs nav (dubultmapes apvienotas,
 * mape pārdēvēta), meklē to pašu faila nosaukumu pasūtījuma kanoniskajā mapē (pēc mapes id / `order_dropbox` ieraksta).
 * Statusu nemaina - tikai lasa. null - fails nav atrasts nevienā vietā.
 */
export async function downloadOrderDropboxFile(
  client: DropboxClient,
  sessionId: string,
  storedPath: string,
): Promise<{ bytes: Uint8Array; path: string; fallback: boolean } | null> {
  const stored = storedPath.trim();
  if (!stored) return null;
  try {
    const { bytes } = await client.download(stored);
    return { bytes: new Uint8Array(bytes), path: stored, fallback: false };
  } catch (e) {
    if (!(e instanceof DropboxApiError && e.notFound)) throw e;
  }
  const name = stored.slice(stored.lastIndexOf("/") + 1);
  if (!name || !isSafeOrderDraftSessionId(sessionId)) return null;
  const { record } = await readOrderDropboxRecordResult(sessionId);
  if (!record || record.state !== "ok") return null;
  const folder = await currentOrderDropboxFolderPath(client, record);
  if (!folder) return null;
  const candidate = `${folder}/${name}`;
  if (candidate.toLowerCase() === stored.toLowerCase()) return null;
  try {
    const { bytes } = await client.download(candidate);
    console.info(`${LOG} file found in order folder`, { sessionId: sessionId.slice(-8) });
    return { bytes: new Uint8Array(bytes), path: candidate, fallback: true };
  } catch (e) {
    if (e instanceof DropboxApiError && e.notFound) return null;
    throw e;
  }
}
