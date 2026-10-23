/**
 * IRISS klienta piedāvājuma saite.
 * Publiskā lapa redz tikai vienu piedāvājumu. Pasūtījuma id un admin dati šeit neienāk.
 * Zīmols: Dzintarzeme Auto, juridiski SIA ĪRISS.
 */

import {
  formatIrissOfferPublicBodyType,
  formatIrissOfferPublicFuel,
  formatIrissOfferPublicOdometer,
  formatIrissOfferPublicTransmission,
} from "@/lib/iriss-offer-public-display";
import { orderOfferAttachmentsForPdf } from "@/lib/iriss-offer-image-sorter";
import { parsePriceLike, irissPriceLooksNumeric } from "@/lib/iriss-price-format";
import { isOfferDeadlinePassed, normalizeOfferValidUntilAt } from "@/lib/iriss-offer-valid-until";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_OFFER_LINK_PATH_PREFIX = "/p";
export const IRISS_OFFER_PUBLIC_BRAND = "Dzintarzeme Auto";
export const IRISS_OFFER_PUBLIC_LEGAL = "SIA ĪRISS";
export const IRISS_OFFER_QUESTION_MAX = 400;
export const IRISS_OFFER_LINK_EXPIRY_DAY_CHOICES = [7, 14, 30] as const;
/** Saite ar termiņu paliek atverama vēl 30 dienas pēc termiņa (pogas atspējotas). */
export const IRISS_OFFER_LINK_AFTER_DEADLINE_DAYS = 30;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const ENTITY_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTACHMENT_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

const PUBLIC_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const IRISS_OFFER_CLIENT_STATUS_LV = {
  sent: "Nosūtīts",
  viewed: "Skatīts",
  answered: "Atbildēts",
  approved: "Apstiprināts",
  declined: "Noraidīts",
  expired: "Beidzies",
  revoked: "Atsaukts",
} as const;

export type IrissOfferClientStatus = keyof typeof IRISS_OFFER_CLIENT_STATUS_LV;
export type IrissOfferClientDecision = "" | "approve" | "decline";
export type IrissOfferLinkAction = "approve" | "decline" | "question";

export type IrissOfferClientLinkRecord = {
  tokenHash: string;
  token: string;
  orderId: string;
  offerId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  decision: IrissOfferClientDecision;
  decidedAt: string;
  question: string;
  questionAt: string;
};

export type IrissOfferPublicView = {
  brand: typeof IRISS_OFFER_PUBLIC_BRAND;
  legalName: typeof IRISS_OFFER_PUBLIC_LEGAL;
  title: string;
  brandModel: string;
  vin: string;
  firstRegistration: string;
  odometer: string;
  transmission: string;
  fuel: string;
  bodyType: string;
  location: string;
  checks: string[];
  notes: string;
  prices: { label: string; value: string }[];
  total: string;
  validDays: string;
  photos: { id: string }[];
  decision: IrissOfferClientDecision;
  question: string;
  /** Lēmuma laiks (ISO) vai "". */
  decidedAt: string;
  /** Precīzs termiņš UTC ISO vai "" (vecie piedāvājumi - bez taimera). */
  deadlineAt: string;
  /** Servera laiks lapas ielādē - taimeris skaita no nobīdes, nevis klienta pulksteņa. */
  serverNow: string;
};

export type IrissOfferClientLinkAdminView = {
  offerId: string;
  /** Piedāvājuma termiņš (validUntilAt) vai "". */
  deadlineAt: string;
  path: string;
  status: IrissOfferClientStatus;
  statusLabel: string;
  statusAt: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  firstViewedAt: string;
  viewCount: number;
  decision: IrissOfferClientDecision;
  decidedAt: string;
  question: string;
  questionAt: string;
};

export const IRISS_OFFER_PUBLIC_LABELS = {
  year: "Pirmā reģistrācija",
  odometer: "Nobraukums",
  transmission: "Ātrumkārba",
  fuel: "Degviela",
  bodyType: "Virsbūve",
  location: "Atrašanās vieta",
  vin: "VIN",
  car: "Auto",
  delivery: "Piegāde",
  commission: "Komisija",
  total: "Kopā",
  valid: "Piedāvājums spēkā",
  approve: "Apstiprināt",
  decline: "Noraidīt",
  ask: "Jautājums",
  askSend: "Nosūtīt jautājumu",
  unavailableTitle: "Piedāvājums nav pieejams",
  unavailableBody: "Šī saite nav derīga. Sazinieties ar Dzintarzeme Auto.",
  approved: "Paldies. Piedāvājums ir apstiprināts.",
  declined: "Paldies. Piedāvājums ir noraidīts.",
  asked: "Jautājums ir nosūtīts.",
  questionPlaceholder: "Īss jautājums par šo auto",
  yourQuestion: "Jūsu jautājums",
  questionRequired: "Ierakstiet īsu jautājumu.",
  sendFailed: "Neizdevās nosūtīt. Mēģiniet vēlreiz.",
  expired: "Piedāvājuma termiņš beidzies",
  service: "Pilna servisa vēsture",
  paint: "Rūpnīcas krāsojums",
  rust: "Virsbūve bez rūsas",
  wheels: "Otrs riteņu komplekts",
} as const;

export function isIrissOfferLinkPath(pathname: string): boolean {
  return pathname === IRISS_OFFER_LINK_PATH_PREFIX || pathname.startsWith(`${IRISS_OFFER_LINK_PATH_PREFIX}/`);
}

export function irissOfferClientLinkPublicPath(token: string): string {
  return `${IRISS_OFFER_LINK_PATH_PREFIX}/${token}`;
}

export function irissOfferClientLinkAbsoluteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${irissOfferClientLinkPublicPath(token)}`;
}

export function isSafeIrissOfferLinkToken(token: string): boolean {
  const t = token.trim();
  if (!TOKEN_RE.test(t)) return false;
  if (t.includes("..")) return false;
  return true;
}

export function isIrissOfferLinkEntityId(id: string): boolean {
  return ENTITY_ID_RE.test(id.trim());
}

export function isSafeIrissOfferAttachmentId(id: string): boolean {
  return ATTACHMENT_ID_RE.test(id.trim());
}

export function isIrissOfferPublicImageMime(mime: string): boolean {
  const base = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return PUBLIC_IMAGE_MIME.has(base);
}

export function parseIrissOfferLinkExpiryDays(raw: unknown): number | null | "invalid" {
  if (raw == null || raw === "" || raw === 0 || raw === "0") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1 || n > 180) return "invalid";
  return n;
}

export function irissOfferLinkExpiresAt(createdAtIso: string, days: number | null): string {
  if (days == null) return "";
  const t = Date.parse(createdAtIso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString();
}

function isIso(value: string): boolean {
  if (!value.trim()) return false;
  return Number.isFinite(Date.parse(value));
}

export function isIrissOfferLinkUsable(
  rec: Pick<IrissOfferClientLinkRecord, "revokedAt" | "expiresAt">,
  nowMs = Date.now(),
): boolean {
  if (rec.revokedAt.trim()) return false;
  if (!rec.expiresAt.trim()) return true;
  const t = Date.parse(rec.expiresAt);
  return Number.isFinite(t) && t > nowMs;
}

/** Saites derīgums jaunai saitei ar piedāvājuma termiņu: termiņš + 30 dienas. */
export function irissOfferLinkExpiresAtForDeadline(deadlineIso: string): string {
  const n = normalizeOfferValidUntilAt(deadlineIso);
  if (!n) return "";
  return new Date(Date.parse(n) + IRISS_OFFER_LINK_AFTER_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** offerId -> validUntilAt (tikai piedāvājumiem ar precīzu termiņu). */
export function irissOfferDeadlinesByOfferId(
  offers: ReadonlyArray<Pick<IrissOfferRecord, "id" | "validUntilAt">>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const offer of offers) {
    const at = normalizeOfferValidUntilAt(offer.validUntilAt);
    if (at) out[offer.id] = at;
  }
  return out;
}

export type IrissOfferLinkDeadlineOpts = { deadlineAt?: string | null; nowMs?: number };

function deadlineMsOf(opts?: IrissOfferLinkDeadlineOpts): number | null {
  const n = normalizeOfferValidUntilAt(opts?.deadlineAt ?? "");
  return n ? Date.parse(n) : null;
}

export function irissOfferClientLinkStatus(
  rec: IrissOfferClientLinkRecord,
  opts?: IrissOfferLinkDeadlineOpts,
): IrissOfferClientStatus {
  if (rec.revokedAt.trim()) return "revoked";
  if (rec.decision === "approve") return "approved";
  if (rec.decision === "decline") return "declined";
  if (isOfferDeadlinePassed(deadlineMsOf(opts), opts?.nowMs ?? Date.now())) return "expired";
  if (rec.question.trim() && rec.questionAt.trim()) return "answered";
  if (rec.firstViewedAt.trim() || rec.viewCount > 0) return "viewed";
  return "sent";
}

export function irissOfferClientLinkStatusAt(
  rec: IrissOfferClientLinkRecord,
  opts?: IrissOfferLinkDeadlineOpts,
): string {
  const status = irissOfferClientLinkStatus(rec, opts);
  if (status === "revoked") return rec.revokedAt;
  if (status === "expired") return normalizeOfferValidUntilAt(opts?.deadlineAt ?? "");
  if (status === "approved" || status === "declined") return rec.decidedAt || rec.createdAt;
  if (status === "answered") return rec.questionAt;
  if (status === "viewed") return rec.firstViewedAt || rec.lastViewedAt;
  return rec.createdAt;
}

export function irissOfferClientLinkStatusLabel(
  rec: IrissOfferClientLinkRecord,
  opts?: IrissOfferLinkDeadlineOpts,
): string {
  return IRISS_OFFER_CLIENT_STATUS_LV[irissOfferClientLinkStatus(rec, opts)];
}

const RIGA_STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatIrissOfferLinkStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!iso.trim() || !Number.isFinite(t)) return "";
  const parts = RIGA_STAMP.formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  if (!day || !month || !hour || !minute) return "";
  return `${day}.${month} ${hour}:${minute}`;
}

export function sanitizeIrissOfferQuestion(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const noTags = raw.replace(/<[^>]*>/g, " ");
  const collapsed = noTags
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return collapsed.slice(0, IRISS_OFFER_QUESTION_MAX).trim();
}

export function applyIrissOfferLinkView(
  rec: IrissOfferClientLinkRecord,
  nowIso: string,
): IrissOfferClientLinkRecord | null {
  if (!isIso(nowIso)) return null;
  if (!isIrissOfferLinkUsable(rec, Date.parse(nowIso))) return null;
  const count = Number.isFinite(rec.viewCount) ? rec.viewCount : 0;
  return {
    ...rec,
    viewCount: Math.min(count + 1, 1_000_000),
    firstViewedAt: rec.firstViewedAt.trim() || nowIso,
    lastViewedAt: nowIso,
  };
}

export function applyIrissOfferLinkRevoke(
  rec: IrissOfferClientLinkRecord,
  nowIso: string,
): IrissOfferClientLinkRecord {
  if (rec.revokedAt.trim() || !isIso(nowIso)) return rec;
  return { ...rec, revokedAt: nowIso };
}

export function applyIrissOfferLinkResponse(
  rec: IrissOfferClientLinkRecord,
  action: IrissOfferLinkAction,
  text: string,
  nowIso: string,
  opts?: { deadlineAt?: string | null },
):
  | { ok: true; record: IrissOfferClientLinkRecord; unchanged: boolean }
  | { ok: false; error: "unavailable" | "question" | "expired" } {
  if (!isIso(nowIso) || !isIrissOfferLinkUsable(rec, Date.parse(nowIso))) {
    return { ok: false, error: "unavailable" };
  }
  if (action === "question") {
    const question = sanitizeIrissOfferQuestion(text);
    if (!question) return { ok: false, error: "question" };
    return {
      ok: true,
      unchanged: false,
      record: { ...rec, question, questionAt: nowIso },
    };
  }
  if (rec.decision === "approve" || rec.decision === "decline") {
    return { ok: true, unchanged: true, record: rec };
  }
  if (isOfferDeadlinePassed(deadlineMsOf({ deadlineAt: opts?.deadlineAt }), Date.parse(nowIso))) {
    return { ok: false, error: "expired" };
  }
  return {
    ok: true,
    unchanged: false,
    record: { ...rec, decision: action, decidedAt: nowIso },
  };
}

function optionalIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "";
  return isIso(value) ? value : null;
}

export function parseIrissOfferClientLinkRecord(raw: unknown): IrissOfferClientLinkRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tokenHash = typeof o.tokenHash === "string" ? o.tokenHash.trim().toLowerCase() : "";
  const token = typeof o.token === "string" ? o.token.trim() : "";
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const offerId = typeof o.offerId === "string" ? o.offerId.trim() : "";
  if (!HASH_RE.test(tokenHash)) return null;
  if (!isSafeIrissOfferLinkToken(token)) return null;
  if (!isIrissOfferLinkEntityId(orderId) || !isIrissOfferLinkEntityId(offerId)) return null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!isIso(createdAt)) return null;
  const expiresAt = optionalIso(o.expiresAt);
  const revokedAt = optionalIso(o.revokedAt);
  const firstViewedAt = optionalIso(o.firstViewedAt);
  const lastViewedAt = optionalIso(o.lastViewedAt);
  const decidedAt = optionalIso(o.decidedAt);
  const questionAt = optionalIso(o.questionAt);
  if (
    expiresAt == null ||
    revokedAt == null ||
    firstViewedAt == null ||
    lastViewedAt == null ||
    decidedAt == null ||
    questionAt == null
  ) {
    return null;
  }
  const viewRaw = typeof o.viewCount === "number" ? o.viewCount : Number.parseInt(String(o.viewCount ?? "0"), 10);
  if (!Number.isInteger(viewRaw) || viewRaw < 0 || viewRaw > 1_000_000) return null;
  const decision: IrissOfferClientDecision =
    o.decision === "approve" || o.decision === "decline" ? o.decision : "";
  return {
    tokenHash,
    token,
    orderId,
    offerId,
    createdAt,
    expiresAt,
    revokedAt,
    firstViewedAt,
    lastViewedAt,
    viewCount: viewRaw,
    decision,
    decidedAt,
    question: sanitizeIrissOfferQuestion(o.question),
    questionAt,
  };
}

export function toIrissOfferClientLinkAdminView(
  rec: IrissOfferClientLinkRecord,
  opts?: IrissOfferLinkDeadlineOpts,
): IrissOfferClientLinkAdminView {
  const status = irissOfferClientLinkStatus(rec, opts);
  return {
    offerId: rec.offerId,
    deadlineAt: normalizeOfferValidUntilAt(opts?.deadlineAt ?? ""),
    path: irissOfferClientLinkPublicPath(rec.token),
    status,
    statusLabel: IRISS_OFFER_CLIENT_STATUS_LV[status],
    statusAt: irissOfferClientLinkStatusAt(rec, opts),
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
    revokedAt: rec.revokedAt,
    firstViewedAt: rec.firstViewedAt,
    viewCount: rec.viewCount,
    decision: rec.decision,
    decidedAt: rec.decidedAt,
    question: rec.question,
    questionAt: rec.questionAt,
  };
}

function plainClientText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4_000);
}

function moneyLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (irissPriceLooksNumeric(t)) {
    const n = parsePriceLike(t);
    if (!(n > 0)) return "";
    return `${new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0 }).format(Math.round(n))} €`;
  }
  return t.slice(0, 80);
}

function offerTotalLabel(offer: Pick<IrissOfferRecord, "carPrice" | "deliveryPrice" | "commissionFee" | "priceGermany">): string {
  const parts = [offer.carPrice, offer.deliveryPrice, offer.commissionFee].map((v) => (irissPriceLooksNumeric(v) ? parsePriceLike(v) : 0));
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum > 0) return `${new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0 }).format(Math.round(sum))} €`;
  return moneyLabel(offer.priceGermany);
}

export function buildIrissOfferPublicView(
  offer: IrissOfferRecord,
  client: { decision: IrissOfferClientDecision; question: string; decidedAt?: string },
  opts?: { nowMs?: number },
): IrissOfferPublicView {
  const checks = [
    offer.hasFullServiceHistory ? IRISS_OFFER_PUBLIC_LABELS.service : "",
    offer.hasFactoryPaint ? IRISS_OFFER_PUBLIC_LABELS.paint : "",
    offer.hasNoRustBody ? IRISS_OFFER_PUBLIC_LABELS.rust : "",
    offer.hasSecondWheelSet ? IRISS_OFFER_PUBLIC_LABELS.wheels : "",
  ].filter(Boolean);

  const structured = [
    plainClientText(offer.specialNotes),
    plainClientText(offer.visualAssessment),
    plainClientText(offer.technicalAssessment),
    plainClientText(offer.summary),
  ].filter(Boolean);
  const notes = structured.length > 0 ? structured.join("\n\n") : plainClientText(offer.comment);

  const prices = [
    { label: IRISS_OFFER_PUBLIC_LABELS.car, value: moneyLabel(offer.carPrice || offer.priceGermany) },
    { label: IRISS_OFFER_PUBLIC_LABELS.delivery, value: moneyLabel(offer.deliveryPrice) },
    { label: IRISS_OFFER_PUBLIC_LABELS.commission, value: moneyLabel(offer.commissionFee) },
  ].filter((row) => row.value);

  const photos = orderOfferAttachmentsForPdf(offer)
    .filter((a) => isIrissOfferPublicImageMime(a.mimeType) && isSafeIrissOfferAttachmentId(a.id))
    .map((a) => ({ id: a.id }));

  const validRaw = offer.offerValidDays.trim();
  const validDays = /^\d{1,3}$/.test(validRaw) ? `${validRaw} dienas` : validRaw.slice(0, 40);

  return {
    brand: IRISS_OFFER_PUBLIC_BRAND,
    legalName: IRISS_OFFER_PUBLIC_LEGAL,
    title: plainClientText(offer.title).slice(0, 80),
    brandModel: plainClientText(offer.brandModel).slice(0, 160),
    vin: offer.vin.trim().slice(0, 32),
    firstRegistration: plainClientText(offer.firstRegistration || offer.year).slice(0, 40),
    odometer: formatIrissOfferPublicOdometer(plainClientText(offer.odometerReading || offer.mileage)),
    transmission: formatIrissOfferPublicTransmission(plainClientText(offer.transmission)),
    fuel: formatIrissOfferPublicFuel(plainClientText(offer.fuel)),
    bodyType: formatIrissOfferPublicBodyType(plainClientText(offer.bodyTypeOffer)),
    location: plainClientText(offer.location).slice(0, 80),
    checks,
    notes,
    prices,
    total: offerTotalLabel(offer),
    validDays,
    photos,
    decision: client.decision,
    question: sanitizeIrissOfferQuestion(client.question),
    decidedAt: client.decision && client.decidedAt && isIso(client.decidedAt) ? client.decidedAt : "",
    deadlineAt: normalizeOfferValidUntilAt(offer.validUntilAt),
    serverNow: new Date(opts?.nowMs ?? Date.now()).toISOString(),
  };
}

const PUBLIC_VIEW_KEYS = [
  "brand",
  "legalName",
  "title",
  "brandModel",
  "vin",
  "firstRegistration",
  "odometer",
  "transmission",
  "fuel",
  "bodyType",
  "location",
  "checks",
  "notes",
  "prices",
  "total",
  "validDays",
  "photos",
  "decision",
  "question",
  "decidedAt",
  "deadlineAt",
  "serverNow",
] as const;

export function irissOfferPublicViewKeys(): readonly string[] {
  return PUBLIC_VIEW_KEYS;
}

export function irissOfferPublicViewContainsSecret(view: IrissOfferPublicView, secret: string): boolean {
  const needle = secret.trim();
  if (needle.length < 8) return false;
  return JSON.stringify(view).includes(needle);
}

export function buildIrissOfferClientLinkMessage(opts: { url: string; vehicle: string }): { subject: string; text: string } {
  const vehicle = opts.vehicle.replace(/\s+/g, " ").trim().slice(0, 160);
  const subject = `${IRISS_OFFER_PUBLIC_BRAND}: piedāvājums${vehicle ? `: ${vehicle}` : ""}`;
  const text = [
    "Sveiki!",
    "",
    vehicle ? `${IRISS_OFFER_PUBLIC_BRAND} piedāvājums: ${vehicle}.` : `${IRISS_OFFER_PUBLIC_BRAND} piedāvājums.`,
    "Apskatiet auto un atbildiet saitē:",
    "",
    opts.url,
    "",
    "Labu dienu,",
    IRISS_OFFER_PUBLIC_BRAND,
    IRISS_OFFER_PUBLIC_LEGAL,
  ].join("\n");
  return { subject, text };
}

export function buildIrissOfferClientLinkWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function buildIrissOfferClientLinkMailto(email: string, message: { subject: string; text: string }): string {
  const to = email.trim();
  return `mailto:${to}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.text)}`;
}

export function irissOfferLinkRequestIsSameOrigin(req: {
  url: string;
  headers: { get(name: string): string | null };
}): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
