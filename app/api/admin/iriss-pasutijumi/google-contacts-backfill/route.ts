import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { indexGoogleContactPhonesAndEmails, orderHasMatchableGoogleContact } from "@/lib/google-contact-match";
import {
  decideGoogleContactBackfillRow,
  emptyGoogleContactBackfillCounts,
  GOOGLE_CONTACTS_BACKFILL_WRITE_DELAY_MS,
  nextGoogleContactBackfillCursor,
  parseGoogleContactBackfillQuery,
  tallyGoogleContactBackfillDecision,
  type GoogleContactBackfillCounts,
} from "@/lib/google-contacts-backfill";
import {
  emptyGoogleContactDirectoryCache,
  findExistingGoogleContact,
  getGoogleContactsAccessToken,
  linkGoogleContactForOrder,
  readGoogleContactsConfig,
  type GoogleContactSyncResult,
} from "@/lib/google-contacts";
import { applyGoogleContactSync } from "@/lib/iriss-google-contact-fields";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import {
  isIrissPasutijumiStoreEnabled,
  listIrissPasutijumi,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const runtime = "nodejs";
export const maxDuration = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistLinkedOrder(rec: IrissPasutijumsRecord, result: GoogleContactSyncResult): Promise<boolean> {
  const next = applyGoogleContactSync(rec, {
    status: result.status,
    resourceName: result.resourceName,
    error: result.error,
  });
  const w = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(rec) });
  if (w.ok) return true;
  if (!w.stale) return false;
  const fresh = await readIrissPasutijums(rec.id);
  if (!fresh) return false;
  const retry = applyGoogleContactSync(fresh, {
    status: result.status,
    resourceName: result.resourceName,
    error: result.error,
  });
  const w2 = await writeIrissPasutijums(retry, { expectedWorkspaceRevision: irissWorkspaceRevision(fresh) });
  return w2.ok;
}

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  if (!readGoogleContactsConfig()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const { dryRun, cursor, limit } = parseGoogleContactBackfillQuery(url);
  const rows = await listIrissPasutijumi();
  const ids = rows.map((row) => row.id);
  const slice = ids.slice(cursor, cursor + limit);
  const page = nextGoogleContactBackfillCursor(cursor, slice.length, ids.length);
  const counts: GoogleContactBackfillCounts = emptyGoogleContactBackfillCounts(ids.length);

  const token = await getGoogleContactsAccessToken();
  if (!token) return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  const cache = emptyGoogleContactDirectoryCache();

  for (const id of slice) {
    const rec = await readIrissPasutijums(id);
    if (!rec) {
      counts.errors.push({ id, error: "not_found" });
      continue;
    }
    if (rec.googleContactResourceName?.trim()) {
      tallyGoogleContactBackfillDecision(counts, "alreadyLinked", dryRun);
      continue;
    }
    if (!orderHasMatchableGoogleContact(rec)) {
      tallyGoogleContactBackfillDecision(counts, "skippedNoContact", dryRun);
      continue;
    }

    if (dryRun) {
      try {
        const existing = await findExistingGoogleContact(token, rec, cache);
        const kind = decideGoogleContactBackfillRow(rec, existing);
        tallyGoogleContactBackfillDecision(counts, kind, true);
        if (kind === "create") {
          indexGoogleContactPhonesAndEmails(cache, `pending/${rec.id}`, rec);
        }
      } catch (e) {
        counts.errors.push({
          id,
          error: e instanceof Error ? e.message.slice(0, 180) : "lookup_failed",
        });
      }
      continue;
    }

    const result = await linkGoogleContactForOrder(rec, { token, cache });
    if (result.status === "skipped") {
      tallyGoogleContactBackfillDecision(counts, "skippedNoContact", false);
      continue;
    }
    if (result.status !== "saved" || !result.resourceName) {
      counts.errors.push({ id, error: result.error || result.status || "sync_failed" });
      continue;
    }
    const kind = result.linked === "created" ? "create" : "match";
    const wrote = await persistLinkedOrder(rec, result);
    if (!wrote) {
      counts.errors.push({ id, error: "write_failed" });
      continue;
    }
    tallyGoogleContactBackfillDecision(counts, kind, false);
    await delay(GOOGLE_CONTACTS_BACKFILL_WRITE_DELAY_MS);
  }

  return NextResponse.json({
    total: counts.total,
    alreadyLinked: counts.alreadyLinked,
    created: counts.created,
    matched: counts.matched,
    skippedNoContact: counts.skippedNoContact,
    wouldCreate: counts.wouldCreate,
    wouldMatch: counts.wouldMatch,
    errors: counts.errors,
    dryRun,
    processed: page.processed,
    nextCursor: page.nextCursor,
    done: page.done,
  });
}
