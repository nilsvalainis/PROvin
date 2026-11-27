import "server-only";

import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir, readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { BLOB_CAS_ATTEMPTS, putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { readPrivateBlobText } from "@/lib/blob-read";
import { compareAndSwap } from "@/lib/conditional-write";
import {
  applyDealerCoverageOutcome,
  dealerForecastInputFromBlocks,
  dealerForecastRecordMake,
  dealerForecastYearFrom,
  dealerForecastYearFromVin,
  dealerForecastYearGroup,
  emptyDealerCoverageAggregate,
  parseDealerCoverageAggregate,
  resolveDealerForecastMake,
  type DealerCoverageAggregate,
  type DealerForecastSource,
} from "@/lib/dealer-coverage-forecast";

/**
 * Dīlera datu pārklājuma dinamiskais agregāts (27.11.2026): viens mazs JSON fails
 * `{blobPrefix}dealer_coverage/aggregate.json` - marka + gadu grupa + avots -> [ar_datiem, kopā].
 * Bez VIN un personas datiem: dublikātu aizsardzībai tikai sha256(pasūtījums|avots) pirmās 16 zīmes.
 */
const SUBDIR = "dealer_coverage";
const FILE = "aggregate.json";

function seenIdFor(sessionId: string, source: DealerForecastSource): string {
  return createHash("sha256").update(`${sessionId}|${source}`).digest("hex").slice(0, 16);
}

export async function readDealerCoverageAggregate(): Promise<DealerCoverageAggregate> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const snap = await readPrivateBlobText({ pathname: `${blob.prefix}${SUBDIR}/${FILE}`, token: blob.token });
      if (snap.state === "ok") return parseDealerCoverageAggregate(JSON.parse(snap.text));
    } catch {
      /* nav kritiski - prognoze strādā ar statisko bāzi */
    }
    if (process.env.VERCEL === "1") return emptyDealerCoverageAggregate();
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseDealerCoverageAggregate(JSON.parse(await fs.readFile(path.join(dir, SUBDIR, FILE), "utf8")));
    } catch {
      /* nav faila */
    }
  }
  return emptyDealerCoverageAggregate();
}

let localChain: Promise<unknown> = Promise.resolve();

async function updateAggregate(fn: (cur: DealerCoverageAggregate) => DealerCoverageAggregate | null): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    const pathname = `${blob.prefix}${SUBDIR}/${FILE}`;
    try {
      return await compareAndSwap<DealerCoverageAggregate, boolean>({
        read: async () => {
          const snap = await readPrivateBlobText({ pathname, token: blob.token });
          if (snap.state === "missing") return { value: null, etag: null };
          return { value: parseDealerCoverageAggregate(JSON.parse(snap.text)), etag: snap.etag };
        },
        write: async (next, etag) => {
          await putBlobBodyIfMatch({ pathname, body: JSON.stringify(next), token: blob.token, etag, seen: etag != null });
        },
        update: (cur) => {
          const next = fn(cur ?? emptyDealerCoverageAggregate());
          return next ? { next, result: true } : { result: false };
        },
        maxAttempts: BLOB_CAS_ATTEMPTS,
      });
    } catch (err) {
      console.error("[dealer-coverage] update failed", { error: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
      if (process.env.VERCEL === "1") return false;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return false;
  const run = async () => {
    const next = fn(await readDealerCoverageAggregate());
    if (!next) return false;
    const fp = path.join(dir, SUBDIR, FILE);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(`${fp}.tmp`, JSON.stringify(next), "utf8");
    await fs.rename(`${fp}.tmp`, fp);
    return true;
  };
  const p = localChain.catch(() => undefined).then(run);
  localChain = p;
  return p.catch(() => false);
}

/**
 * Pieskaita viena pasūtījuma iznākumu vienam avotam. Marka/gads no pasūtījuma CSDD bloka
 * (citādi VIN WMI / 10. zīme tikai drošām markām). Katrs pasūtījums+avots skaitās vienreiz.
 * Kļūdas klusē (prognoze nav kritiska).
 */
export async function recordDealerCoverageForSession(args: {
  sessionId: string;
  source: DealerForecastSource;
  hasData: boolean;
  vin?: string | null;
}): Promise<boolean> {
  try {
    const draft = await readOrderDraft(args.sessionId);
    const blocks = draft?.workspace?.sourceBlocks ? mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks) : null;
    const vin = (args.vin ?? "").trim();
    const input = dealerForecastInputFromBlocks(blocks, vin);
    const make = resolveDealerForecastMake(input);
    const year = dealerForecastYearFrom(input.year ?? null) ?? dealerForecastYearFromVin(vin, make);
    const outcome = {
      seenId: seenIdFor(args.sessionId, args.source),
      source: args.source,
      make: dealerForecastRecordMake(make),
      yearGroup: dealerForecastYearGroup(year),
      hasData: args.hasData,
    };
    return await updateAggregate((cur) => {
      const { next, changed } = applyDealerCoverageOutcome(cur, outcome);
      return changed ? next : null;
    });
  } catch (err) {
    console.error("[dealer-coverage] record failed", { error: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
    return false;
  }
}
