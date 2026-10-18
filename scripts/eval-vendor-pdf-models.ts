/**
 * Avotu PDF (AutoDNA / CarVertical / dīleris) AI lasījums: Gemini Flash pret Sonnet uz paraugu PDF.
 * Rezultāts izšķir, vai drīkst ieslēgt `VENDOR_PDF_PRIMARY=gemini`.
 *
 * npm run eval:vendor-pdf-models -- [PDF mape]   (noklusējums: VENDOR_PDF_EVAL_DIR vai .data/vendor-pdf-samples)
 *
 * Paraugi satur klientu datus, tāpēc glabājas ārpus git (.data/ ir .gitignore).
 * Atslēgas: GEMINI_API_KEY un ANTHROPIC_API_KEY (process.env vai .env.local).
 * Izejas kods: 0 = Gemini nav sliktāks nevienā paraugā; 1 = kādā sliktāks; 2 = eval izlaists.
 */
import fs from "node:fs";
import path from "node:path";

import {
  detectVendorFromReport,
  extractDeterministic,
  runGeminiVendorPdfExtract,
  runSonnetVendorPdfExtract,
} from "@/lib/copilot-vendor-pdf-agent";
import { loadEcbDailyRates } from "@/lib/currency-eur-convert";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { compareVendorPdfModelReads, type VendorPdfModelRead } from "@/lib/vendor-pdf-model-eval";
import type { VendorReportVendor } from "@/lib/vendor-report-extract";

const root = process.cwd();

function loadEnvLocal(): void {
  try {
    const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* nav .env.local */
  }
}

function vendorFromFileName(fileName: string): VendorReportVendor {
  const n = fileName.toLowerCase();
  if (n.includes("carvertical")) return "carvertical";
  if (n.includes("dealer") || n.includes("dileris") || n.includes("auto-records")) return "dealer";
  return "autodna";
}

async function timed(run: () => Promise<VendorPdfModelRead["extract"]>): Promise<VendorPdfModelRead> {
  const started = Date.now();
  try {
    return { extract: await run(), error: "", ms: Date.now() - started };
  } catch (e) {
    return { extract: null, error: e instanceof Error ? e.message : String(e), ms: Date.now() - started };
  }
}

async function main(): Promise<number> {
  loadEnvLocal();
  const dirArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const dir = path.resolve(root, dirArg || process.env.VENDOR_PDF_EVAL_DIR || ".data/vendor-pdf-samples");

  const missingKeys = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY"].filter((k) => !process.env[k]?.trim());
  if (missingKeys.length > 0) {
    console.log(`EVAL IZLAISTS: nav ${missingKeys.join(", ")}. Flagu VENDOR_PDF_PRIMARY atstāt sonnet.`);
    return 2;
  }
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort()
    : [];
  if (files.length === 0) {
    console.log(`EVAL IZLAISTS: mapē ${dir} nav PDF paraugu. Flagu VENDOR_PDF_PRIMARY atstāt sonnet.`);
    return 2;
  }

  await loadEcbDailyRates().catch(() => null);

  const results: Record<string, unknown>[] = [];
  let worse = 0;
  for (const fileName of files) {
    const bytes = fs.readFileSync(path.join(dir, fileName));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const text = (await extractPdfTextDetailed(buffer, { fileName }).catch(() => ({ text: "" }))).text ?? "";
    const vendor = detectVendorFromReport(text, fileName) ?? vendorFromFileName(fileName);
    const local = extractDeterministic(vendor, text);
    const opts = { vendor, fileName, buffer, local };

    const [gemini, sonnet] = await Promise.all([
      timed(() => runGeminiVendorPdfExtract(opts)),
      timed(() => runSonnetVendorPdfExtract(opts)),
    ]);
    const cmp = compareVendorPdfModelReads({ local, gemini, sonnet });
    if (!cmp.geminiNotWorse) worse++;

    console.log(
      [
        `${cmp.geminiNotWorse ? "OK   " : "SLIKT"} ${fileName} (${vendor})`,
        `  teksta slānis: ${JSON.stringify(cmp.local)}`,
        `  gemini: ${cmp.gemini ? JSON.stringify(cmp.gemini) : "kļūda"} ${gemini.ms} ms`,
        `  sonnet: ${cmp.sonnet ? JSON.stringify(cmp.sonnet) : `kļūda (${sonnet.error})`} ${sonnet.ms} ms`,
        cmp.geminiMileageRecall === null ? "" : `  gemini nobraukuma atsaukums: ${(cmp.geminiMileageRecall * 100).toFixed(0)}%`,
        cmp.reasons.length ? `  iemesli: ${cmp.reasons.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    results.push({ fileName, vendor, ...cmp, geminiMs: gemini.ms, sonnetMs: sonnet.ms });
  }

  const outDir = path.join(root, ".data", "eval");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `vendor-pdf-models-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ dir, samples: files.length, worse, results }, null, 2));

  console.log(
    worse === 0
      ? `\nREZULTĀTS: Gemini nav sliktāks nevienā no ${files.length} paraugiem. Drīkst apsvērt VENDOR_PDF_PRIMARY=gemini.`
      : `\nREZULTĀTS: Gemini sliktāks ${worse}/${files.length} paraugos. VENDOR_PDF_PRIMARY atstāt sonnet.`,
  );
  console.log(`Pārskats: ${path.relative(root, outFile)}`);
  return worse === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
