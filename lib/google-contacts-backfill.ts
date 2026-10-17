import {
  findResourceNameInGoogleContactIndex,
  indexGoogleContactPhonesAndEmails,
  orderHasMatchableGoogleContact,
  type GoogleContactMatchIndex,
} from "@/lib/google-contact-match";

export const GOOGLE_CONTACTS_BACKFILL_DEFAULT_LIMIT = 20;
export const GOOGLE_CONTACTS_BACKFILL_MAX_LIMIT = 40;
export const GOOGLE_CONTACTS_BACKFILL_WRITE_DELAY_MS = 180;

export type GoogleContactBackfillDecision = "alreadyLinked" | "skippedNoContact" | "match" | "create";

export type GoogleContactBackfillRow = {
  id: string;
  googleContactResourceName?: string;
  phone: string;
  email: string;
};

export type GoogleContactBackfillError = { id: string; error: string };

export type GoogleContactBackfillCounts = {
  total: number;
  alreadyLinked: number;
  created: number;
  matched: number;
  skippedNoContact: number;
  wouldCreate: number;
  wouldMatch: number;
  errors: GoogleContactBackfillError[];
};

export function emptyGoogleContactBackfillCounts(total = 0): GoogleContactBackfillCounts {
  return {
    total,
    alreadyLinked: 0,
    created: 0,
    matched: 0,
    skippedNoContact: 0,
    wouldCreate: 0,
    wouldMatch: 0,
    errors: [],
  };
}

export function decideGoogleContactBackfillRow(
  rec: Pick<GoogleContactBackfillRow, "googleContactResourceName" | "phone" | "email">,
  existingResourceName: string | null,
): GoogleContactBackfillDecision {
  if (rec.googleContactResourceName?.trim()) return "alreadyLinked";
  if (!orderHasMatchableGoogleContact(rec)) return "skippedNoContact";
  if (existingResourceName?.trim()) return "match";
  return "create";
}

export function tallyGoogleContactBackfillDecision(
  counts: GoogleContactBackfillCounts,
  kind: GoogleContactBackfillDecision,
  dryRun: boolean,
): void {
  if (kind === "alreadyLinked") {
    counts.alreadyLinked += 1;
    return;
  }
  if (kind === "skippedNoContact") {
    counts.skippedNoContact += 1;
    return;
  }
  if (kind === "match") {
    if (dryRun) counts.wouldMatch += 1;
    else counts.matched += 1;
    return;
  }
  if (dryRun) counts.wouldCreate += 1;
  else counts.created += 1;
}

export function mergeGoogleContactBackfillCounts(
  acc: GoogleContactBackfillCounts,
  batch: GoogleContactBackfillCounts,
): GoogleContactBackfillCounts {
  return {
    total: batch.total || acc.total,
    alreadyLinked: acc.alreadyLinked + batch.alreadyLinked,
    created: acc.created + batch.created,
    matched: acc.matched + batch.matched,
    skippedNoContact: acc.skippedNoContact + batch.skippedNoContact,
    wouldCreate: acc.wouldCreate + batch.wouldCreate,
    wouldMatch: acc.wouldMatch + batch.wouldMatch,
    errors: [...acc.errors, ...batch.errors],
  };
}

/** Dry-run / real planning with an in-memory pending index so duplicate phones in the batch count as match. */
export function planGoogleContactBackfillRows(
  rows: GoogleContactBackfillRow[],
  googleIndex: GoogleContactMatchIndex,
  dryRun: boolean,
): { counts: GoogleContactBackfillCounts; decisions: GoogleContactBackfillDecision[] } {
  const counts = emptyGoogleContactBackfillCounts(rows.length);
  const pending = {
    byPhone: new Map(googleIndex.byPhone),
    byEmail: new Map(googleIndex.byEmail),
  };
  const decisions: GoogleContactBackfillDecision[] = [];
  for (const row of rows) {
    const existing = row.googleContactResourceName?.trim()
      ? null
      : findResourceNameInGoogleContactIndex(pending, row);
    const kind = decideGoogleContactBackfillRow(row, existing);
    decisions.push(kind);
    tallyGoogleContactBackfillDecision(counts, kind, dryRun);
    if (kind === "create") {
      indexGoogleContactPhonesAndEmails(pending, `pending/${row.id}`, row);
    }
  }
  return { counts, decisions };
}

export function parseGoogleContactBackfillQuery(url: URL): { dryRun: boolean; cursor: number; limit: number } {
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const cursorRaw = Number.parseInt(url.searchParams.get("cursor") ?? "0", 10);
  const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? Math.floor(cursorRaw) : 0;
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(GOOGLE_CONTACTS_BACKFILL_MAX_LIMIT, Math.max(1, Math.floor(limitRaw)))
    : GOOGLE_CONTACTS_BACKFILL_DEFAULT_LIMIT;
  return { dryRun, cursor, limit };
}

export function nextGoogleContactBackfillCursor(
  cursor: number,
  batchSize: number,
  total: number,
): { nextCursor: string | null; done: boolean; processed: number } {
  const processed = Math.max(0, batchSize);
  const next = cursor + processed;
  const done = next >= total;
  return { nextCursor: done ? null : String(next), done, processed };
}

export function formatGoogleContactBackfillDryRunLv(c: GoogleContactBackfillCounts): string {
  return (
    `Pārbaude: ${c.total} pasūtījumi. Jau piesaistīti: ${c.alreadyLinked}. ` +
    `Bez tālruņa vai e-pasta: ${c.skippedNoContact}. ` +
    `Atradīs esošu kontaktu: ${c.wouldMatch}. Izveidos jaunu: ${c.wouldCreate}.`
  );
}

export function formatGoogleContactBackfillResultLv(c: GoogleContactBackfillCounts): string {
  const err = c.errors.length;
  return (
    `Gatavs. Izveidoti: ${c.created}. Piesaistīti esošie: ${c.matched}. ` +
    `Jau bija piesaistīti: ${c.alreadyLinked}. ` +
    `Izlaisti (nav tālruņa/e-pasta): ${c.skippedNoContact}. Kļūdas: ${err}.`
  );
}

export function formatGoogleContactBackfillConfirmLv(c: GoogleContactBackfillCounts): string {
  return (
    `${formatGoogleContactBackfillDryRunLv(c)}\n\n` +
    `Sinhronizēt šos klientus ar Google Contacts? Esošajiem kontaktiem tiks pievienota tikai etiķete IRISS klients. ` +
    `Jauni kontakti tiks izveidoti tikai tad, ja sakritība nav atrasta.`
  );
}
