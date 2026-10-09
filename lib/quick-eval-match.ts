/**
 * VIN kā globāla atslēga: ātro vērtējumu un pasūtījumu sasaiste (tīras funkcijas, testējamas).
 */
import { normalizeCustomerEmail, normalizeCustomerPhoneKey } from "@/lib/admin-customer-identity";
import { normalizeVin } from "@/lib/order-field-validation";

/** VIN vai numurzīme salīdzināšanai (lielie burti, bez atstarpēm un domuzīmēm). */
export function vehicleKey(raw: string | null | undefined): string {
  return normalizeVin(String(raw ?? "")).replace(/[\s-]+/g, "");
}

/** Visas atslēgas, ar kurām šis transportlīdzeklis var būt ievadīts (VIN, numurzīme). */
export function vehicleKeys(...raw: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const r of raw) {
    const k = vehicleKey(r);
    if (k.length >= 4) out.add(k);
  }
  return out;
}

export function vehicleKeysOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const k of a) if (b.has(k)) return true;
  return false;
}

export type QuickEvalMatchPeek = {
  id: string;
  email: string;
  phone: string;
  createdAt: string;
  vehicle: Set<string>;
  exportedTo: string[];
};

export type QuickEvalMatchOrder = {
  id: string;
  createdMs: number;
  emails: Array<string | null | undefined>;
  phones: Array<string | null | undefined>;
  vehicle: Set<string>;
};

/** Automātiskais imports: tas pats VIN UN tas pats e-pasts. Jaunākais vērtējums uzvar. */
export function pickAutoImportPeek(
  order: QuickEvalMatchOrder,
  peeks: QuickEvalMatchPeek[],
): QuickEvalMatchPeek | null {
  const emails = new Set(order.emails.map((e) => normalizeCustomerEmail(String(e ?? ""))).filter(Boolean));
  if (emails.size === 0 || order.vehicle.size === 0) return null;
  const hits = peeks.filter(
    (p) =>
      emails.has(normalizeCustomerEmail(p.email)) &&
      vehicleKeysOverlap(p.vehicle, order.vehicle) &&
      !p.exportedTo.includes(order.id),
  );
  hits.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return hits[0] ?? null;
}

export type ExportCandidate = {
  id: string;
  createdMs: number;
  matchedBy: Array<"vin" | "email" | "phone">;
};

/** Manuālajam eksportam: pasūtījumi, kas sakrīt pēc VIN, e-pasta vai tālruņa (vispirms labākās sakritības). */
export function rankExportCandidates(peek: QuickEvalMatchPeek, orders: QuickEvalMatchOrder[]): ExportCandidate[] {
  const email = normalizeCustomerEmail(peek.email);
  const phone = normalizeCustomerPhoneKey(peek.phone);
  const peekMs = Date.parse(peek.createdAt);
  const out: ExportCandidate[] = [];
  for (const o of orders) {
    if (Number.isFinite(peekMs) && o.createdMs < peekMs - 24 * 3600 * 1000) continue;
    const matchedBy: ExportCandidate["matchedBy"] = [];
    if (vehicleKeysOverlap(peek.vehicle, o.vehicle)) matchedBy.push("vin");
    if (email && o.emails.some((e) => normalizeCustomerEmail(String(e ?? "")) === email)) matchedBy.push("email");
    if (phone.length >= 8 && o.phones.some((p) => normalizeCustomerPhoneKey(String(p ?? "")) === phone)) {
      matchedBy.push("phone");
    }
    if (matchedBy.length > 0) out.push({ id: o.id, createdMs: o.createdMs, matchedBy });
  }
  out.sort((a, b) => b.matchedBy.length - a.matchedBy.length || b.createdMs - a.createdMs);
  return out;
}

export const QUICK_EVAL_RETENTION_DAYS = 30;

/** Vai nekonvertēta vērtējuma dati jādzēš (30 dienas, eksportētie paliek). */
export function quickEvalExpired(createdAt: string, exported: boolean, now = Date.now()): boolean {
  if (exported) return false;
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) return false;
  return now - ms > QUICK_EVAL_RETENTION_DAYS * 24 * 3600 * 1000;
}
