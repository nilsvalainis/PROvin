/**
 * A/B ģenerators: vecais (v1) vs v2 tehnisko risku teksts uz 20 slotiem.
 * TIKAI LASA: melnrakstus no lokāla Blob backup kataloga (--drafts-dir). Blob/prod neraksta.
 * Ievade un izeja ir ārpus repo (satur klientu datus); repo glabā tikai kodu.
 *
 * npx tsx --import ./scripts/stub-server-only.mjs scripts/tech-risk-ab-generate.ts \
 *   --slots=/abs/slots.json --drafts-dir=/abs/admin-order-drafts --out=/abs/ab-generated.json [--only=1,2]
 *
 * slots.json: { orders: [{ slot, label, sessionId, vin, notes?, gold? }] }
 * Modeļi: v1 = "gemini" (Gemini 2.5 Pro, kā adminā noklusējumā); v2 = karte "lite" + Gemini 2.5 Pro + Flash QA. Opus netiek lietots.
 */
import fs from "node:fs";
import path from "node:path";

// Drošība: bez Blob tokena neviens koda ceļš nevar rakstīt produkcijas krātuvē.
for (const k of Object.keys(process.env)) {
  if (/^BLOB_|_BLOB_|KV_|REDIS|DATABASE_URL|POSTGRES/i.test(k)) delete process.env[k];
}

function arg(name: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : "";
}

type Slot = { slot: number; label: string; sessionId: string; vin?: string; notes?: string; gold?: string };
type ArmResult = { text: string; map?: unknown; lintWarning?: string | null; usd: number; models: string[]; calls?: number; error?: string; ms: number };

async function main() {
  const slotsPath = arg("slots");
  const draftsDir = arg("drafts-dir");
  const outPath = arg("out");
  if (!slotsPath || !draftsDir || !outPath) throw new Error("vajag --slots, --drafts-dir, --out");
  const repo = path.resolve(process.cwd());
  if (path.resolve(outPath).startsWith(repo + path.sep)) throw new Error("--out jābūt ārpus repo (klientu dati)");
  const only = new Set(arg("only").split(",").filter(Boolean).map(Number));

  const { generateTechnicalRiskAnalysisWithAi } = await import("@/lib/admin-ai-technical-risks");
  const { mergeSourceBlocksFromBody, parseAiOrderContextFromBody } = await import("@/lib/admin-ai-api-body");
  const { withAiUsageMeter } = await import("@/lib/ai-usage-meter");

  const slots = (JSON.parse(fs.readFileSync(slotsPath, "utf8")) as { orders: Slot[] }).orders;
  const out: Record<string, unknown> = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  const results = (out.results ?? {}) as Record<string, { old?: ArmResult; new?: ArmResult }>;

  for (const s of slots) {
    if (only.size && !only.has(s.slot)) continue;
    const draft = JSON.parse(fs.readFileSync(path.join(draftsDir, `${s.sessionId}.json`), "utf8")) as {
      workspace?: Record<string, unknown>;
      orderEdits?: Record<string, unknown>;
    };
    const w = draft.workspace ?? {};
    const edits = draft.orderEdits ?? {};
    // Gala sekciju teksti (tehniskie riski, apskate, kopsavilkums, cena) netiek doti: tie satur zelta atbildi.
    const body: Record<string, unknown> = {
      sessionId: s.sessionId,
      vin: s.vin ?? "",
      notes: s.notes ?? "",
      sourceBlocks: w.sourceBlocks ?? {},
      internalComment: edits.internalComment ?? "",
      mileageComment: edits.mileageComment ?? "",
      modelTier: "gemini",
    };
    const ctx = parseAiOrderContextFromBody(body, mergeSourceBlocksFromBody(body));
    const cur = results[String(s.slot)] ?? {};
    for (const arm of ["old", "new"] as const) {
      if (cur[arm]?.text && !cur[arm]?.error) continue;
      if (arm === "new") process.env.TECH_RISK_V2 = "1";
      else delete process.env.TECH_RISK_V2;
      const t0 = Date.now();
      try {
        // Ārējais mērītājs saglabā izmaksas arī tad, ja ģenerēšana met kļūdu.
        const { result: wrapped, usage } = await withAiUsageMeter(async () => {
          try {
            return { ok: await generateTechnicalRiskAnalysisWithAi(ctx) };
          } catch (err) {
            return { err };
          }
        });
        if ("err" in wrapped) {
          const m = wrapped.err instanceof Error ? wrapped.err.message : "unknown";
          cur[arm] = { text: "", usd: usage.usdEstimate ?? 0, models: usage.models, calls: usage.calls, error: m.slice(0, 300), ms: Date.now() - t0 };
          throw Object.assign(new Error(m), { recorded: true });
        }
        const result = wrapped.ok;
        const models = usage.models;
        const calls = usage.calls;
        if (models.some((m) => /opus/i.test(m))) throw new Error(`opus_used:${models.join(",")}`);
        cur[arm] = {
          text: result.text,
          map: result.technicalRiskMap ?? null,
          lintWarning: result.lintWarning ?? null,
          usd: usage.usdEstimate ?? 0,
          models,
          calls,
          ms: Date.now() - t0,
        };
      } catch (e) {
        if (!(e as { recorded?: boolean }).recorded) cur[arm] = { text: "", usd: 0, models: [], error: e instanceof Error ? e.message.slice(0, 300) : "unknown", ms: Date.now() - t0 };
      }
      delete process.env.TECH_RISK_V2;
      results[String(s.slot)] = cur;
      out.results = results;
      out.updatedAt = new Date().toISOString();
      fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
      console.log(`slot ${s.slot} ${arm}: ${cur[arm]?.error ? "ERR " + cur[arm]?.error : "ok"} $${(cur[arm]?.usd ?? 0).toFixed(3)} ${cur[arm]?.ms}ms`);
    }
  }
  const all = Object.values(results).flatMap((r) => [r.old, r.new]).filter(Boolean) as ArmResult[];
  console.log(`kopā USD ~${all.reduce((n, r) => n + r.usd, 0).toFixed(2)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
