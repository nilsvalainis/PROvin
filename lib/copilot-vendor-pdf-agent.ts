/**
 * Copilot avotu PDF aģents (AutoDNA / CarVertical): PDF → deterministiskais parseris + Gemini →
 * Copilot darbības (nobraukums, negadījumi EUR, valsts, OFICIĀLĀ DĪLERA DATI lauki).
 *
 * Divi slāņi ar nolūku: teksta slāņa parseris dod stabilo skeletu (nekad neizdomā),
 * Gemini pielasa to, ko teksta slānis nespēj (netipisks izkārtojums, skenēti PDF, PR kodi).
 */
import "server-only";

import { GEMINI_MODEL_PRO, geminiGenerateJsonWithSchema, type GeminiUserPart } from "@/lib/admin-gemini";
import type { CopilotAction } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { extractAutodnaReport } from "@/lib/autodna-report-extract";
import { extractCarverticalReport } from "@/lib/carvertical-report-extract";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import {
  parseVendorPdfAgentPayload,
  VENDOR_PDF_AGENT_SCHEMA,
  VENDOR_PDF_AGENT_SYSTEM,
} from "@/lib/vendor-pdf-agent-payload";
import {
  buildVendorCopilotActions,
  mergeVendorReportExtracts,
  resolveExtractCountries,
} from "@/lib/vendor-pdf-agent-merge";
import {
  emptyVendorReportExtract,
  type VendorReportExtract,
  type VendorReportVendor,
} from "@/lib/vendor-report-extract";
import { collectWorkspaceCountryTimeline } from "@/lib/workspace-country-timeline";

const LOG_PREFIX = "[copilot/vendor-pdf]";

export type VendorPdfAgentResult = {
  vendor: VendorReportVendor;
  extract: VendorReportExtract;
  actions: CopilotAction[];
  /** Operatoram redzamā kopsavilkuma rinda. */
  summary: string;
  notes: string[];
};

function vendorLabel(vendor: VendorReportVendor): string {
  return vendor === "autodna" ? "AutoDNA" : "CarVertical";
}

/** Zīmola noteikšana no teksta / faila nosaukuma (mērķa avots UI jau ir zināms, šis ir pārbaude). */
export function detectVendorFromReport(text: string, fileName: string): VendorReportVendor | null {
  const haystack = `${fileName}\n${text.slice(0, 6000)}`.toLowerCase();
  if (/carvertical|car\s*vertical/.test(haystack)) return "carvertical";
  if (/autodna|auto\s*dna|auto\s*v[ēe]stures\s+atskaite/.test(haystack)) return "autodna";
  return null;
}

function extractDeterministic(vendor: VendorReportVendor, text: string): VendorReportExtract {
  if (!text.trim()) return emptyVendorReportExtract(vendor);
  return vendor === "autodna" ? extractAutodnaReport(text) : extractCarverticalReport(text);
}

async function runGeminiExtract(opts: {
  vendor: VendorReportVendor;
  fileName: string;
  buffer: ArrayBuffer;
  local: VendorReportExtract;
}): Promise<VendorReportExtract> {
  const parts: GeminiUserPart[] = [
    { inlineData: { mimeType: "application/pdf", data: Buffer.from(opts.buffer).toString("base64") } },
    {
      text: [
        `Vendor: ${vendorLabel(opts.vendor)} (${opts.vendor}). File: ${opts.fileName}.`,
        "Read the whole PDF (all pages, both table columns, timeline sections) and extract every record.",
        opts.local.mileage.length > 0
          ? `The PROVIN text-layer parser already found ${opts.local.mileage.length} odometer, ${opts.local.incidents.length} damage and ${opts.local.serviceHistory.length} service records. Return the COMPLETE list anyway (yours is verified independently).`
          : "The PROVIN text-layer parser found nothing — you are the only extraction pass, so be exhaustive.",
        "Return JSON matching the schema.",
      ].join("\n"),
    },
  ];

  const raw = await geminiGenerateJsonWithSchema({
    model: GEMINI_MODEL_PRO,
    systemInstruction: VENDOR_PDF_AGENT_SYSTEM,
    parts,
    responseSchema: VENDOR_PDF_AGENT_SCHEMA,
    temperature: 0,
  });
  return parseVendorPdfAgentPayload(raw, opts.vendor);
}

/**
 * Viena avota PDF → Copilot darbības. Gemini kļūme nav fatāla: paliek deterministiskais rezultāts.
 */
export async function runVendorPdfAgent(opts: {
  target: VendorReportVendor;
  fileName: string;
  buffer: ArrayBuffer;
  sourceBlocks: WorkspaceSourceBlocks;
  /** `false` — izlaiž Gemini (tikai teksta slānis; testiem / atkāpes režīmam). */
  useGemini?: boolean;
}): Promise<VendorPdfAgentResult> {
  const pdfText = await extractPdfTextDetailed(opts.buffer, { fileName: opts.fileName }).catch(() => ({
    text: "",
  }));
  const text = pdfText.text ?? "";

  const detected = detectVendorFromReport(text, opts.fileName);
  const vendor = detected ?? opts.target;
  const notes: string[] = [];
  if (detected && detected !== opts.target) {
    notes.push(
      `„${opts.fileName}” izskatās pēc ${vendorLabel(detected)} atskaites, bet augšupielādēts ${vendorLabel(opts.target)} blokā — dati salikti pēc faila satura.`,
    );
  }

  const local = extractDeterministic(vendor, text);

  let ai = emptyVendorReportExtract(vendor);
  if (opts.useGemini !== false) {
    try {
      ai = await runGeminiExtract({ vendor, fileName: opts.fileName, buffer: opts.buffer, local });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown";
      console.warn(`${LOG_PREFIX} gemini_failed`, { fileName: opts.fileName, detail });
      notes.push(`Gemini lasījums neizdevās (${detail}) — izmantots tikai PDF teksta slānis.`);
    }
  }

  const merged = mergeVendorReportExtracts(local, ai);
  const resolved = resolveExtractCountries(merged, collectWorkspaceCountryTimeline(opts.sourceBlocks));
  const actions = buildVendorCopilotActions(resolved, vendor);

  const missingCountry = resolved.mileage.filter((r) => !r.country.trim()).length;
  const summaryParts = [
    `${vendorLabel(vendor)} „${opts.fileName}”: ${resolved.mileage.length} nobraukuma, ${resolved.incidents.length} negadījumu ierakstu`,
  ];
  if (resolved.serviceHistory.length > 0) {
    summaryParts.push(`${resolved.serviceHistory.length} apkopes/remonti → Servisa vēsture`);
  }
  if (missingCountry > 0) summaryParts.push(`${missingCountry} rindām valsts nav droši nosakāma (atstāta tukša)`);
  const dealerFields = Object.keys(resolved.vehicleInfo).length;
  if (dealerFields > 0) summaryParts.push(`${dealerFields} dīlera specifikācijas lauki`);

  console.info(`${LOG_PREFIX} ok`, {
    vendor,
    fileName: opts.fileName,
    textChars: text.length,
    localMileage: local.mileage.length,
    aiMileage: ai.mileage.length,
    mileage: resolved.mileage.length,
    incidents: resolved.incidents.length,
    actions: actions.length,
  });

  return {
    vendor,
    extract: resolved,
    actions,
    summary: summaryParts.join("; ") + ".",
    notes: [...notes, ...resolved.notes],
  };
}
