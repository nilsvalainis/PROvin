/**
 * Iegādes dokumentu faili (D2): tie paši faili, nevis kopijas - Loģistikas kabineta dokumenti (`c:`),
 * Autoparka v1 faili posmā Iegāde/Transports (`f:`) un numuru salīdzināšanas akts kā saite uz Servisa failu.
 */
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import type { CabinetDocType, CabinetDocument } from "@/lib/iriss-logistics-cabinet";

export type V2IegadeFile = {
  id: string;
  tag: string;
  title: string;
  date: string;
  contentType: string;
  /** Saite uz citas sadaļas failu (numuru akts no Servisa). */
  link: boolean;
};

const CABINET_TYPES: readonly CabinetDocType[] = ["car_invoice", "auction_invoice", "purchase_confirm", "pickup_pdf", "cmr", "other"];

const TAG: Partial<Record<CabinetDocType, string>> = {
  car_invoice: "Rēķins",
  auction_invoice: "Rēķins",
  purchase_confirm: "Apstiprinājums",
  pickup_pdf: "Pickup",
  cmr: "CMR",
  other: "Dokuments",
};

const TITLE: Partial<Record<CabinetDocType, string>> = {
  car_invoice: "Car Invoice",
  auction_invoice: "Izsoles rēķins",
  pickup_pdf: "Pickup",
  cmr: "CMR",
};

export function iegadeFileList(input: {
  cabinetDocs: readonly CabinetDocument[];
  v1Files: readonly AutoparksFile[];
  numberCheckFileId: string;
}): V2IegadeFile[] {
  const out: V2IegadeFile[] = [];
  for (const d of input.cabinetDocs) {
    if (d.deletedAt || !d.blobPath || !CABINET_TYPES.includes(d.type)) continue;
    out.push({
      id: `c:${d.id}`,
      tag: TAG[d.type] ?? "Dokuments",
      title: d.title || TITLE[d.type] || d.typeLabel || "Dokuments",
      date: d.createdAt.slice(0, 10),
      contentType: "application/pdf",
      link: false,
    });
  }
  for (const f of input.v1Files) {
    if (f.deletedAt || (f.stage !== "purchase" && f.stage !== "transport")) continue;
    out.push({
      id: `f:${f.id}`,
      tag: f.stage === "transport" ? (/cmr/i.test(f.title) ? "CMR" : "Rēķins") : f.kind === "invoice" ? "Rēķins" : "Dokuments",
      title: f.title || "Dokuments",
      date: f.createdAt.slice(0, 10),
      contentType: f.contentType,
      link: false,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const act = input.numberCheckFileId ? input.v1Files.find((f) => f.id === input.numberCheckFileId && !f.deletedAt) : undefined;
  if (act) out.push({ id: `f:${act.id}`, tag: "Akts", title: "Numuru akts", date: act.createdAt.slice(0, 10), contentType: act.contentType, link: true });
  return out;
}

/** Pirkuma datums automātiski: pirmā izsoles/auto rēķina diena (ja nav ievadīts ar roku). */
export function purchaseDateFromDocs(docs: readonly CabinetDocument[]): string {
  const inv = docs
    .filter((d) => !d.deletedAt && (d.type === "car_invoice" || d.type === "auction_invoice" || d.type === "purchase_confirm"))
    .map((d) => d.createdAt.slice(0, 10))
    .filter(Boolean)
    .sort();
  return inv[0] ?? "";
}
