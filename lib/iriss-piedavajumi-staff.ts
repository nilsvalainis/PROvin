/**
 * P4 (Nils 20.11, makets «Viena piedāvājuma forma»): darbinieki ar sadaļu Pasūtījumi veido un labo jauno PD,
 * bet neredz iekšējās summas un avotu (1A - izsoles saite tikai adminam). Tīra loģika (bez servera atkarībām):
 *   - maskēšana API atbildēs (ieraksts un saraksta rindas),
 *   - PATCH sanitizācija (darbinieks nevar mainīt slēptos laukus),
 *   - tiesības: labo tikai savus PD (2A «Mani» / «Visi» - citus tikai skatīt).
 * Darbinieks redz PVN režīmu un «Klientam kopā» un var tos labot.
 */

import type { IrissPdAction, IrissPdPatch } from "@/lib/iriss-piedavajumi";
import type { IrissPdListRow, IrissPdPhoto, IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { ENV_ADMIN_USER_ID, type IrissSection } from "@/lib/staff-roles";

export type IrissPdViewer =
  | { kind: "admin"; id: typeof ENV_ADMIN_USER_ID; name: string }
  | { kind: "staff"; id: string; name: string; sections: readonly IrissSection[] };

/** Lauki, kurus darbinieks neredz un nevar mainīt. */
export const IRISS_PD_STAFF_HIDDEN_FIELDS = [
  "purchasePrice",
  "logisticsCost",
  "prepCost",
  "commission",
  "internalNotes",
  "sourceUrl",
  "sourceKey",
] as const satisfies ReadonlyArray<keyof IrissPiedavajums>;

/** PATCH lauki, ko darbinieks drīkst sūtīt (viss pārējais tiek izmests). */
export const IRISS_PD_STAFF_PATCH_KEYS = [
  "vehicle",
  "price",
  "validUntil",
  "client",
  "vatMode",
  "photos",
  "visibility",
  "content",
  "equipmentSummaryLv",
  "status",
] as const satisfies ReadonlyArray<keyof IrissPdPatch>;

/**
 * Darbības savam PD. «Atzīmēt apstiprinātu» un «Izveidot pasūtījumu» paliek adminam (rezervē Autoparka auto);
 * klienta apstiprinājums saitē strādā kā līdz šim.
 */
export const IRISS_PD_STAFF_ACTIONS: readonly IrissPdAction[] = ["send", "revert", "decline", "reopen"];

/** Izsoles bildes adrese (avots) darbiniekam aizstāta ar indeksu; PATCH to atpakaļ pārvērš (`unmaskStaffPhotos`). */
const MASKED_PHOTO_RE = /^https:\/\/pd\.invalid\/p\/(\d{1,3})$/;

export function maskedIrissPdPhotoUrl(index: number): string {
  return `https://pd.invalid/p/${index}`;
}

function maskPhoto(p: IrissPdPhoto, index: number): IrissPdPhoto {
  return p.kind === "url" ? { kind: "url", url: maskedIrissPdPhotoUrl(index) } : p;
}

/** Vēstures tekstos izsoles numurs («Nr. 12345») - darbiniekam bez tā. */
function maskHistoryText(text: string): string {
  return text.replace(/,?\s*Nr\.\s*[\w-]+/g, "");
}

/** `getAdminOrStaffActor()` -> skatītājs (strukturāls tips, lai modulis paliek bez servera atkarībām). */
export function irissPdViewerFromActor(
  actor: { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; name: string; sections: readonly IrissSection[] } },
): IrissPdViewer {
  if (actor.kind === "admin") return { kind: "admin", id: ENV_ADMIN_USER_ID, name: actor.name || "Admins" };
  return { kind: "staff", id: actor.user.id, name: actor.user.name || "Darbinieks", sections: actor.user.sections };
}

export function isIrissPdStaffViewer(viewer: IrissPdViewer): viewer is Extract<IrissPdViewer, { kind: "staff" }> {
  return viewer.kind === "staff";
}

/** Ieraksts darbiniekam: bez iekšējām summām, avota saites, izsoles numura un iekšējām piezīmēm. */
export function maskIrissPdForStaff(rec: IrissPiedavajums): IrissPiedavajums {
  return {
    ...rec,
    purchasePrice: "",
    logisticsCost: "",
    prepCost: "",
    commission: "",
    internalNotes: "",
    sourceUrl: "",
    sourceKey: "",
    photos: rec.photos.map(maskPhoto),
    history: rec.history.map((h) => ({ ...h, text: maskHistoryText(h.text) })),
  };
}

export function maskIrissPdRowForStaff(row: IrissPdListRow): IrissPdListRow {
  const rest: IrissPdListRow = { ...row, sourceKey: "", cover: row.cover ? maskPhoto(row.cover, 0) : null };
  delete rest.sourceUrl;
  return rest;
}

export function irissPdForViewer(rec: IrissPiedavajums, viewer: IrissPdViewer): IrissPiedavajums {
  return viewer.kind === "admin" ? rec : maskIrissPdForStaff(rec);
}

export function irissPdRowsForViewer(rows: readonly IrissPdListRow[], viewer: IrissPdViewer): IrissPdListRow[] {
  return viewer.kind === "admin" ? [...rows] : rows.map(maskIrissPdRowForStaff);
}

/** Maskētās bildes -> īstās (pēc indeksa ierakstā). Nezināmās izsoles adreses darbinieks pievienot nevar. */
function unmaskStaffPhotos(photos: unknown, rec: IrissPiedavajums): IrissPdPhoto[] | undefined {
  if (!Array.isArray(photos)) return undefined;
  const out: IrissPdPhoto[] = [];
  for (const raw of photos) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (p.kind === "url") {
      const m = typeof p.url === "string" ? MASKED_PHOTO_RE.exec(p.url) : null;
      const real = m ? rec.photos[Number(m[1])] : undefined;
      if (real && real.kind === "url") out.push(real);
      continue;
    }
    out.push(raw as IrissPdPhoto);
  }
  return out;
}

/**
 * Darbinieka PATCH: tikai atļautie lauki; iepirkuma cena, izmaksas, komisija, iekšējās piezīmes un avots
 * tiek izmesti (pat ja klients tos atsūta).
 */
export function sanitizeIrissPdPatchForStaff(patch: unknown, rec: IrissPiedavajums): IrissPdPatch {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  const src = patch as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of IRISS_PD_STAFF_PATCH_KEYS) {
    if (!(k in src)) continue;
    if (k === "photos") {
      const photos = unmaskStaffPhotos(src.photos, rec);
      if (photos) out.photos = photos;
      continue;
    }
    out[k] = src[k];
  }
  return out as IrissPdPatch;
}

/** Vai skatītājs drīkst labot šo PD (admins - visus; darbinieks - tikai savus). */
export function irissPdViewerCanEdit(rec: Pick<IrissPiedavajums, "createdById">, viewer: IrissPdViewer): boolean {
  if (viewer.kind === "admin") return true;
  return Boolean(rec.createdById) && rec.createdById === viewer.id;
}

export function irissPdViewerCanAct(rec: Pick<IrissPiedavajums, "createdById">, viewer: IrissPdViewer, action: string): boolean {
  if (viewer.kind === "admin") return true;
  if (!irissPdViewerCanEdit(rec, viewer)) return false;
  return (IRISS_PD_STAFF_ACTIONS as readonly string[]).includes(action);
}

/** Dzēst: admins visus; darbinieks savus, kas nav apstiprināti (apstiprināts = rezervēts pasūtījums). */
export function irissPdViewerCanDelete(rec: Pick<IrissPiedavajums, "createdById" | "status">, viewer: IrissPdViewer): boolean {
  if (viewer.kind === "admin") return true;
  return irissPdViewerCanEdit(rec, viewer) && rec.status !== "approved";
}

/** Auto no Autoparka / Loģistikas darbiniekam - tikai ar attiecīgo sadaļu (tāpat kā vecās formas avoti). */
export function irissPdViewerCanUseStock(viewer: IrissPdViewer, kind: "autoparks" | "logistics"): boolean {
  if (viewer.kind === "admin") return true;
  return viewer.sections.includes(kind === "autoparks" ? "ap_pamatdati" : "logistika");
}

export type IrissPdListScope = "mine" | "all";

/** 2A: darbiniekam pēc noklusējuma «Mani» (veidotājs = viņš), slēdzis «Visi». Admins redz visus. */
export function irissPdRowsInScope(rows: readonly IrissPdListRow[], viewerId: string, scope: IrissPdListScope): IrissPdListRow[] {
  if (scope === "all") return [...rows];
  return rows.filter((r) => Boolean(r.createdById) && r.createdById === viewerId);
}

/** «Veidoja» kolonnai: iniciāļi (vecajiem bez autora - administrators). */
export function irissPdCreatorInitials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
