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
  /** Grupa cilnē «Dokumenti» (Nils 27.10). */
  group: IegadeDocGroup;
};

/** Nils 27.10: dokumenti grupās, lai vieglāk orientēties. */
export const IEGADE_DOC_GROUPS = ["pirkums", "transports", "csdd", "citi"] as const;
export type IegadeDocGroup = (typeof IEGADE_DOC_GROUPS)[number];
export const IEGADE_DOC_GROUP_LV: Record<IegadeDocGroup, string> = {
  pirkums: "Pirkums",
  transports: "Transports",
  csdd: "CSDD un serviss",
  citi: "Citi",
};

export function iegadeDocGroupOfType(type: CabinetDocType | ""): IegadeDocGroup {
  if (type === "car_invoice" || type === "auction_invoice" || type === "purchase_confirm") return "pirkums";
  if (type === "pickup_pdf" || type === "cmr" || type === "transport_request_confirm" || type === "transport_invoice") return "transports";
  if (type === "csdd_status" || type === "service_invoice") return "csdd";
  return "citi";
}

/** Grupas secībā; tukšās netiek atgrieztas. */
export function groupIegadeFiles(files: readonly V2IegadeFile[]): Array<{ group: IegadeDocGroup; files: Array<{ file: V2IegadeFile; index: number }> }> {
  return IEGADE_DOC_GROUPS.map((group) => ({
    group,
    files: files.map((file, index) => ({ file, index })).filter((x) => x.file.group === group),
  })).filter((g) => g.files.length > 0);
}

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

/**
 * Tips attēlošanai un pārbaudei: vecie dokumenti ar tipu "other" (augšupielādēti pirms automātiskās
 * klasifikācijas) tiek atpazīti pēc nosaukuma; saglabātie dati netiek mainīti (Nils 27.10, 390 px pārskats).
 */
export function effectiveCabinetDocType(d: Pick<CabinetDocument, "type" | "title" | "blobPath">): CabinetDocType {
  if (d.type !== "other") return d.type;
  const name = `${d.title} ${d.blobPath.split("/").pop() ?? ""}`;
  return classifyIegadeDocType(name);
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
  for (const raw of input.cabinetDocs) {
    if (raw.deletedAt || !raw.blobPath || !CABINET_TYPES.includes(raw.type)) continue;
    const d = { ...raw, type: effectiveCabinetDocType(raw) };
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
      group: iegadeDocGroupOfType(d.type),
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
      group: f.stage === "transport" ? "transports" : f.kind === "invoice" ? "pirkums" : "citi",
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  dedupeIegadeFiles(out);
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
      group: "csdd",
    });
  }
  return out;
}

const fileKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/\.(pdf|jpe?g|png|heic)$/i, "")
    .replace(/\(\d+\)$/, "")
    .replace(/[\s_.()-]+/g, "");

/**
 * Nils 28.10: «dokumentu sadaļā dažiem auto ir Car Invoice dublikāts». Tas pats fails bija gan Loģistikas
 * kabinetā (c:), gan vecajos Autoparka failos (f:), dažreiz f: divreiz. Rāda vienu - Loģistikas dokumentu;
 * ja kabinetā jau ir Car Invoice, vecā kopija netiek rādīta. Dati netiek dzēsti.
 */
export function dedupeIegadeFiles(files: V2IegadeFile[]): void {
  const cabinetFirst = [...files].sort((a, b) => Number(b.id.startsWith("c:")) - Number(a.id.startsWith("c:")));
  const seen = new Set<string>();
  const drop = new Set<V2IegadeFile>();
  const hasCabinetCarInvoice = files.some((f) => f.id.startsWith("c:") && f.type === "car_invoice");
  for (const f of cabinetFirst) {
    const key = `${f.group}|${fileKey(f.title)}`;
    if (seen.has(key)) drop.add(f);
    else seen.add(key);
    if (hasCabinetCarInvoice && f.id.startsWith("f:") && f.group === "pirkums" && /car[\s_-]?invoice/i.test(f.title)) drop.add(f);
  }
  for (let i = files.length - 1; i >= 0; i--) if (drop.has(files[i]!)) files.splice(i, 1);
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

/** Nils 27.10: Auto1 autiem obligāts tikai Car Invoice (Pirkuma apstiprinājums vairs netiek prasīts). */
const AUTO1_REQUIRED_DOCS: readonly CabinetDocType[] = ["car_invoice"];

/** Vai auto ir Auto1 izcelsmes - no izsoles lauka vai jau zināma dokumenta avota (J30 F4). */
export function isAuto1Car(input: { auction: string; cabinetDocs: readonly CabinetDocument[] }): boolean {
  if (input.auction.trim().toLowerCase() === "auto1") return true;
  return input.cabinetDocs.some((d) => !d.deletedAt && d.source.trim().toLowerCase() === "auto1");
}

/**
 * Auto1 autiem obligāts Car Invoice - trūkstošo etiķetes (J30 F4, Nils 27.10).
 * Rēķins, kas pievienots Dokumentos kā fails grupā "Pirkums", arī skaitās.
 */
export function auto1MissingDocLabels(input: {
  isAuto1: boolean;
  cabinetDocs: readonly CabinetDocument[];
  files?: readonly Pick<V2IegadeFile, "group" | "tag">[];
}): string[] {
  if (!input.isAuto1) return [];
  if (input.files?.some((f) => f.group === "pirkums" && f.tag === "Rēķins")) return [];
  const live = input.cabinetDocs.filter((d) => !d.deletedAt);
  return AUTO1_REQUIRED_DOCS.filter((t) => !live.some((d) => effectiveCabinetDocType(d) === t)).map((t) => CABINET_DOC_TYPE_LABEL[t]);
}
