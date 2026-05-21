import fs from "node:fs/promises";
import path from "node:path";
import { buildArtisMilicinsConsultationDraft } from "../lib/consultation-recovery-artis-milicins";

const sessionId = (process.argv[2] ?? "").trim();
if (!sessionId) {
  console.error("Trūkst sessionId.");
  process.exit(1);
}

const doc = buildArtisMilicinsConsultationDraft(sessionId);
const dir = path.join(process.cwd(), ".data", "admin-consultation-drafts");
await fs.mkdir(dir, { recursive: true });
const fp = path.join(dir, `${sessionId}.json`);
const tmp = `${fp}.tmp`;
await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
await fs.rename(tmp, fp);
console.log(`Saglabāts: ${fp}`);
