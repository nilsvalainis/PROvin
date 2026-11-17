/**
 * Dīlera pārbaužu saraksts: ko saglabāt, kam rādīt, kā filtrēt un eksportēt.
 * Tīra loģika. OneAuto rēķinu noteikumi paliek esošajā klientā.
 */
import { ADMIN_GOOGLE_ALLOWED_EMAIL, ADMIN_GOOGLE_SESSION_VIA } from "@/lib/admin-session-token";
import { rigaCalendarDayKey } from "@/lib/admin-riga-calendar";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import {
  DEALER_CHECK_TEMPLATE_LABEL,
  formatDealerCheckEur,
  isSafeDealerCheckId,
  parseDealerCheckTemplateId,
  type DealerCheckRecord,
  type DealerCheckTemplateId,
} from "@/lib/dealer-check";
import { oneautoResultTone } from "@/lib/oneauto-catalog";
import { normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import { formatRigaIsoShort } from "@/lib/riga-datetime";

/** Paroles administrators un vienīgais Google īpašnieks (info@provin.lv). */
export const DEALER_CHECK_OWNER_ID = "env-admin";

export type DealerCheckHistoryStatus = "open" | "converted";

export type DealerCheckHistoryEntry = {
  id: string;
  vin: string;
  plate: string;
  template: DealerCheckTemplateId;
  createdAt: string;
  fetchedAt: string;
  createdBy: string;
  status: DealerCheckHistoryStatus;
  orderId: string;
  chargedCents: number;
  hasData: boolean;
  autoparksTitle: string;
};

export type DealerCheckListFilter = {
  vin: string;
  plate: string;
  from: string;
  to: string;
  template: DealerCheckTemplateId | "all";
  status: DealerCheckHistoryStatus | "all";
  ordered: "yes" | "no" | "all";
};

export const DEALER_CHECK_LIST_DEFAULT_FILTER: DealerCheckListFilter = {
  vin: "",
  plate: "",
  from: "",
  to: "",
  template: "all",
  status: "all",
  ordered: "no",
};

type SessionLike = { via?: string; sub?: string; email?: string } | null | undefined;

/**
 * Īpašnieka id. Parole un atļautais Google konts ir viens un tas pats env-admin,
 * jo admin sesijā nav otra lietotāja id. Cits Google sub paliek atsevišķi.
 */
export function dealerCheckCreatorId(payload: SessionLike): string {
  if (payload?.via === ADMIN_GOOGLE_SESSION_VIA) {
    const sub = (payload.sub ?? "").trim();
    const email = (payload.email ?? "").trim().toLowerCase();
    if (sub && email && email !== ADMIN_GOOGLE_ALLOWED_EMAIL.toLowerCase()) {
      return `google:${sub}`.slice(0, 120);
    }
  }
  return DEALER_CHECK_OWNER_ID;
}

export function dealerCheckRecordCreator(record: { createdBy?: string | null }): string {
  const id = (record.createdBy ?? "").trim();
  return id || DEALER_CHECK_OWNER_ID;
}

export function dealerCheckVisibleTo(record: { createdBy?: string | null }, creatorId: string): boolean {
  return dealerCheckRecordCreator(record) === creatorId;
}

export function dealerCheckHistoryStatus(record: {
  status?: string | null;
  orderId?: string | null;
}): DealerCheckHistoryStatus {
  if (record.status === "converted" || (record.orderId ?? "").trim()) return "converted";
  return "open";
}

/**
 * Saglabā tikai ielādi, kurā vismaz viens atzīmētais OneAuto produkts ir ok.
 * HTTP 206, no_data, kļūda, tukša atbilde un tikai 206 = nesaglabā.
 * Jaukta ielāde (ok + 206) paliek, jo ir reāli dati.
 */
export function dealerCheckLoadShouldPersist(
  record: Pick<DealerCheckRecord, "selectedProducts" | "results">,
): boolean {
  if (record.selectedProducts.length === 0) return false;
  return record.selectedProducts.some((id) => {
    const result = record.results[id];
    return result != null && oneautoResultTone(result) === "ok";
  });
}

export function parseDealerCheckCsddSnapshot(raw: unknown): CsddTechData | null {
  if (!raw || typeof raw !== "object") return null;
  const empty = emptyCsddTechData();
  const o = raw as Record<string, unknown>;
  const data: CsddTechData = { ...empty };
  let any = false;
  for (const key of Object.keys(empty) as (keyof CsddTechData)[]) {
    if (typeof o[key] !== "string") continue;
    const value = o[key].trim().slice(0, 200);
    data[key] = value;
    if (value) any = true;
  }
  return any ? data : null;
}

export function dealerCheckHistoryEntryFromRecord(record: DealerCheckRecord): DealerCheckHistoryEntry | null {
  if (!isSafeDealerCheckId(record.id)) return null;
  const orderId = (record.orderId ?? "").trim().slice(0, 80);
  return {
    id: record.id,
    vin: normalizeVin(record.vin).slice(0, 17),
    plate: record.plate.trim().slice(0, 16),
    template: record.template,
    createdAt: (record.createdAt || record.fetchedAt).slice(0, 40),
    fetchedAt: record.fetchedAt.slice(0, 40),
    createdBy: dealerCheckRecordCreator(record),
    status: orderId ? "converted" : dealerCheckHistoryStatus(record),
    orderId,
    chargedCents: Math.max(0, Math.round(record.chargedCents || 0)),
    hasData: dealerCheckLoadShouldPersist(record),
    autoparksTitle: record.autoparks?.title?.trim().slice(0, 160) ?? "",
  };
}

export function parseDealerCheckHistoryEntry(raw: unknown): DealerCheckHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !isSafeDealerCheckId(o.id)) return null;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim().slice(0, 80) : "";
  const status: DealerCheckHistoryStatus = orderId || o.status === "converted" ? "converted" : "open";
  return {
    id: o.id,
    vin: normalizeVin(typeof o.vin === "string" ? o.vin : "").slice(0, 17),
    plate: typeof o.plate === "string" ? o.plate.trim().slice(0, 16) : "",
    template: parseDealerCheckTemplateId(o.template),
    createdAt: typeof o.createdAt === "string" ? o.createdAt.slice(0, 40) : "",
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : "",
    createdBy:
      typeof o.createdBy === "string" && o.createdBy.trim()
        ? o.createdBy.trim().slice(0, 120)
        : DEALER_CHECK_OWNER_ID,
    status,
    orderId,
    chargedCents: Number.isFinite(Number(o.chargedCents)) ? Math.max(0, Math.round(Number(o.chargedCents))) : 0,
    hasData: o.hasData !== false,
    autoparksTitle: typeof o.autoparksTitle === "string" ? o.autoparksTitle.slice(0, 160) : "",
  };
}

function dayKey(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return rigaCalendarDayKey(ms);
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function filterDealerCheckList(
  entries: readonly DealerCheckHistoryEntry[],
  filter: DealerCheckListFilter,
): DealerCheckHistoryEntry[] {
  const vinQ = normalizeVin(filter.vin);
  const plateQ = normalizePlateNumber(filter.plate);
  const from = isDay(filter.from) ? filter.from : "";
  const to = isDay(filter.to) ? filter.to : "";
  const out = entries.filter((entry) => {
    if (vinQ && !entry.vin.includes(vinQ)) return false;
    if (plateQ && !normalizePlateNumber(entry.plate).includes(plateQ)) return false;
    if (filter.template !== "all" && entry.template !== filter.template) return false;
    if (filter.status !== "all" && entry.status !== filter.status) return false;
    if (filter.ordered === "yes" && entry.status !== "converted") return false;
    if (filter.ordered === "no" && entry.status === "converted") return false;
    if (from || to) {
      const day = dayKey(entry.createdAt || entry.fetchedAt);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function dealerCheckListToCsv(entries: readonly DealerCheckHistoryEntry[]): string {
  const header = [
    "id",
    "datums",
    "vin",
    "numurzime",
    "sablons",
    "statuss",
    "pasutijums",
    "pasutijuma_id",
    "iekasets",
    "autoparks",
  ];
  const lines = [header.join(",")];
  for (const entry of entries) {
    lines.push(
      [
        entry.id,
        formatRigaIsoShort(entry.createdAt || entry.fetchedAt),
        entry.vin,
        entry.plate,
        DEALER_CHECK_TEMPLATE_LABEL[entry.template],
        entry.status === "converted" ? "Pasūtījums" : "Atvērta",
        entry.status === "converted" ? "Jā" : "Nē",
        entry.orderId,
        formatDealerCheckEur(entry.chargedCents),
        entry.autoparksTitle,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
