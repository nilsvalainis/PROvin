/**
 * CLI: status | backfill | promote — bez browsera.
 * Izsauc caur: npm run audit:knowledge -- status|backfill|promote
 */
import {
  backfillAuditAggregateLearnings,
  promoteAuditKnowledgeCandidates,
} from "@/lib/admin-ai-aggregate-knowledge";
import { summarizeAuditLearnings } from "@/lib/admin-audit-learnings-store";

async function main() {
  const cmd = process.argv[2] ?? "status";
  if (cmd === "status") {
    const s = await summarizeAuditLearnings();
    console.log(JSON.stringify(s, null, 2));
    return;
  }
  if (cmd === "backfill") {
    const limitArg = process.argv.find((a) => a.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 120;
    const result = await backfillAuditAggregateLearnings({
      limit: Number.isFinite(limit) ? limit : 120,
    });
    const summary = await summarizeAuditLearnings();
    console.log(JSON.stringify({ ...result, summary }, null, 2));
    return;
  }
  if (cmd === "promote") {
    const result = await promoteAuditKnowledgeCandidates({ writeFile: true });
    console.log(
      JSON.stringify(
        {
          candidateCount: result.candidateCount,
          markdownChars: result.markdownChars,
          outputPath: result.outputPath,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.error("Lietošana: status | backfill [--limit=120] | promote");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
