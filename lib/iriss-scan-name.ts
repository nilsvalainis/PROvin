/**
 * Radara ieraksta «Nosaukums» (lauks `brandModel`).
 *
 * Nils 14.11: ja operators nosaukumu nav rakstījis ar roku, to aizpilda no strukturētajiem
 * kritērijiem (marka + modelis, piem. «Audi A6»). Kad operators nosaukumu labo ar roku
 * (`nameManual`), automātika to vairs nepārraksta.
 *
 * Vecie ieraksti: nosaukums bez `nameManual`, kas nesakrīt ar ģenerēto, skaitās operatora
 * rakstīts - glabātuvē nekas netiek pārrakstīts.
 */
import { irissScanCriteriaView } from "@/lib/iriss-scan-criteria";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export const IRISS_SCAN_NAME_LABEL = "Nosaukums" as const;

type NameInput = Pick<IrissScanRecord, "brandModel" | "productionYears" | "engineType" | "transmission" | "bodyType"> &
  Partial<Pick<IrissScanRecord, "nameManual" | "criteria">>;

/** Nosaukums no strukturētajiem kritērijiem: «Audi A6», «Audi A4, A6». Bez kritērijiem - tukšs. */
export function irissScanAutoName(rec: NameInput): string {
  const view = irissScanCriteriaView(rec);
  return [view.make.trim(), view.models.trim()].filter(Boolean).join(" ");
}

/** Vai nosaukums ir automātisks (drīkst pārrakstīt no kritērijiem). */
export function irissScanNameIsAuto(rec: NameInput): boolean {
  if (rec.nameManual === true) return false;
  const name = rec.brandModel.trim();
  return !name || name === irissScanAutoName(rec);
}

/**
 * Kritēriju izmaiņa (`next`) pēc iepriekšējā stāvokļa (`prev`): automātisku nosaukumu
 * atjauno no markas + modeļa; manuāli rakstītu atstāj.
 */
export function applyIrissScanAutoName(prev: IrissScanRecord, next: IrissScanRecord): IrissScanRecord {
  if (!irissScanNameIsAuto(prev)) return next;
  const auto = irissScanAutoName(next);
  if (auto === next.brandModel) return next;
  return { ...next, brandModel: auto };
}

/** Operators raksta nosaukumu ar roku. Notīrīts nosaukums atgriežas pie automātikas. */
export function applyIrissScanNameEdit(rec: IrissScanRecord, value: string): IrissScanRecord {
  const next: IrissScanRecord = { ...rec, brandModel: value };
  if (value.trim()) next.nameManual = true;
  else delete next.nameManual;
  return next;
}

/** Rādīšanai: saglabātais nosaukums vai (ja tukšs) ģenerētais no kritērijiem. */
export function irissScanDisplayName(rec: NameInput): string {
  return rec.brandModel.trim() || irissScanAutoName(rec);
}

/**
 * «Kopīgot saiti»: Radaram nav publiskas saites un nav klienta - kopē admin saiti uz ierakstu.
 * Nesaglabātam ierakstam saites nav.
 */
export function irissScanShareHref(origin: string, persistId: string): string {
  const id = persistId.trim();
  if (!id) return "";
  return `${origin.replace(/\/+$/, "")}/admin/iriss/scan/${encodeURIComponent(id)}`;
}

export const IRISS_SCAN_SHARE_COPIED = "Saite nokopēta" as const;
