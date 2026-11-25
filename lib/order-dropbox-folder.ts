import { isTelegramGroupPayment } from "@/lib/admin-customer-identity";
import { reportPdfKindFromFilename } from "@/lib/audit-report-pdf-filename";
import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * PROVIN pasūtījuma Dropbox mape (tīrā loģika). Nils 23.11: mape uzreiz pēc pasūtījuma, dīlera dati strikti atsevišķi
 * no auditiem, nosaukumā vispirms marka un modelis. Personas datus (vārds, e-pasts, tālrunis) nosaukumā nekad neliek.
 *
 * Shēma: `{root}/{VIRSMAPE}/{MARKA MODELIS}_{NUMURS}_{VIN}_{YYYY-MM-DD}_{PRODUKTS}`
 *  - root = `PROV_ORDERS_DROPBOX_ROOT` (noklusējums `/_PROv`, tur jau ir Nila veco auditu mapes);
 *  - VIRSMAPE: AUDITI | DILERA DATI | MINI | BUSINESS (produktus nekad nejauc vienā mapē);
 *  - trūkstošās daļas izlaiž; ja nav ne numura, ne VIN - beigās īss pasūtījuma id;
 *  - marka/modelis vēlāk (CSDD) -> mapi pārdēvē (Dropbox move, tā pati mape pēc id).
 */

/** `fulfillment` vērtības, kas ir parasts pasūtījums ar auto. */
export const ORDER_FULFILLMENTS = new Set(["", "client_link", "business_link"]);

export type OrderDropboxCategory = "audits" | "dealer" | "mini" | "business";

const CATEGORY_DIR: Record<OrderDropboxCategory, string> = {
  audits: "AUDITI",
  dealer: "DILERA DATI",
  mini: "MINI",
  business: "BUSINESS",
};

const CATEGORY_LABEL: Record<OrderDropboxCategory, string> = {
  audits: "AUDITS",
  dealer: "DILERA DATI",
  mini: "MINI",
  business: "BUSINESS",
};

/**
 * Produkta kategorija mapei. `null` - mapi neveido (PROVIN SELECT konsultācija, B2B paka, maka papildinājums,
 * Telegram grupa, augšpārdošana). Dīlera dati pēc `checkoutLine=dealer` vai summas (kā `isDealerDataAutoFetchOrder`).
 */
export function orderDropboxCategory(args: {
  checkoutLine?: string | null;
  fulfillment?: string | null;
  isDealerData?: boolean;
  amountTotalCents?: number | null;
}): OrderDropboxCategory | null {
  // Parastie pasūtījumi: bez `fulfillment` vai caur klienta / Business saiti. Pārējie (b2b_pack, b2b_wallet_topup,
  // order_upsell, manual_order_payment) nav atsevišķs auto darbs.
  if (!ORDER_FULFILLMENTS.has((args.fulfillment ?? "").trim().toLowerCase())) return null;
  if (isTelegramGroupPayment(args.amountTotalCents)) return null;
  const line = (args.checkoutLine ?? "").trim().toLowerCase();
  if (line === "provin_select" || line === "consultation") return null;
  if (line === "dealer" || args.isDealerData) return "dealer";
  if (line === "mini" || line === "plus" || line === "listing_filter") return "mini";
  if (line === "business") return "business";
  return "audits";
}

/**
 * Manuālajam pasūtījumam produkts kļūst zināms tikai, kad admins ģenerē / sūta PDF (Business, Dīlera dati, AUDITS).
 * PDF nosaukums -> virsmape. ASV / izsoļu arhīvs / nezināms - null (mapi nepārvieto).
 */
export function orderDropboxCategoryFromReportFilename(filename: string): OrderDropboxCategory | null {
  switch (reportPdfKindFromFilename(filename)) {
    case "audits":
      return "audits";
    case "mini":
      return "mini";
    case "business":
      return "business";
    case "dealer":
    case "oem_dealer":
      return "dealer";
    default:
      return null;
  }
}

export type OrderDropboxNameInput = {
  sessionId: string;
  category: OrderDropboxCategory;
  /** Pasūtījuma laiks (ms) - datums Rīgas laikā. */
  createdMs: number;
  make?: string | null;
  model?: string | null;
  plate?: string | null;
  vin?: string | null;
};

export function rigaYmdForFolder(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    new Date(ms),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function cleanPart(s: string | null | undefined, max: number): string {
  return sanitizeDropboxName(String(s ?? "").replace(/_/g, " "), max).toUpperCase();
}

/** Marka un modelis vienā daļā; modelis bez markas atkārtojuma ("BMW" + "BMW 530D" -> "BMW 530D"). */
export function makeModelPart(make?: string | null, model?: string | null): string {
  const mk = cleanPart(make, 40);
  let md = cleanPart(model, 60);
  if (mk && md.startsWith(`${mk} `)) md = md.slice(mk.length + 1);
  if (mk && md === mk) md = "";
  return [mk, md].filter(Boolean).join(" ");
}

export function shortOrderId(sessionId: string): string {
  const s = sessionId.replace(/[^A-Za-z0-9]/g, "");
  return s.slice(-6).toLowerCase();
}

/** Plate tikai, ja tas ir LV/ārzemju numurs (ne VIN). */
function platePart(plate?: string | null): string {
  const p = normalizePlateNumber(plate ?? "");
  return /^[A-Z0-9]{2,10}$/.test(p) && !isValidVin(p) ? p : "";
}

function vinPart(vin?: string | null): string {
  const v = normalizeVin(vin ?? "");
  return isValidVin(v) ? v : "";
}

export function orderDropboxFolderName(input: OrderDropboxNameInput): string {
  const mm = makeModelPart(input.make, input.model);
  const plate = platePart(input.plate);
  const vin = vinPart(input.vin);
  const parts = [mm, plate, vin, rigaYmdForFolder(input.createdMs), CATEGORY_LABEL[input.category]];
  if (!plate && !vin) parts.push(shortOrderId(input.sessionId));
  return sanitizeDropboxName(parts.filter(Boolean).join("_"), 200);
}

export function provOrdersRoot(env: Record<string, string | undefined> = process.env): string {
  const p = (env.PROV_ORDERS_DROPBOX_ROOT?.trim() || "/_PROv").replace(/\/+$/, "");
  return p.startsWith("/") ? p : `/${p}`;
}

export function orderDropboxParentPath(category: OrderDropboxCategory, env: Record<string, string | undefined> = process.env): string {
  return `${provOrdersRoot(env)}/${CATEGORY_DIR[category]}`;
}

export function orderDropboxFolderPath(input: OrderDropboxNameInput, env: Record<string, string | undefined> = process.env): string {
  return `${orderDropboxParentPath(input.category, env)}/${orderDropboxFolderName(input)}`;
}

/**
 * Produkta maiņa: esošās mapes nosaukumā nomaina produkta vārdu («…_AUDITS» -> «…_BUSINESS»), lai nezustu
 * marka / numurs / VIN, kas nosaukumā jau bija. Ja vārda nav - pievieno galā.
 */
export function orderDropboxNameWithCategory(currentName: string, from: OrderDropboxCategory, to: OrderDropboxCategory): string {
  const oldLabel = `_${CATEGORY_LABEL[from]}`;
  const at = currentName.lastIndexOf(oldLabel);
  const next =
    at >= 0
      ? `${currentName.slice(0, at)}_${CATEGORY_LABEL[to]}${currentName.slice(at + oldLabel.length)}`
      : `${currentName}_${CATEGORY_LABEL[to]}`;
  return sanitizeDropboxName(next, 200);
}

/** Mape jāpārdēvē tikai uz bagātāku nosaukumu (parādījās marka/VIN/numurs), nekad "atpakaļ". */
export function orderDropboxShouldRename(currentName: string, desiredName: string): boolean {
  if (!currentName || !desiredName || currentName === desiredName) return false;
  return desiredName.length > currentName.length;
}

export type OrderDropboxRecord = {
  sessionId: string;
  category: OrderDropboxCategory;
  state: "ok" | "error";
  /** Dropbox mapes id (`id:...`) - derīgs arī pēc pārdēvēšanas. */
  folderId?: string;
  path?: string;
  /** Pasūtījuma laiks (ms) - mapes datums nemainās pārdēvējot. */
  orderCreatedMs?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export function parseOrderDropboxRecord(raw: unknown): OrderDropboxRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const category = o.category;
  if (category !== "audits" && category !== "dealer" && category !== "mini" && category !== "business") return null;
  const sessionId = s(o.sessionId, 200);
  if (!sessionId) return null;
  return {
    sessionId,
    category,
    state: o.state === "ok" ? "ok" : "error",
    ...(s(o.folderId) ? { folderId: s(o.folderId) } : {}),
    ...(s(o.path) ? { path: s(o.path) } : {}),
    ...(typeof o.orderCreatedMs === "number" && Number.isFinite(o.orderCreatedMs) ? { orderCreatedMs: o.orderCreatedMs } : {}),
    createdAt: s(o.createdAt, 40) ?? new Date(0).toISOString(),
    updatedAt: s(o.updatedAt, 40) ?? new Date(0).toISOString(),
    ...(s(o.error, 200) ? { error: s(o.error, 200) } : {}),
  };
}
