/**
 * j70: Piedāvājumu dzīves cikls un skati (tīra loģika, bez krātuves).
 * Melnraksts -> Nosūtīts -> Apstiprināts | Noraidīts | Beidzies termiņš; klienta pieprasītais sākas kā Pieprasīts.
 * Termiņš ir obligāts nosūtīšanai, bez noklusējuma. Beidzies automātiski pēc Rīgas dienas beigām.
 */

import { irissPdAuto1BlockCount, normalizeIrissPdAuto1Blocks, type IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import {
  defaultIrissPdContent,
  defaultIrissPdVisibility,
  emptyIrissPdClient,
  emptyIrissPdVehicle,
  IRISS_PD_BLOCK_IDS,
  IRISS_PD_BLOCK_LV,
  IRISS_PD_MAX_CHECK_ITEMS,
  IRISS_PD_MAX_HIGHLIGHTS,
  IRISS_PD_MAX_HISTORY,
  IRISS_PD_MAX_PHOTOS,
  IRISS_PD_OPEN_STATUSES,
  IRISS_PD_SOURCE_LV,
  IRISS_PD_STATUS_LV,
  IRISS_PD_TAKEN_STATUSES,
  irissPdNumberLabel,
  isIrissPdSource,
  isIrissPdStatus,
  isSafeIrissPdId,
  isSafeIrissPdToken,
  type IrissPdBlockId,
  type IrissPdCheckItem,
  type IrissPdClient,
  type IrissPdContent,
  type IrissPdHistoryEntry,
  type IrissPdListRow,
  type IrissPdPhoto,
  type IrissPdSource,
  type IrissPdStatus,
  type IrissPdToggle,
  type IrissPdVehicle,
  type IrissPdVisibility,
  type IrissPiedavajums,
} from "@/lib/iriss-piedavajumi-types";
import { formatIrissEurWhole, parsePriceLike } from "@/lib/iriss-price-format";
import { formatOfferValidUntilLv, normalizeOfferValidUntil, rigaLocalToUtcIso } from "@/lib/iriss-offer-valid-until";

export const IRISS_PD_SYSTEM_ACTOR = "Sistēma";
export const IRISS_PD_CLIENT_ACTOR = "Klients (piedāvājuma saite)";

const clean = (v: unknown, max = 400): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max = 4000): string => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/* ---------------- Normalizēšana ---------------- */

function normalizePhoto(raw: unknown): IrissPdPhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "dropbox" && typeof o.id === "string" && typeof o.ref === "string" && /^autoparks:[\w-]{1,80}$/.test(o.ref)) {
    const id = o.id.trim();
    return id && id.length <= 200 ? { kind: "dropbox", ref: o.ref, id } : null;
  }
  if (o.kind === "url" && typeof o.url === "string" && /^https:\/\//i.test(o.url.trim()) && o.url.length <= 2000) {
    return { kind: "url", url: o.url.trim() };
  }
  return null;
}

function normalizeToggle(raw: unknown, fallback: IrissPdToggle): IrissPdToggle {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    pdf: typeof o.pdf === "boolean" ? o.pdf : fallback.pdf,
    link: typeof o.link === "boolean" ? o.link : fallback.link,
  };
}

export function normalizeIrissPdVisibility(raw: unknown): IrissPdVisibility {
  const d = defaultIrissPdVisibility();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const blocksRaw = o.blocks && typeof o.blocks === "object" ? (o.blocks as Record<string, unknown>) : {};
  const blocks = { ...d.blocks };
  for (const id of IRISS_PD_BLOCK_IDS) blocks[id] = normalizeToggle(blocksRaw[id], d.blocks[id]);
  return { group: normalizeToggle(o.group, d.group), blocks };
}

function normalizeVehicle(raw: unknown): IrissPdVehicle {
  const d = emptyIrissPdVehicle();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const out = { ...d };
  for (const k of Object.keys(d) as Array<keyof IrissPdVehicle>) out[k] = clean(o[k], k === "title" ? 200 : 80);
  out.vin = out.vin.toUpperCase().replace(/\s+/g, "");
  return out;
}

function normalizeClient(raw: unknown): IrissPdClient {
  const d = emptyIrissPdClient();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const orderId = clean(o.orderId, 80);
  return {
    name: clean(o.name, 120),
    phone: clean(o.phone, 40),
    email: clean(o.email, 160),
    orderId: isSafeIrissPdId(orderId) ? orderId : "",
  };
}

function normalizeCheckItems(raw: unknown, fallback: readonly IrissPdCheckItem[]): IrissPdCheckItem[] {
  if (!Array.isArray(raw)) return fallback.map((x) => ({ ...x }));
  const out: IrissPdCheckItem[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const t = clean(o.text, 120);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push({ text: t, on: o.on === true });
    if (out.length >= IRISS_PD_MAX_CHECK_ITEMS) break;
  }
  return out;
}

function normalizeHighlights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const h of raw) {
    const t = clean(h, 80);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= IRISS_PD_MAX_HIGHLIGHTS) break;
  }
  return out;
}

/** j75: JSON bez `content` (pirms j75) -> šabloni, bet sadaļas klientam izslēgtas (sk. `defaultIrissPdContent`). */
export function normalizeIrissPdContent(raw: unknown): IrissPdContent {
  if (!raw || typeof raw !== "object") return defaultIrissPdContent(true);
  const o = raw as Record<string, unknown>;
  const d = defaultIrissPdContent();
  const flag = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  return {
    highlights: normalizeHighlights(o.highlights),
    highlightsOn: flag(o.highlightsOn, d.highlightsOn),
    included: normalizeCheckItems(o.included, d.included),
    excluded: normalizeCheckItems(o.excluded, d.excluded),
    summaryOn: flag(o.summaryOn, d.summaryOn),
    facts: normalizeCheckItems(o.facts, d.facts),
    visual: text(o.visual),
    technical: text(o.technical),
    note: text(o.note),
    assessmentOn: flag(o.assessmentOn, d.assessmentOn),
  };
}

function normalizeHistory(raw: unknown): IrissPdHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((h) => {
      if (!h || typeof h !== "object") return [];
      const o = h as Record<string, unknown>;
      const at = clean(o.at, 40);
      const t = clean(o.text, 300);
      return at && t ? [{ at, by: clean(o.by, 80) || IRISS_PD_SYSTEM_ACTOR, text: t }] : [];
    })
    .slice(-IRISS_PD_MAX_HISTORY);
}

export function normalizeIrissPiedavajums(raw: unknown): IrissPiedavajums | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isSafeIrissPdId(o.id)) return null;
  const photos = Array.isArray(o.photos) ? o.photos.map(normalizePhoto).filter((p): p is IrissPdPhoto => Boolean(p)).slice(0, IRISS_PD_MAX_PHOTOS) : [];
  const n = typeof o.number === "number" && Number.isFinite(o.number) ? Math.max(0, Math.floor(o.number)) : 0;
  const approvedOrderId = clean(o.approvedOrderId, 80);
  const basedOnId = clean(o.basedOnId, 80);
  return {
    id: o.id,
    number: n,
    status: isIrissPdStatus(o.status) ? o.status : "draft",
    createdAt: clean(o.createdAt, 40),
    updatedAt: clean(o.updatedAt, 40),
    source: isIrissPdSource(o.source) ? o.source : "manual",
    sourceRef: /^autoparks:[\w-]{1,80}$/.test(clean(o.sourceRef, 100)) ? clean(o.sourceRef, 100) : "",
    sourceUrl: /^https:\/\//i.test(clean(o.sourceUrl, 2000)) ? clean(o.sourceUrl, 2000) : "",
    sourceKey: clean(o.sourceKey, 80),
    importedFieldCount: typeof o.importedFieldCount === "number" && Number.isFinite(o.importedFieldCount) ? Math.max(0, Math.floor(o.importedFieldCount)) : 0,
    purchasePrice: clean(o.purchasePrice, 80),
    logisticsCost: clean(o.logisticsCost, 80),
    prepCost: clean(o.prepCost, 80),
    internalNotes: text(o.internalNotes),
    vehicle: normalizeVehicle(o.vehicle),
    photos,
    price: clean(o.price, 80),
    validUntil: normalizeOfferValidUntil(o.validUntil),
    client: normalizeClient(o.client),
    auto1: normalizeIrissPdAuto1Blocks(o.auto1),
    auto1ImportedAt: clean(o.auto1ImportedAt, 40),
    visibility: normalizeIrissPdVisibility(o.visibility),
    content: normalizeIrissPdContent(o.content),
    linkToken: isSafeIrissPdToken(o.linkToken) ? o.linkToken : "",
    decidedAt: clean(o.decidedAt, 40),
    approvedOrderId: isSafeIrissPdId(approvedOrderId) ? approvedOrderId : "",
    basedOnId: isSafeIrissPdId(basedOnId) ? basedOnId : "",
    history: normalizeHistory(o.history),
  };
}

/* ---------------- Vēsture, termiņš ---------------- */

export function appendIrissPdHistory(rec: IrissPiedavajums, entry: IrissPdHistoryEntry): IrissPiedavajums {
  return { ...rec, history: [...rec.history, { ...entry, text: entry.text.slice(0, 300) }].slice(-IRISS_PD_MAX_HISTORY) };
}

/** Termiņa beigas: Rīgas dienas beigas (23:59 + 1 min), ņemot vērā vasaras/ziemas laiku. */
export function irissPdDeadlineMs(rec: Pick<IrissPiedavajums, "validUntil">): number | null {
  if (!rec.validUntil) return null;
  const end = rigaLocalToUtcIso(rec.validUntil, "23:59");
  return end.ok ? end.ms + 60_000 : null;
}

export function isIrissPdDeadlinePassed(rec: Pick<IrissPiedavajums, "validUntil">, nowMs: number): boolean {
  const end = irissPdDeadlineMs(rec);
  return end != null && nowMs >= end;
}

/** Automātiska pāreja uz «Beidzies termiņš». null - nekas nemainās. */
export function applyIrissPdExpiry(rec: IrissPiedavajums, nowMs: number): IrissPiedavajums | null {
  if (!(IRISS_PD_OPEN_STATUSES as readonly string[]).includes(rec.status)) return null;
  if (!isIrissPdDeadlinePassed(rec, nowMs)) return null;
  const at = new Date(nowMs).toISOString();
  return appendIrissPdHistory(
    { ...rec, status: "expired", updatedAt: at },
    { at, by: IRISS_PD_SYSTEM_ACTOR, text: `Termiņš beidzies (${formatOfferValidUntilLv(rec.validUntil)})` },
  );
}

/* ---------------- Labojumi ---------------- */

export type IrissPdPatch = Partial<{
  vehicle: Partial<IrissPdVehicle>;
  price: string;
  validUntil: string;
  client: Partial<IrissPdClient>;
  purchasePrice: string;
  logisticsCost: string;
  prepCost: string;
  internalNotes: string;
  photos: IrissPdPhoto[];
  visibility: IrissPdVisibility;
  content: Partial<IrissPdContent>;
  status: IrissPdStatus;
}>;

/** Pēc apstiprināšanas/noraidīšanas/termiņa beigām mainīt drīkst tikai iekšējās piezīmes. */
export function isIrissPdEditable(status: IrissPdStatus): boolean {
  return (IRISS_PD_OPEN_STATUSES as readonly string[]).includes(status);
}

function priceLabel(raw: string): string {
  return raw.trim() ? formatIrissPdPrice(raw) : "-";
}

export function applyIrissPdPatch(
  rec: IrissPiedavajums,
  patch: IrissPdPatch,
  ctx: { by: string; at: string; nowMs: number },
): { ok: true; record: IrissPiedavajums } | { ok: false; error: string } {
  let next: IrissPiedavajums = { ...rec };
  const log: string[] = [];
  const editable = isIrissPdEditable(rec.status);
  const onlyNotes = Object.keys(patch).every((k) => k === "internalNotes");
  if (!editable && !onlyNotes) return { ok: false, error: "Šo piedāvājumu vairs nevar labot - izveido jaunu uz tā bāzes." };

  if (patch.vehicle) {
    const v = normalizeVehicle({ ...rec.vehicle, ...patch.vehicle });
    const changed = (Object.keys(v) as Array<keyof IrissPdVehicle>).filter((k) => v[k] !== rec.vehicle[k]);
    if (changed.length) {
      next.vehicle = v;
      log.push(`Auto dati laboti (${changed.length})`);
    }
  }
  if (typeof patch.price === "string") {
    const p = clean(patch.price, 80);
    if (p !== rec.price) {
      next.price = p;
      log.push(`Cena ${priceLabel(rec.price)} → ${priceLabel(p)}`);
    }
  }
  if (typeof patch.validUntil === "string") {
    const raw = patch.validUntil.trim();
    const v = normalizeOfferValidUntil(raw);
    if (raw && !v) return { ok: false, error: "Termiņš nav derīgs datums." };
    if (v !== rec.validUntil) {
      if (v && isIrissPdDeadlinePassed({ validUntil: v }, ctx.nowMs)) return { ok: false, error: "Termiņš nevar būt pagātnē." };
      next.validUntil = v;
      log.push(v ? `Termiņš iestatīts ${formatOfferValidUntilLv(v)}` : "Termiņš notīrīts");
    }
  }
  if (patch.client) {
    const c = normalizeClient({ ...rec.client, ...patch.client });
    if (JSON.stringify(c) !== JSON.stringify(rec.client)) {
      next.client = c;
      log.push(c.name ? `Klients: ${c.name}` : "Klients noņemts");
    }
  }
  if (typeof patch.purchasePrice === "string") {
    const p = clean(patch.purchasePrice, 80);
    if (p !== rec.purchasePrice) {
      next.purchasePrice = p;
      log.push("Iepirkuma cena mainīta");
    }
  }
  for (const [k, l] of [
    ["logisticsCost", "Loģistikas izmaksas"],
    ["prepCost", "Sagatavošanas izmaksas"],
  ] as const) {
    const raw = patch[k];
    if (typeof raw !== "string") continue;
    const v = clean(raw, 80);
    if (v !== rec[k]) {
      next[k] = v;
      log.push(`${l} mainītas`);
    }
  }
  if (patch.content && typeof patch.content === "object") {
    const c = normalizeIrissPdContent({ ...rec.content, ...patch.content });
    if (JSON.stringify(c) !== JSON.stringify(rec.content)) {
      next.content = c;
      log.push("Klienta apraksts mainīts");
    }
  }
  if (typeof patch.internalNotes === "string") {
    const n = text(patch.internalNotes);
    if (n !== rec.internalNotes) {
      next.internalNotes = n;
      log.push("Iekšējās piezīmes mainītas");
    }
  }
  if (Array.isArray(patch.photos)) {
    const photos = patch.photos.map(normalizePhoto).filter((p): p is IrissPdPhoto => Boolean(p)).slice(0, IRISS_PD_MAX_PHOTOS);
    // Drīkst tikai pārkārtot vai noņemt esošās bildes (jaunas pievieno imports).
    const known = new Set(rec.photos.map(photoKey));
    const kept = photos.filter((p) => known.has(photoKey(p)));
    if (JSON.stringify(kept) !== JSON.stringify(rec.photos)) {
      next.photos = kept;
      log.push(`Foto: ${kept.length}`);
    }
  }
  if (patch.visibility) {
    const v = normalizeIrissPdVisibility(patch.visibility);
    if (JSON.stringify(v) !== JSON.stringify(rec.visibility)) {
      next.visibility = v;
      log.push("Klienta redzamība mainīta");
    }
  }
  if (patch.status === "draft" || patch.status === "requested") {
    // Pieprasīts <-> Melnraksts ar roku (nosūtīšana tikai ar darbību «send»).
    if ((rec.status === "draft" || rec.status === "requested") && patch.status !== rec.status) {
      next.status = patch.status;
      log.push(`Statuss: ${IRISS_PD_STATUS_LV[patch.status]}`);
    }
  }
  if (log.length === 0) return { ok: true, record: rec };
  next.updatedAt = ctx.at;
  for (const t of log) next = appendIrissPdHistory(next, { at: ctx.at, by: ctx.by, text: t });
  return { ok: true, record: next };
}

export function photoKey(p: IrissPdPhoto): string {
  return p.kind === "dropbox" ? `d:${p.ref}:${p.id}` : `u:${p.url}`;
}

/* ---------------- Darbības ---------------- */

export type IrissPdAction = "send" | "revert" | "decline" | "approve";

export const IRISS_PD_ACTION_LV: Record<IrissPdAction, string> = {
  send: "Nosūtīt klientam",
  revert: "Atsaukt uz melnrakstu",
  decline: "Atzīmēt noraidītu",
  approve: "Atzīmēt apstiprinātu",
};

export function irissPdAvailableActions(status: IrissPdStatus): IrissPdAction[] {
  if (status === "requested" || status === "draft") return ["send", "decline", "approve"];
  if (status === "sent") return ["revert", "decline", "approve"];
  return [];
}

/** Ko trūkst nosūtīšanai (tukšs - var sūtīt). Klients, cena un foto nav obligāti (Q10). */
export function irissPdSendBlockers(rec: IrissPiedavajums, nowMs: number): string[] {
  const out: string[] = [];
  if (!rec.vehicle.title.trim()) out.push("Nav modeļa nosaukuma.");
  if (!rec.validUntil) out.push("Termiņš ir obligāts (bez noklusējuma) - ievadi to.");
  else if (isIrissPdDeadlinePassed(rec, nowMs)) out.push("Termiņš ir pagātnē.");
  return out;
}

export function applyIrissPdAction(
  rec: IrissPiedavajums,
  action: IrissPdAction,
  ctx: { by: string; at: string; nowMs: number; newToken: () => string },
): { ok: true; record: IrissPiedavajums } | { ok: false; error: string } {
  if (!irissPdAvailableActions(rec.status).includes(action)) {
    return { ok: false, error: `Statusā «${IRISS_PD_STATUS_LV[rec.status]}» šī darbība nav pieejama.` };
  }
  const base = { ...rec, updatedAt: ctx.at };
  if (action === "send") {
    const blockers = irissPdSendBlockers(rec, ctx.nowMs);
    if (blockers.length) return { ok: false, error: blockers.join(" ") };
    const who = rec.client.name ? ` klientam ${rec.client.name}` : "";
    return {
      ok: true,
      record: appendIrissPdHistory(
        { ...base, status: "sent", linkToken: rec.linkToken || ctx.newToken() },
        { at: ctx.at, by: ctx.by, text: `Nosūtīts${who} (līdz ${formatOfferValidUntilLv(rec.validUntil)})` },
      ),
    };
  }
  if (action === "revert") {
    return { ok: true, record: appendIrissPdHistory({ ...base, status: "draft" }, { at: ctx.at, by: ctx.by, text: "Atsaukts uz melnrakstu (saite klientam nav pieejama)" }) };
  }
  if (action === "decline") {
    return { ok: true, record: appendIrissPdHistory({ ...base, status: "declined", decidedAt: ctx.at }, { at: ctx.at, by: ctx.by, text: "Atzīmēts kā noraidīts" }) };
  }
  return { ok: true, record: appendIrissPdHistory({ ...base, status: "approved", decidedAt: ctx.at }, { at: ctx.at, by: ctx.by, text: "Apstiprināts" }) };
}

/** «Izveidot jaunu uz šī bāzes»: no beigušā vai noraidītā. Termiņš tukšs - jāievada no jauna. */
export function canRebaseIrissPd(status: IrissPdStatus): boolean {
  return status === "expired" || status === "declined";
}

export function rebaseIrissPd(
  base: IrissPiedavajums,
  input: { id: string; number: number; at: string; by: string },
): IrissPiedavajums {
  const rec: IrissPiedavajums = {
    ...base,
    id: input.id,
    number: input.number,
    status: "draft",
    createdAt: input.at,
    updatedAt: input.at,
    validUntil: "",
    linkToken: "",
    decidedAt: "",
    approvedOrderId: "",
    basedOnId: base.id,
    history: [],
    vehicle: { ...base.vehicle },
    client: { ...base.client },
    photos: base.photos.map((p) => ({ ...p })),
    visibility: normalizeIrissPdVisibility(base.visibility),
    content: normalizeIrissPdContent(base.content),
  };
  return appendIrissPdHistory(rec, { at: input.at, by: input.by, text: `Izveidots uz ${irissPdNumberLabel(base.number)} bāzes` });
}

/* ---------------- 1 auto = 1 piedāvājums ---------------- */

export type IrissPdCarIdentity = { sourceRef?: string; source?: IrissPdSource; sourceKey?: string; vin?: string };

function sameCar(row: Pick<IrissPdListRow, "sourceRef" | "source" | "sourceKey" | "vin">, car: IrissPdCarIdentity): boolean {
  if (car.sourceRef && row.sourceRef === car.sourceRef) return true;
  if (car.source && car.sourceKey && row.source === car.source && row.sourceKey.toUpperCase() === car.sourceKey.toUpperCase()) return true;
  const vin = (car.vin ?? "").trim().toUpperCase();
  return vin.length === 17 && row.vin.toUpperCase() === vin;
}

/** Aktīvs (nav beidzies/noraidīts) piedāvājums tam pašam auto vai null. */
export function findIrissPdTakenConflict(
  rows: readonly IrissPdListRow[],
  car: IrissPdCarIdentity,
  excludeId = "",
): IrissPdListRow | null {
  return rows.find((r) => r.id !== excludeId && (IRISS_PD_TAKEN_STATUSES as readonly string[]).includes(r.status) && sameCar(r, car)) ?? null;
}

export function irissPdConflictMessage(row: IrissPdListRow): string {
  return `Šim auto jau ir piedāvājums ${irissPdNumberLabel(row.number)} (${IRISS_PD_STATUS_LV[row.status]}). 1 auto = 1 piedāvājums.`;
}

/* ---------------- Saraksts ---------------- */

export function irissPdToListRow(rec: IrissPiedavajums): IrissPdListRow {
  return {
    id: rec.id,
    number: rec.number,
    status: rec.status,
    title: rec.vehicle.title,
    vin: rec.vehicle.vin,
    clientName: rec.client.name,
    clientOrderId: rec.client.orderId,
    source: rec.source,
    sourceRef: rec.sourceRef,
    sourceKey: rec.sourceKey,
    hasAuto1: Boolean(rec.auto1),
    price: rec.price,
    validUntil: rec.validUntil,
    approvedOrderId: rec.approvedOrderId,
    cover: rec.photos[0] ?? null,
    updatedAt: rec.updatedAt,
  };
}

export function normalizeIrissPdListRow(raw: unknown): IrissPdListRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isSafeIrissPdId(o.id)) return null;
  const cover = normalizePhoto(o.cover);
  return {
    id: o.id,
    number: typeof o.number === "number" && Number.isFinite(o.number) ? o.number : 0,
    status: isIrissPdStatus(o.status) ? o.status : "draft",
    title: clean(o.title, 200),
    vin: clean(o.vin, 40),
    clientName: clean(o.clientName, 120),
    clientOrderId: isSafeIrissPdId(o.clientOrderId) ? o.clientOrderId : "",
    source: isIrissPdSource(o.source) ? o.source : "manual",
    sourceRef: clean(o.sourceRef, 100),
    sourceKey: clean(o.sourceKey, 80),
    hasAuto1: o.hasAuto1 === true,
    price: clean(o.price, 80),
    validUntil: normalizeOfferValidUntil(o.validUntil),
    approvedOrderId: isSafeIrissPdId(o.approvedOrderId) ? o.approvedOrderId : "",
    cover,
    updatedAt: clean(o.updatedAt, 40),
  };
}

/** Rāda arī «Beidzies termiņš», ja indeksā vēl nav pārrakstīts (lasīšanas laikā). */
export function irissPdRowEffectiveStatus(row: Pick<IrissPdListRow, "status" | "validUntil">, nowMs: number): IrissPdStatus {
  if ((IRISS_PD_OPEN_STATUSES as readonly string[]).includes(row.status) && isIrissPdDeadlinePassed(row, nowMs)) return "expired";
  return row.status;
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type IrissPdListFilter = { status: IrissPdStatus | "all"; source: IrissPdSource | "all"; query: string };

export function filterIrissPdRows(rows: readonly IrissPdListRow[], f: IrissPdListFilter, nowMs: number): IrissPdListRow[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.status !== "all" && irissPdRowEffectiveStatus(r, nowMs) !== f.status) return false;
    if (f.source !== "all" && r.source !== f.source) return false;
    if (words.length === 0) return true;
    const hay = fold(`${r.title} ${r.vin} ${r.clientName} ${irissPdNumberLabel(r.number)} ${IRISS_PD_SOURCE_LV[r.source]}`);
    return words.every((w) => hay.includes(w));
  });
}

export function countIrissPdByStatus(rows: readonly IrissPdListRow[], nowMs: number): Record<IrissPdStatus | "all", number> {
  const out = { all: rows.length, requested: 0, draft: 0, sent: 0, approved: 0, declined: 0, expired: 0 };
  for (const r of rows) out[irissPdRowEffectiveStatus(r, nowMs)] += 1;
  return out;
}

/** Jaunākie augšā; Pieprasīts vienmēr pirmie (tos jāaizpilda). */
export function sortIrissPdRows(rows: readonly IrissPdListRow[]): IrissPdListRow[] {
  return [...rows].sort((a, b) => {
    const ra = a.status === "requested" ? 0 : 1;
    const rb = b.status === "requested" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return b.number - a.number;
  });
}

/** Q13 «Badge?» vēl atvērts: šis skaitlis ir gatavs sānjoslas zīmei, bet netiek rādīts. */
export function irissPdBadgeCount(rows: readonly IrissPdListRow[], nowMs: number): number {
  return rows.filter((r) => irissPdRowEffectiveStatus(r, nowMs) === "requested").length;
}

/* ---------------- Formatēšana ---------------- */

export function formatIrissPdPrice(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (!/\d/.test(t)) return t;
  const n = parsePriceLike(t);
  return n > 0 ? formatIrissEurWhole(n) : t;
}

/** Marža = gala cena - iepirkuma cena - izmaksas (loģistika, sagatavošana; tukšās neskaita). Tikai, ja cena un iepirkums ir skaitļi. */
export function irissPdMargin(price: string, purchase: string, ...costs: string[]): string {
  if (!/\d/.test(price) || !/\d/.test(purchase)) return "";
  const p = parsePriceLike(price);
  const c = parsePriceLike(purchase);
  if (!(p > 0) || !(c > 0)) return "";
  const extra = costs.reduce((sum, x) => {
    const n = /\d/.test(x) ? parsePriceLike(x) : 0;
    return sum + (n > 0 ? n : 0);
  }, 0);
  return formatIrissEurWhole(p - c - extra);
}

export function splitIrissPdClientName(name: string): { first: string; last: string } {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  // Uzņēmumiem (SIA ...) viss nosaukums vārda laukā.
  if (/^(sia|as|ik|zs|ps|biedrība|uab|oü|gmbh)$/i.test(parts[0]!)) return { first: parts.join(" "), last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1]! };
}

/* ---------------- Klienta skats ---------------- */

export type IrissPdViewMode = "link" | "pdf";

export function irissPdBlockVisible(vis: IrissPdVisibility, id: IrissPdBlockId, mode: IrissPdViewMode): boolean {
  return vis.group[mode] && vis.blocks[id][mode];
}

export type IrissPdPublicFact = { label: string; value: string };

export type IrissPdPublicView = {
  /** open - var apstiprināt; approved - jau apstiprināts; closed - nav pieejams (nav vai beidzies). */
  state: "open" | "approved" | "closed";
  title: string;
  price: string;
  validUntilLabel: string;
  facts: IrissPdPublicFact[];
  /** Bilžu skaits (bildes tikai caur `/p/d/<token>/foto/<n>`). */
  photoCount: number;
  blocks: Partial<{ [K in IrissPdBlockId]: true }>;
  auto1: IrissPdAuto1Blocks | null;
  /** Bez klienta - apstiprinot jāieraksta vārds un tālrunis. */
  needsContact: boolean;
  /** j75: Aprīkojums, Kopsavilkums, Novērtējums (tikai ieslēgtās sadaļas un ieķeksētās rindas). */
  content: IrissPdPublicContent | null;
};

export type IrissPdPublicContent = {
  highlights: string[];
  included: string[];
  excluded: string[];
  facts: string[];
  visual: string;
  technical: string;
  note: string;
};

/** Klientam: tikai ieslēgtās sadaļas; null - nav ko rādīt. */
export function buildIrissPdPublicContent(c: IrissPdContent): IrissPdPublicContent | null {
  const on = (items: IrissPdCheckItem[]) => items.filter((x) => x.on).map((x) => x.text);
  const out: IrissPdPublicContent = {
    highlights: c.highlightsOn ? [...c.highlights] : [],
    included: c.summaryOn ? on(c.included) : [],
    excluded: c.summaryOn ? on(c.excluded) : [],
    facts: c.assessmentOn ? on(c.facts) : [],
    visual: c.assessmentOn ? c.visual : "",
    technical: c.assessmentOn ? c.technical : "",
    note: c.assessmentOn ? c.note : "",
  };
  const any = Object.values(out).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  return any ? out : null;
}

const FACT_LABELS: Array<[keyof IrissPdVehicle, string]> = [
  ["year", "Gads"],
  ["firstRegistration", "Pirmā reģistrācija"],
  ["mileageKm", "Nobraukums"],
  ["fuel", "Degviela"],
  ["transmission", "Ātrumkārba"],
  ["powerKw", "Jauda"],
  ["engine", "Tilpums"],
  ["color", "Krāsa"],
  ["body", "Virsbūve"],
  ["vin", "VIN"],
  ["location", "Atrašanās vieta"],
];

function factValue(k: keyof IrissPdVehicle, v: string): string {
  if (k === "mileageKm" && /^\d[\d\s.,]*$/.test(v)) return `${v.replace(/[\s.,]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
  if (k === "powerKw" && /^\d{2,4}$/.test(v)) return `${v} kW`;
  return v;
}

export function irissPdFactValue(facts: readonly IrissPdPublicFact[], label: string): string {
  return facts.find((f) => f.label === label)?.value.trim() ?? "";
}

/** Kompakts apakšvirsraksts kā `/p/`: gads · nobraukums · ātrumkārba. */
export function irissPdSubtitle(facts: readonly IrissPdPublicFact[]): string {
  return [irissPdFactValue(facts, "Pirmā reģistrācija") || irissPdFactValue(facts, "Gads"), irissPdFactValue(facts, "Nobraukums"), irissPdFactValue(facts, "Ātrumkārba")]
    .filter(Boolean)
    .join(" · ");
}

/** Admina slēpto, bet datos esošo bloku etiķetes (tukšos nerāda). */
export function irissPdHiddenBlockLabels(rec: IrissPiedavajums, mode: IrissPdViewMode): string[] {
  const a = rec.auto1;
  if (!a) return [];
  return IRISS_PD_BLOCK_IDS.filter((id) => irissPdAuto1BlockCount(a, id) > 0 && !irissPdBlockVisible(rec.visibility, id, mode)).map(
    (id) => IRISS_PD_BLOCK_LV[id],
  );
}

export function irissPdDeleteConfirm(label: string): string {
  return `Vai tiešām dzēst piedāvājumu ${label}? Publiskā saite vairs nestrādās. Šo nevar atsaukt.`;
}

/**
 * Klienta skats: tikai baltais saraksts. Nekad: avots, izsoles saite/atslēga, iepirkuma cena,
 * iekšējās piezīmes, klienta kontakti, pasūtījumu id, tokens.
 */
export function buildIrissPdPublicView(rec: IrissPiedavajums, mode: IrissPdViewMode, nowMs: number): IrissPdPublicView {
  const expired = isIrissPdDeadlinePassed(rec, nowMs);
  const state: IrissPdPublicView["state"] =
    rec.status === "approved" ? "approved" : rec.status === "sent" && !expired ? "open" : "closed";
  const blocks: IrissPdPublicView["blocks"] = {};
  const a = rec.auto1;
  if (a) {
    for (const id of IRISS_PD_BLOCK_IDS) {
      if (irissPdBlockVisible(rec.visibility, id, mode) && irissPdAuto1BlockCount(a, id) > 0) blocks[id] = true;
    }
  }
  const auto1: IrissPdAuto1Blocks | null = a
    ? {
        paint: blocks.paint ? a.paint : null,
        tech: blocks.tech ? a.tech : [],
        equipment: blocks.equipment ? a.equipment : [],
        service: blocks.equipment ? a.service : [],
        inspection: blocks.equipment ? a.inspection : [],
        damage: blocks.damage ? a.damage : [],
        vinData: blocks.vin ? a.vinData : [],
      }
    : null;
  return {
    state,
    title: rec.vehicle.title,
    price: formatIrissPdPrice(rec.price),
    validUntilLabel: rec.validUntil ? formatOfferValidUntilLv(rec.validUntil) : "",
    facts: FACT_LABELS.flatMap(([k, label]) => (rec.vehicle[k] ? [{ label, value: factValue(k, rec.vehicle[k]) }] : [])),
    photoCount: rec.photos.length,
    blocks,
    auto1,
    needsContact: !rec.client.name.trim() && !rec.client.orderId,
    content: buildIrissPdPublicContent(rec.content),
  };
}

/* ---------------- Izveide no Autoparka ---------------- */

export type IrissPdCarPick = { id: string; title: string; vinTail: string; plate: string; search: string; takenBy: string };

/**
 * Autoparka auto izvēlei. Arhivētie un pārdotie netiek rādīti; auto ar aktīvu piedāvājumu nav izvēlams (1 auto = 1 piedāvājums).
 */
export function irissPdCarPicks(
  cars: ReadonlyArray<{ id: string; make: string; model: string; vin: string; plate: string; status: string; archivedAt: string; displayName?: string }>,
  rows: readonly IrissPdListRow[],
): IrissPdCarPick[] {
  return cars
    .filter((c) => !c.archivedAt && c.status !== "sold")
    .map((c) => {
      const title = clean(c.displayName) || clean(`${c.make} ${c.model}`) || clean(c.vin);
      const vin = clean(c.vin).toUpperCase();
      const taken = findIrissPdTakenConflict(rows, { sourceRef: `autoparks:${c.id}`, vin });
      return {
        id: c.id,
        title,
        vinTail: vin.slice(-6),
        plate: clean(c.plate),
        search: fold(`${title} ${c.make} ${c.model} ${vin} ${c.plate} ${c.plate.replace(/[\s-]/g, "")}`),
        takenBy: taken ? irissPdNumberLabel(taken.number) : "",
      };
    })
    .filter((r) => r.title);
}

export function filterIrissPdCarPicks(rows: readonly IrissPdCarPick[], query: string): IrissPdCarPick[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...rows];
  return rows.filter((r) => words.every((w) => r.search.includes(w)));
}

/* ---------------- Klienta izvēle (IRISS pasūtījumu klienti) ---------------- */

export type IrissPdClientOption = { orderId: string; name: string; sub: string; phone: string; email: string; search: string };

export function irissPdClientOptions(
  rows: ReadonlyArray<{ id: string; deletedAt?: string; clientFirstName: string; clientLastName: string; phone: string; email?: string; brandModel: string; updatedAt: string }>,
): IrissPdClientOption[] {
  return rows
    .filter((r) => !r.deletedAt)
    .map((r) => {
      const name = clean(`${r.clientFirstName} ${r.clientLastName}`) || clean(r.phone);
      return {
        orderId: r.id,
        name,
        sub: clean(r.brandModel),
        phone: clean(r.phone),
        email: clean(r.email ?? ""),
        search: fold(`${name} ${r.phone} ${r.phone.replace(/\D/g, "")} ${r.brandModel}`),
        at: r.updatedAt,
      };
    })
    .filter((o) => o.name)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((o) => ({ orderId: o.orderId, name: o.name, sub: o.sub, phone: o.phone, email: o.email, search: o.search }));
}

export function filterIrissPdClientOptions(rows: readonly IrissPdClientOption[], query: string, limit = 8): IrissPdClientOption[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return rows.slice(0, limit);
  return rows.filter((r) => words.every((w) => r.search.includes(w))).slice(0, limit);
}
