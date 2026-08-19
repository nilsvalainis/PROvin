/**
 * Periodiska reālo (produkcijas) ģenerēto komentāru izlases pārbaude.
 * Palaiž evaluateExpertCommentQuality() pret N jaunākajiem pasūtījumu melnrakstiem
 * un izvada pārskatu par promptu "driftu" / jaunām stila kļūdām.
 *
 * Lietošana: npm run eval:prod-sample [-- --n=30]
 * Dati: Vercel Blob (ADMIN_ORDER_DRAFT_BLOB_PREFIX + BLOB_READ_WRITE_TOKEN), ar
 * fallback uz lokālo .data/admin-order-drafts/ (dev vide).
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  evaluateExpertCommentQuality,
  type CommentQualityIssue,
  type CommentQualityOptions,
} from "@/lib/ai-eval/comment-quality";

const root = process.cwd();

function sampleSizeFromArgv(): number {
  const arg = process.argv.find((a) => a.startsWith("--n="));
  const n = arg ? Number.parseInt(arg.slice(4), 10) : 20;
  return Number.isFinite(n) && n > 0 ? n : 20;
}

type BlobListEntry = { pathname: string; url: string; uploadedAt: string };

async function listOrderDraftBlobs(prefix: string, token: string): Promise<BlobListEntry[]> {
  const out: BlobListEntry[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL("https://blob.vercel-storage.com");
    url.searchParams.set("prefix", prefix);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = (await res.json()) as {
      blobs?: { pathname: string; url: string; uploadedAt: string }[];
      hasMore?: boolean;
      cursor?: string;
    };
    for (const b of data.blobs ?? []) {
      if (b.pathname.endsWith(".json") && !b.pathname.includes("/_revisions/")) out.push(b);
    }
    cursor = data.hasMore ? data.cursor : undefined;
  } while (cursor);
  return out;
}

async function loadRecentDraftDocs(n: number): Promise<{ id: string; doc: unknown }[]> {
  const prefixRaw = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX?.trim() ?? "";
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (prefixRaw && token) {
    const prefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;
    const blobs = await listOrderDraftBlobs(prefix, token);
    blobs.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    const top = blobs.slice(0, n);
    const out: { id: string; doc: unknown }[] = [];
    for (const b of top) {
      const res = await fetch(b.url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      try {
        out.push({ id: path.basename(b.pathname, ".json"), doc: JSON.parse(await res.text()) });
      } catch {
        /* skip corrupt draft */
      }
    }
    return out;
  }

  const dir = path.join(root, ".data", "admin-order-drafts");
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const withStat = await Promise.all(
    names.map(async (name) => {
      const p = path.join(dir, name);
      const st = await fs.stat(p);
      return { name, p, mtime: st.mtimeMs };
    }),
  );
  withStat.sort((a, b) => b.mtime - a.mtime);
  const top = withStat.slice(0, n);
  const out: { id: string; doc: unknown }[] = [];
  for (const f of top) {
    try {
      out.push({ id: path.basename(f.name, ".json"), doc: JSON.parse(await fs.readFile(f.p, "utf8")) });
    } catch {
      /* skip corrupt draft */
    }
  }
  return out;
}

/** Atslēgas nosaukumā -> tuvākais comment-quality "field" tips. */
function inferQualityField(keyPath: string): CommentQualityOptions["field"] {
  const k = keyPath.toLowerCase();
  if (k.includes("tehnisko") || k.includes("risku") || k.includes("risks")) return "technical_risks";
  if (k.includes("apskat") || k.includes("inspection")) return "inspection";
  if (k.includes("kopsavilkum") || k.includes("summary")) return "summary";
  if (k.includes("mileage") || k.includes("nobrauk")) return "mileage";
  if (k.includes("incident") || k.includes("negadij")) return "incidents";
  if (k.includes("source") || k.includes("avot")) return "source";
  return "generic";
}

const MIN_COMMENT_LEN = 120;

/** Rekursīvi savāc "prozai līdzīgus" string laukus (ģenerēti ✨ komentāri) no melnraksta JSON. */
function collectCommentStrings(node: unknown, keyPath: string, out: Map<string, string>): void {
  if (typeof node === "string") {
    if (node.length >= MIN_COMMENT_LEN) out.set(keyPath, node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectCommentStrings(item, `${keyPath}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      collectCommentStrings(v, keyPath ? `${keyPath}.${k}` : k, out);
    }
  }
}

type SampleResult = {
  orderId: string;
  keyPath: string;
  field: CommentQualityOptions["field"];
  issues: CommentQualityIssue[];
};

async function main() {
  const n = sampleSizeFromArgv();
  const drafts = await loadRecentDraftDocs(n);
  if (drafts.length === 0) {
    console.log(
      "Nav atrasti pasūtījumu melnraksti (nedz Vercel Blob, nedz .data/admin-order-drafts/). " +
        "Iestati BLOB_READ_WRITE_TOKEN + ADMIN_ORDER_DRAFT_BLOB_PREFIX vai palaid lokāli ar datiem.",
    );
    return;
  }

  const results: SampleResult[] = [];
  for (const { id, doc } of drafts) {
    const strings = new Map<string, string>();
    collectCommentStrings((doc as { workspace?: unknown; orderEdits?: unknown })?.workspace, "workspace", strings);
    collectCommentStrings((doc as { orderEdits?: unknown })?.orderEdits, "orderEdits", strings);
    for (const [keyPath, text] of strings) {
      const field = inferQualityField(keyPath);
      const issues = evaluateExpertCommentQuality(text, { field });
      if (issues.length > 0) results.push({ orderId: id, keyPath, field, issues });
    }
  }

  console.log(`\nPROVIN eval:prod-sample — pārbaudīti ${drafts.length} jaunākie melnraksti.\n`);
  if (results.length === 0) {
    console.log("Nav atrasta neviena stila/vārdu krājuma kļūda. Promptu drifts nav konstatēts.\n");
    return;
  }

  for (const r of results) {
    console.log(`[${r.orderId}] ${r.keyPath} (${r.field})`);
    for (const issue of r.issues) console.log(`  - ${issue.code}: ${issue.message}`);
  }

  const byCode = new Map<string, number>();
  for (const r of results) for (const issue of r.issues) byCode.set(issue.code, (byCode.get(issue.code) ?? 0) + 1);
  console.log(`\nKOPSAVILKUMS (${results.length} lauki ar problēmām no ${drafts.length} melnrakstiem):`);
  for (const [code, count] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}x`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("eval:prod-sample failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
