/**
 * Fāze 0 ieguve: gatavo komentāru stils + terminu biežums.
 * Nekopē faktus — anonimizē skaitļus, datumus, EUR, VIN.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { evaluateExpertCommentQuality, type CommentQualityOptions } from "@/lib/ai-eval/comment-quality";

const root = process.cwd();

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
      blobs?: BlobListEntry[];
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
    const out: { id: string; doc: unknown }[] = [];
    for (const b of blobs.slice(0, n)) {
      const res = await fetch(b.url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      try {
        out.push({ id: path.basename(b.pathname, ".json"), doc: JSON.parse(await res.text()) });
      } catch {
        /* skip */
      }
    }
    return out;
  }

  const dir = path.join(root, ".data", "admin-order-drafts");
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
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
  const out: { id: string; doc: unknown }[] = [];
  for (const f of withStat.slice(0, n)) {
    try {
      out.push({ id: path.basename(f.name, ".json"), doc: JSON.parse(await fs.readFile(f.p, "utf8")) });
    } catch {
      /* skip */
    }
  }
  return out;
}

function inferQualityField(keyPath: string): CommentQualityOptions["field"] {
  const k = keyPath.toLowerCase();
  if (k.includes("tehnisko") || k.includes("risku")) return "technical_risks";
  if (k.includes("apskat") || k.includes("inspection") || k.includes("apskatespl")) return "inspection";
  if (k.includes("kopsavilkum") || k.includes("iriss") || k.includes("summary")) return "summary";
  if (k.includes("mileage") || k.includes("nobrauk")) return "mileage";
  if (k.includes("incident") || k.includes("internalcomment") || k.includes("negadij")) return "incidents";
  if (k.includes("comment")) return "source";
  return "generic";
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function anonymize(text: string): string {
  return text
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[e-pasts]")
    .replace(/(\+371\s*)?2[\d\s-]{6,12}/g, "[tālrunis]")
    .replace(/\bcs_[a-zA-Z0-9]+\b/g, "[pasūtījums]")
    .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g, "[datums]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[datums]")
    .replace(/\b\d[\d\s]{2,8}\s*km\b/gi, "[km]")
    .replace(/\b\d[\d\s]{0,6}(?:[.,]\d{2})?\s*(?:€|EUR|eiro)\b/gi, "[EUR]")
    .replace(/\b[A-ZĀČĒĢĪĶĻŅŠŪŽ]{2,3}-?\d{1,4}\b/g, "[NR]");
}

function collectCommentStrings(node: unknown, keyPath: string, out: Map<string, string>): void {
  if (typeof node === "string") {
    const plain = stripHtml(node);
    if (plain.length >= 80 && /[āčēģīķļņšūž]/i.test(plain)) out.set(keyPath, plain);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectCommentStrings(item, `${keyPath}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const next = keyPath ? `${keyPath}.${k}` : k;
      if (/comment|analize|plāns|plans|iriss|cenas|mileage|internal/i.test(k)) {
        collectCommentStrings(v, next, out);
      } else if (v && typeof v === "object") {
        collectCommentStrings(v, next, out);
      }
    }
  }
}

const INTEREST_TERMS = [
  "divmasu spararats",
  "hidrotransformators",
  "ieplūdes kolektors",
  "jaudas pārveidotājs",
  "virpuļvārst",
  "momenta pārveidotājs",
  "sadales ķēde",
  "zobsiksna",
  "iesmidzinātājs",
  "injektor",
  "mehatronika",
  "pneimatika",
  "lodbalst",
  "bukš",
  "buš",
  "svir",
];

async function main() {
  const nArg = process.argv.find((a) => a.startsWith("--n="));
  const n = nArg ? Number.parseInt(nArg.slice(4), 10) || 80 : 80;
  const drafts = await loadRecentDraftDocs(n);
  if (drafts.length === 0) {
    console.log(
      "Nav atrasti melnraksti (Blob vai .data/admin-order-drafts/). Korpuss paliek pie kurētajiem paraugiem lib/admin-ai-style-corpus-data.ts.",
    );
    return;
  }

  const passing: Array<{ field: string; text: string }> = [];
  const termHits = new Map<string, number>();
  let scanned = 0;

  for (const { doc } of drafts) {
    const strings = new Map<string, string>();
    collectCommentStrings((doc as { workspace?: unknown }).workspace, "workspace", strings);
    collectCommentStrings((doc as { orderEdits?: unknown }).orderEdits, "orderEdits", strings);
    for (const [keyPath, text] of strings) {
      scanned += 1;
      const field = inferQualityField(keyPath);
      const anon = anonymize(text);
      const lower = anon.toLowerCase();
      for (const term of INTEREST_TERMS) {
        if (lower.includes(term)) termHits.set(term, (termHits.get(term) ?? 0) + 1);
      }
      const issues = evaluateExpertCommentQuality(anon, { field });
      const blocking = issues.filter((i) => i.code !== "too_short" && i.code !== "too_long");
      if (blocking.length === 0 && anon.length >= 120) {
        passing.push({ field: field ?? "generic", text: anon.slice(0, 500) });
      }
    }
  }

  const outDir = path.join(root, ".data");
  await fs.mkdir(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    drafts: drafts.length,
    scannedComments: scanned,
    passingSamples: passing.slice(0, 40),
    termFrequency: [...termHits.entries()].sort((a, b) => b[1] - a[1]),
  };
  const dest = path.join(outDir, "style-corpus-candidates.json");
  await fs.writeFile(dest, JSON.stringify(payload, null, 2), "utf8");

  console.log(`\nPROVIN style:corpus:mine — ${drafts.length} melnraksti, ${scanned} komentāri.`);
  console.log(`Kvalitāti izturēja: ${passing.length}. Saglabāts: ${dest}\n`);
  console.log("Terminu biežums (kandidāti glosārijam):");
  for (const [term, count] of payload.termFrequency) {
    console.log(`  ${count}×  ${term}`);
  }
  if (payload.termFrequency.length === 0) {
    console.log("  (nav trāpījumu pret sarakstu — paliek operatora/kanona pāri)");
  }
  console.log("");
}

main().catch((e) => {
  console.error("style:corpus:mine failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
