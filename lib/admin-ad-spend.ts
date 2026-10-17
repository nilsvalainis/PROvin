import { isAdPaidChannel, type AdPaidChannel } from "@/lib/ad-attribution";

export const AD_SPEND_PRODUCTS = ["provin", "iriss"] as const;
export type AdSpendProduct = (typeof AD_SPEND_PRODUCTS)[number];

export type AdSpendRow = {
  id: string;
  date: string;
  dateEnd: string;
  product: AdSpendProduct;
  channel: AdPaidChannel;
  campaign: string;
  keyword: string;
  spendEur: number;
  clicks: number | null;
  impressions: number | null;
  note: string;
  createdAt: string;
};

export const AD_SPEND_CSV_TEMPLATE = [
  "date,channel,campaign,spend,clicks,impressions",
  "2026-10-01,google,vin-audit,45.00,120,4000",
  "2026-10-01,meta,reels-q4,30.00,80,2500",
].join("\n");

export function isAdSpendProduct(value: unknown): value is AdSpendProduct {
  return value === "provin" || value === "iriss";
}

function clip(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));
}

export function parseSpendEur(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseCount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw !== "string") return null;
  const n = Number.parseInt(raw.trim().replace(/\s/g, ""), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalizeChannel(raw: string): AdPaidChannel | null {
  const v = raw.trim().toLowerCase();
  if (v === "facebook" || v === "fb" || v === "instagram" || v === "ig" || v === "meta ads") return "meta";
  if (v === "google ads" || v === "googleads" || v === "adwords") return "google";
  if (isAdPaidChannel(v)) return v;
  return null;
}

function normalizeProduct(raw: string): AdSpendProduct | null {
  const v = raw.trim().toLowerCase();
  if (v === "provin" || v === "provin.lv" || v === "provinlv") return "provin";
  if (v === "iriss" || v === "īriss") return "iriss";
  return null;
}

export function createAdSpendId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `spd_${Date.now().toString(36)}_${rand}`;
}

export function normalizeAdSpendInput(raw: {
  date?: unknown;
  dateEnd?: unknown;
  date_end?: unknown;
  product?: unknown;
  channel?: unknown;
  campaign?: unknown;
  keyword?: unknown;
  spendEur?: unknown;
  spend?: unknown;
  clicks?: unknown;
  impressions?: unknown;
  note?: unknown;
  id?: unknown;
  createdAt?: unknown;
}): AdSpendRow | null {
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  if (!isIsoDate(date)) return null;
  const endRaw = typeof raw.dateEnd === "string" ? raw.dateEnd : typeof raw.date_end === "string" ? raw.date_end : date;
  const dateEnd = endRaw.trim() && isIsoDate(endRaw.trim()) ? endRaw.trim() : date;
  const product =
    raw.product == null || raw.product === ""
      ? "provin"
      : typeof raw.product === "string"
        ? normalizeProduct(raw.product)
        : null;
  const channel = typeof raw.channel === "string" ? normalizeChannel(raw.channel) : null;
  const spendEur = parseSpendEur(raw.spendEur ?? raw.spend);
  if (!product || !channel || spendEur == null) return null;
  const campaign = clip(typeof raw.campaign === "string" ? raw.campaign : "", 80);
  const keyword = clip(typeof raw.keyword === "string" ? raw.keyword : "", 80);
  const note = clip(typeof raw.note === "string" ? raw.note : "", 200);
  const id = typeof raw.id === "string" && raw.id.trim() ? clip(raw.id, 64) : createAdSpendId();
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt.trim() : new Date().toISOString();
  return {
    id,
    date,
    dateEnd: dateEnd < date ? date : dateEnd,
    product,
    channel,
    campaign,
    keyword,
    spendEur,
    clicks: parseCount(raw.clicks),
    impressions: parseCount(raw.impressions),
    note,
    createdAt,
  };
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSep(header: string): string {
  const commas = (header.match(/,/g) ?? []).length;
  const semis = (header.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  datums: "date",
  dateend: "dateEnd",
  date_end: "dateEnd",
  lidz: "dateEnd",
  product: "product",
  produkts: "product",
  site: "product",
  channel: "channel",
  kanals: "channel",
  "kanāls": "channel",
  campaign: "campaign",
  kampaņa: "campaign",
  kampana: "campaign",
  campaignname: "campaign",
  keyword: "keyword",
  term: "keyword",
  atslēgvārds: "keyword",
  atslegvards: "keyword",
  spend: "spend",
  spendeur: "spend",
  izdevumi: "spend",
  cost: "spend",
  amount: "spend",
  clicks: "clicks",
  klikski: "clicks",
  klikšķi: "clicks",
  impressions: "impressions",
  impresijas: "impressions",
  note: "note",
  piezime: "note",
};

function headerKey(raw: string): string | null {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
  return HEADER_ALIASES[compact] ?? HEADER_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export function parseAdSpendCsv(text: string): { rows: AdSpendRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ["Tukšs CSV."] };
  const sep = detectSep(lines[0]!);
  const headers = splitCsvLine(lines[0]!, sep).map((h) => headerKey(h));
  if (!headers.includes("date") || !headers.includes("channel") || !headers.includes("spend")) {
    return { rows: [], errors: ["CSV galvene: date, channel, campaign, spend. Pēc izvēles: clicks, impressions."] };
  }
  const rows: AdSpendRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!, sep);
    const rec: Record<string, string> = {};
    headers.forEach((key, idx) => {
      if (key) rec[key] = cells[idx] ?? "";
    });
    const row = normalizeAdSpendInput({
      date: rec.date,
      dateEnd: rec.dateEnd,
      product: rec.product || "provin",
      channel: rec.channel,
      campaign: rec.campaign,
      keyword: rec.keyword ?? rec.term,
      spend: rec.spend,
      clicks: rec.clicks,
      impressions: rec.impressions,
      note: rec.note,
    });
    if (!row) {
      errors.push(`Rinda ${i + 1} nav derīga.`);
      continue;
    }
    rows.push(row);
  }
  return { rows, errors };
}

export function parseAdSpendDoc(raw: unknown): AdSpendRow[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as { rows?: unknown };
  if (!Array.isArray(o.rows)) return [];
  const rows: AdSpendRow[] = [];
  for (const item of o.rows) {
    const row = normalizeAdSpendInput(item as Parameters<typeof normalizeAdSpendInput>[0]);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function eachIsoDateInclusive(start: string, end: string): string[] {
  if (!isIsoDate(start) || !isIsoDate(end)) return [];
  const out: string[] = [];
  const from = new Date(`${start}T12:00:00.000Z`);
  const to = new Date(`${end}T12:00:00.000Z`);
  for (let d = from.getTime(); d <= to.getTime(); d += 86_400_000) {
    out.push(new Date(d).toISOString().slice(0, 10));
  }
  return out;
}
