/**
 * 19.11 (Nila plāns): katrā «Sūtīt atskaiti» sūtījumā (arī atkārtotos «labota») saglabā visu AI komentāru lauku
 * gala tekstus pie sūtījuma versijas, lai vēlāk var salīdzināt AI v1 melnrakstu ar klientam nosūtīto tekstu.
 * Neatkarīgi no TRAINING_V2. Nekādu klienta e-pastu / tālruņu / vārdu - tikai komentāru teksti.
 */

import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";

export type ClientReportCommentSnapshot = {
  /** Sūtījuma versija (`client-report-sends`), ja serveris saglabāja PDF versiju. */
  version?: number;
  sentAt: string;
  /** Atkārtots sūtījums («labota»). */
  corrected: boolean;
  lang: string;
  /** Lauka id -> gala teksts (plain). Tukšie lauki netiek saglabāti. */
  fields: Record<string, string>;
};

/** Maks. teksta garums vienam laukam (drošībai pret milzīgiem ielīmējumiem). */
export const COMMENT_SNAPSHOT_FIELD_MAX_LEN = 40_000;
/** Cik sūtījumu snapshotu glabāt vienam pasūtījumam. */
export const COMMENT_SNAPSHOT_MAX_ENTRIES = 50;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?\b[26]\d(?:[\s-]?\d){6}\b/g;

/** Noņem e-pastus un tālruņus (komentāros tiem nevajadzētu būt, bet drošībai). */
export function scrubCommentSnapshotText(text: string): string {
  return text.replace(EMAIL_RE, "[e-pasts]").replace(PHONE_RE, "[tālrunis]");
}

function plain(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = adminRichHtmlToPlainText(raw).trim();
  return t ? scrubCommentSnapshotText(t).slice(0, COMMENT_SNAPSHOT_FIELD_MAX_LEN) : "";
}

/** Avotu bloku komentāru lauki (AI `source-comment`, dīlera piezīmes). */
const SOURCE_COMMENT_KEYS = ["comments", "serviceHistoryNotes", "oilChangeIntervalNotes"] as const;
/** Sludinājuma analīzes AI lauki (bez iekopētā teksta, pārdevēja vārda un AI konteksta). */
const LISTING_FIELDS: Array<[string, string]> = [
  ["sellerPortrait", "seller"],
  ["photoAnalysis", "listing:photoAnalysis"],
  ["listingSalesContext", "listing:listingSalesContext"],
];

/**
 * Lauku id saskan ar AI melnrakstu (`AI_DRAFT_FIELD_KEYS`): technical_risks, inspection, summary, price,
 * mileage, incidents, sources_comparison, seller; avotu komentāri - `source:<bloks>[:<lauks>]`.
 */
export function collectAiCommentFinalTexts(draft: OrderDraftState | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!draft) return out;
  const put = (key: string, raw: unknown) => {
    const t = plain(raw);
    if (t) out[key] = t;
  };
  const ws = draft.workspace;
  const edits = draft.orderEdits ?? {};
  if (ws) {
    put("technical_risks", ws.tehniskoRiskuAnalize);
    put("inspection", ws.apskatesPlāns);
    put("summary", ws.iriss);
    put("price", ws.cenasAtbilstiba);
  }
  put("mileage", edits.mileageComment);
  put("incidents", edits.internalComment);
  put("sources_comparison", edits.sourcesComparisonComment);

  const blocks = (ws?.sourceBlocks ?? null) as Record<string, unknown> | null;
  if (blocks && typeof blocks === "object") {
    for (const [blockKey, block] of Object.entries(blocks)) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (blockKey === "listing_analysis") {
        for (const [field, id] of LISTING_FIELDS) put(id, b[field]);
        continue;
      }
      if (blockKey === "citi_avoti" && Array.isArray(b.sections)) {
        b.sections.forEach((s, i) => {
          if (s && typeof s === "object") put(`source:citi_avoti:${i}`, (s as Record<string, unknown>).comments);
        });
        continue;
      }
      for (const field of SOURCE_COMMENT_KEYS) {
        put(field === "comments" ? `source:${blockKey}` : `source:${blockKey}:${field}`, b[field]);
      }
    }
  }
  return out;
}

export function buildClientReportCommentSnapshot(input: {
  draft: OrderDraftState | null | undefined;
  sentAt: string;
  lang: string;
  corrected: boolean;
  version?: number;
}): ClientReportCommentSnapshot {
  return {
    ...(typeof input.version === "number" && Number.isFinite(input.version) ? { version: input.version } : {}),
    sentAt: input.sentAt,
    corrected: input.corrected,
    lang: input.lang,
    fields: collectAiCommentFinalTexts(input.draft),
  };
}

/** Pievieno jaunu snapshotu, glabā pēdējos `COMMENT_SNAPSHOT_MAX_ENTRIES`. */
export function appendCommentSnapshot(
  prev: readonly ClientReportCommentSnapshot[],
  next: ClientReportCommentSnapshot,
): ClientReportCommentSnapshot[] {
  return [...prev, next].slice(-COMMENT_SNAPSHOT_MAX_ENTRIES);
}
