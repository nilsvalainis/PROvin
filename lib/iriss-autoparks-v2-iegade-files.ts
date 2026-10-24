/**
 * Iegādes dokumentu faili (D2): tie paši faili, nevis kopijas - Loģistikas kabineta dokumenti (`c:`),
 * Autoparka v1 faili posmā Iegāde/Transports (`f:`) un numuru salīdzināšanas akts kā saite uz Servisa failu.
 */
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import { CABINET_DOC_TYPE_LABEL, type CabinetDocType, type CabinetDocument } from "@/lib/iriss-logistics-cabinet";

export type V2IegadeFile = {
  id: string;
  tag: string;
  title: string;
  date: string;
  contentType: string;
  /** Saite uz citas sadaļas failu (numuru akts no Servisa). */
  link: boolean;
  /** Ar roku pievienots/pārdēvējams/dzēšams dokuments (kabineta dokumenti; v1 faili - nē, J30 F1). */
  editable: boolean;
  /** CSDD nozīmīte - CSDD darbībām vajadzīgais oriģinālais dokuments (Car Invoice, J30 F4). */
  csddBadge: boolean;
  /** Kabineta dokumenta tips (pildspalvas tipa izvēlei, J61); v1/akts ierakstiem tukšs - nav maināms. */
  type: CabinetDocType | "";
};

/** Tipi, ko drīkst izvēlēties ar roku Iegādes dokumenta pildspalvā (sadaļas A apakškopa, bez Servisa rēķina). */
export const IEGADE_DOC_TYPE_OPTIONS: readonly CabinetDocType[] = ["other", "purchase_confirm", "car_invoice", "auction_invoice"];

/**
 * Auto1 dokumentu nosaukumi bieži nes valsts+veida kodu (piem. "NLPR.../DEPR..." - pasūtījuma
 * apstiprinājums, "DETRPHL..." vai tīri cipari "9xxxxxxxx" - Car Invoice), papildus parastiem
 * vārdiem ("invoice"/"rēķins", "order confirmation"/"apstiprinājums"). Labākā piepūle augšupielādes
 * brīdī - lietotājs jebkurā brīdī var pārlabot ar pildspalvu, ja uzminēts nepareizi.
 */
export function classifyIegadeDocType(fileName: string): CabinetDocType {
  // Faila nosaukumos atstarpes parasti ir "_"/"-"/"." - normalizē uz atstarpēm, lai \b robežas
  // strādātu arī "Car_Invoice_900123456.pdf" stilā, ne tikai "Car Invoice.pdf".
  const n = fileName.toLowerCase().replace(/[^a-z0-9āčēģīķļņōŗšūž]+/g, " ");
  if (/purchase ?confirm|order ?confirm|apstiprin[āa]jum|nlpr|depr/.test(n)) return "purchase_confirm";
  if (/auction ?invoice|izsoles ?r[ēe][ķk]ins/.test(n)) return "auction_invoice";
  if (/\bcar ?invoice\b|\binvoice\b|r[ēe][ķk]ins|detrphl|\b9\d{8}\b/.test(n)) return "car_invoice";
  return "other";
}

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
      editable: true,
      csddBadge: d.type === "car_invoice",
      type: d.type,
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
      editable: false,
      csddBadge: false,
      type: "",
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const act = input.numberCheckFileId ? input.v1Files.find((f) => f.id === input.numberCheckFileId && !f.deletedAt) : undefined;
  if (act) {
    out.push({
      id: `f:${act.id}`,
      tag: "Akts",
      title: "Numuru akts",
      date: act.createdAt.slice(0, 10),
      contentType: act.contentType,
      link: true,
      editable: false,
      csddBadge: false,
      type: "",
    });
  }
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

const AUTO1_REQUIRED_DOCS: readonly CabinetDocType[] = ["purchase_confirm", "car_invoice"];

/** Vai auto ir Auto1 izcelsmes - no izsoles lauka vai jau zināma dokumenta avota (J30 F4). */
export function isAuto1Car(input: { auction: string; cabinetDocs: readonly CabinetDocument[] }): boolean {
  if (input.auction.trim().toLowerCase() === "auto1") return true;
  return input.cabinetDocs.some((d) => !d.deletedAt && d.source.trim().toLowerCase() === "auto1");
}

/** Auto1 autiem jābūt tieši 2 obligātām PDF (Pirkuma apstiprinājums + Car Invoice) - trūkstošo etiķetes (J30 F4). */
export function auto1MissingDocLabels(input: { isAuto1: boolean; cabinetDocs: readonly CabinetDocument[] }): string[] {
  if (!input.isAuto1) return [];
  const live = input.cabinetDocs.filter((d) => !d.deletedAt);
  return AUTO1_REQUIRED_DOCS.filter((t) => !live.some((d) => d.type === t)).map((t) => CABINET_DOC_TYPE_LABEL[t]);
}
