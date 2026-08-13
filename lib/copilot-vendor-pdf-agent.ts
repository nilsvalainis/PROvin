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
import { extractDealerReport, looksLikeDealerReport } from "@/lib/dealer-report-extract";
import {
  extractLtabCertificate,
  looksLikeLtabCertificate,
  ltabCertificateHasContent,
} from "@/lib/ltab-report-extract";
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
  vendorSourceKey,
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
  if (vendor === "autodna") return "AutoDNA";
  if (vendor === "carvertical") return "CarVertical";
  return "Oficiālā dīlera";
}

/** Zīmola noteikšana no teksta / faila nosaukuma (mērķa avots UI jau ir zināms, šis ir pārbaude). */
export function detectVendorFromReport(text: string, fileName: string): VendorReportVendor | null {
  const haystack = `${fileName}\n${text.slice(0, 6000)}`.toLowerCase();
  if (/carvertical|car\s*vertical/.test(haystack)) return "carvertical";
  if (/autodna|auto\s*dna|auto\s*v[ēe]stures\s+atskaite/.test(haystack)) return "autodna";
  if (looksLikeDealerReport(text)) return "dealer";
  return null;
}

function extractDeterministic(vendor: VendorReportVendor, text: string): VendorReportExtract {
  if (!text.trim()) return emptyVendorReportExtract(vendor);
  if (vendor === "autodna") return extractAutodnaReport(text);
  if (vendor === "carvertical") return extractCarverticalReport(text);
  return extractDealerReport(text);
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

  // Dīlera / rūpnīcas izdrukas struktūra ir stabila: Gemini tur ir tikai rezerve, ja teksta
  // slānis nedeva ne laukus, ne rindas (skenēts vai vēl neredzēts izkārtojums).
  const dealerLocalIsEnough =
    vendor === "dealer" && (Object.keys(local.vehicleInfo).length > 0 || local.mileage.length > 0);

  let ai = emptyVendorReportExtract(vendor);
  if (opts.useGemini !== false && !dealerLocalIsEnough) {
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
  const actions = buildVendorCopilotActions(resolved, vendorSourceKey(vendor));

  const missingCountry = resolved.mileage.filter((r) => !r.country.trim()).length;
  const summaryParts = [
    `${vendorLabel(vendor)} „${opts.fileName}”: ${resolved.mileage.length} nobraukuma, ${resolved.incidents.length} negadījumu ierakstu`,
  ];
  if (resolved.serviceHistory.length > 0) {
    summaryParts.push(
      `${resolved.serviceHistory.length} apkopes/remonti → Servisa un remontu vēsture`,
    );
  }
  if (missingCountry > 0) summaryParts.push(`${missingCountry} rindām valsts nav droši nosakāma (atstāta tukša)`);
  const dealerFields = Object.keys(resolved.vehicleInfo).length;
  if (dealerFields > 0) summaryParts.push(`${dealerFields} transporta informācijas lauki`);
  if (resolved.equipment.length > 0) {
    summaryParts.push(`${resolved.equipment.length} komplektācijas pozīcijas`);
  }

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

export type LtabPdfAgentResult = {
  actions: CopilotAction[];
  summary: string;
  notes: string[];
};

/** LTAB OCTA izziņa — tikai teksta slānis (formāts stabils; Gemini nav vajadzīgs). */
export async function runLtabPdfAgent(opts: {
  fileName: string;
  buffer: ArrayBuffer;
}): Promise<LtabPdfAgentResult> {
  const pdfText = await extractPdfTextDetailed(opts.buffer, { fileName: opts.fileName }).catch(() => ({
    text: "",
  }));
  const text = pdfText.text ?? "";
  const notes: string[] = [];
  if (!looksLikeLtabCertificate(text) && text.trim()) {
    notes.push(`„${opts.fileName}” neizskatās pēc tipiskas LTAB izziņas — mēģināts nolasīt CSNg tabulu tik un tā.`);
  }
  const certificate = extractLtabCertificate(text);
  if (!certificate || !ltabCertificateHasContent(certificate)) {
    return {
      actions: [],
      summary: `LTAB „${opts.fileName}”: izziņas struktūra netika nolasīta.`,
      notes: notes.length ? notes : ["PDF teksta slānis nedeva LTAB izziņas laukus."],
    };
  }
  const claims = certificate.claims.length;
  return {
    actions: [
      {
        type: "set_ltab_certificate",
        source: "ltab",
        certificate,
        confidence: "high",
        note: `LTAB izziņa (${opts.fileName})`,
      },
    ],
    summary: `LTAB izziņa „${opts.fileName}”: ${claims} CSNg ${claims === 1 ? "ieraksts" : "ieraksti"}, valsts Latvija.`,
    notes,
  };
}

