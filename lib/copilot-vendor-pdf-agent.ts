/**
 * Copilot avotu PDF aģents (AutoDNA / CarVertical): PDF → deterministiskais parseris + AI →
 * Copilot darbības (nobraukums, negadījumi EUR, valsts, OFICIĀLĀ DĪLERA DATI lauki).
 *
 * Divi slāņi ar nolūku: teksta slāņa parseris dod stabilo skeletu (nekad neizdomā),
 * AI pielasa to, ko teksta slānis nespēj (netipisks izkārtojums, skenēti PDF, PR kodi).
 */
import "server-only";

import { CLAUDE_MODEL_EXTRACT, aiGenerateJsonWithSchema, type AiUserPart } from "@/lib/admin-ai";
import {
  GEMINI_MODEL_PRO,
  geminiGenerateJsonWithSchema,
  type GeminiJsonSchema,
} from "@/lib/admin-gemini";
import {
  DEALER_SERVICE_WORKS_LV_SCHEMA,
  DEALER_SERVICE_WORKS_LV_SYSTEM,
  applyDealerServiceWorksLvPayload,
  collectUntranslatedServiceWorks,
} from "@/lib/dealer-service-works-lv";
import { serviceHistoryNeedsLvTranslation } from "@/lib/service-work-term-lv";
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
import { applyCcVinParsedReport, describeCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import {
  countCcVinParsedRows,
  looksLikeCcVinReport,
  parseCcVinReportText,
} from "@/lib/cc-vin-report-parse";
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

async function runAiExtract(opts: {
  vendor: VendorReportVendor;
  fileName: string;
  buffer: ArrayBuffer;
  local: VendorReportExtract;
}): Promise<VendorReportExtract> {
  const parts: AiUserPart[] = [
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

  const raw = await aiGenerateJsonWithSchema({
    model: CLAUDE_MODEL_EXTRACT,
    systemInstruction: VENDOR_PDF_AGENT_SYSTEM,
    parts,
    responseSchema: VENDOR_PDF_AGENT_SCHEMA,
    temperature: 0,
  });
  return parseVendorPdfAgentPayload(raw, opts.vendor);
}

/**
 * Dīlera darbu nosaukumu tulkojums latviski: Gemini raksta dabiskāku latviešu valodu par
 * Claude šim „brīvā teksta” uzdevumam, tāpēc ir primārais; Claude paliek rezerve, ja Gemini
 * atsakās (kvota, tīkla kļūda) — labāk tulkots ar otru modeli nekā netulkots vispār.
 */
async function translateDealerServiceWorksLv(pending: string[]): Promise<string> {
  const userText = [
    `Translate these ${pending.length} dealer service/repair work items to Latvian.`,
    "JSON array field items[].original must copy each string exactly; items[].lv is the Latvian translation.",
    JSON.stringify({ items: pending.map((original) => ({ original })) }),
  ].join("\n");

  try {
    return await geminiGenerateJsonWithSchema({
      model: GEMINI_MODEL_PRO,
      systemInstruction: DEALER_SERVICE_WORKS_LV_SYSTEM,
      parts: [{ text: userText }],
      responseSchema: DEALER_SERVICE_WORKS_LV_SCHEMA as unknown as GeminiJsonSchema,
      temperature: 0,
    });
  } catch (e) {
    console.warn(`${LOG_PREFIX} works_lv_gemini_failed`, {
      detail: e instanceof Error ? e.message : "unknown",
      pending: pending.length,
    });
    return aiGenerateJsonWithSchema({
      model: CLAUDE_MODEL_EXTRACT,
      systemInstruction: DEALER_SERVICE_WORKS_LV_SYSTEM,
      parts: [{ text: userText }],
      responseSchema: DEALER_SERVICE_WORKS_LV_SCHEMA,
      temperature: 0,
    });
  }
}

/**
 * Viena avota PDF → Copilot darbības. AI kļūme nav fatāla: paliek deterministiskais rezultāts.
 */
export async function runVendorPdfAgent(opts: {
  target: VendorReportVendor;
  fileName: string;
  buffer: ArrayBuffer;
  sourceBlocks: WorkspaceSourceBlocks;
  /** `false` — izlaiž AI (tikai teksta slānis; testiem / atkāpes režīmam). */
  useAi?: boolean;
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

  // Dīlera / rūpnīcas izdrukas struktūra ir stabila: pilnais PDF AI ir rezerve, ja
  // teksta slānis nedeva ne laukus, ne rindas. Darbu EN/DE tulkojums ir atsevišķs solis zemāk.
  const dealerLocalIsEnough =
    vendor === "dealer" && (Object.keys(local.vehicleInfo).length > 0 || local.mileage.length > 0);

  let ai = emptyVendorReportExtract(vendor);
  if (opts.useAi !== false && !dealerLocalIsEnough) {
    try {
      ai = await runAiExtract({ vendor, fileName: opts.fileName, buffer: opts.buffer, local });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown";
      console.warn(`${LOG_PREFIX} ai_failed`, { fileName: opts.fileName, detail });
      notes.push(`AI lasījums neizdevās (${detail}) — izmantots tikai PDF teksta slānis.`);
    }
  }

  let merged = mergeVendorReportExtracts(local, ai);

  // Dīlera struktūra ir stabila, bet ETK darbu nosaukumi paliek EN/DE — atsevišķs tulkojums.
  if (
    opts.useAi !== false &&
    vendor === "dealer" &&
    serviceHistoryNeedsLvTranslation(merged.serviceHistory)
  ) {
    const pending = collectUntranslatedServiceWorks(merged.serviceHistory);
    if (pending.length > 0) {
      try {
        const raw = await translateDealerServiceWorksLv(pending);
        merged = {
          ...merged,
          serviceHistory: applyDealerServiceWorksLvPayload(merged.serviceHistory, raw),
        };
      } catch (e) {
        const detail = e instanceof Error ? e.message : "unknown";
        console.warn(`${LOG_PREFIX} works_lv_failed`, {
          fileName: opts.fileName,
          detail,
          pending: pending.length,
        });
        notes.push(`Darbu tulkojums latviski neizdevās (${detail}) — paliek vārdnīcas slānis.`);
      }
    }
  }

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

export type CcVinPdfAgentResult = {
  block: CcVinBlockState | null;
  summary: string;
  notes: string[];
  rows: number;
};

/**
 * Starptautiskās vēstures atskaite — deterministisks teksta parseris (AI nav vajadzīgs).
 * Bloks tiek atgriezts jau apvienots ar esošo, lai atkārtota augšupielāde nedublē rindas.
 */
export async function runCcVinPdfAgent(opts: {
  fileName: string;
  buffer: ArrayBuffer;
  previous: CcVinBlockState | null | undefined;
}): Promise<CcVinPdfAgentResult> {
  const pdfText = await extractPdfTextDetailed(opts.buffer, { fileName: opts.fileName }).catch((e) => ({
    text: "",
    backend: "none" as const,
    errorMessage: e instanceof Error ? e.message : "unknown",
  }));
  const text = pdfText.text ?? "";
  const backend = "backend" in pdfText ? pdfText.backend : "none";
  const extractError = "errorMessage" in pdfText ? (pdfText.errorMessage ?? "") : "";

  if (!text.trim()) {
    console.warn(`${LOG_PREFIX} cc_vin_empty_text_layer`, {
      fileName: opts.fileName,
      backend,
      extractError: extractError.slice(0, 200),
    });
    return {
      block: null,
      rows: 0,
      summary: `„${opts.fileName}”: PDF teksta slāni neizdevās nolasīt (${backend}${extractError ? `: ${extractError.slice(0, 120)}` : ""}).`,
      notes: ["PDF teksta slānis bija tukšs — serverī neizdevās neviena teksta izvilkšanas metode."],
    };
  }

  const notes: string[] = [];
  if (!looksLikeCcVinReport(text, opts.fileName)) {
    notes.push(`„${opts.fileName}” neizskatās pēc tipiskas vēstures atskaites — nolasīts tik un tā.`);
  }

  const parsed = parseCcVinReportText(text);
  const rows = countCcVinParsedRows(parsed);
  if (rows === 0 && parsed.checks.length === 0) {
    return {
      block: null,
      rows: 0,
      summary: `„${opts.fileName}”: atskaites struktūra netika nolasīta.`,
      notes: notes.length > 0 ? notes : ["PDF teksta slānis nedeva vēstures ierakstus."],
    };
  }

  const odometerCheck = parsed.checks.find((c) => c.label === "Odometra ieraksti");
  const mileageRequired = Boolean(odometerCheck && odometerCheck.severity !== "ok");
  if (mileageRequired && parsed.mileage.length === 0) {
    notes.push(
      "Nobraukuma tabula ir obligāta: atskaitē ir odometra ieraksti, bet datums+km pārus neizdevās nolasīt.",
    );
  }
  const incompleteSales = parsed.sales.filter((s) => !s.date.trim() || !s.odometer.trim());
  if (incompleteSales.length > 0) {
    notes.push("Dažām izsoļu rindām trūkst datuma vai odometra — pārbaudi PĀRDOŠANAS UN IZSOĻU VĒSTURE tabulu.");
  }

  return {
    block: applyCcVinParsedReport(parsed, opts.previous),
    rows,
    summary: describeCcVinParsedReport(parsed),
    notes: [...notes, ...parsed.notes],
  };
}

export type LtabPdfAgentResult = {
  actions: CopilotAction[];
  summary: string;
  notes: string[];
};

/** LTAB OCTA izziņa — tikai teksta slānis (formāts stabils; AI nav vajadzīgs). */
export async function runLtabPdfAgent(opts: {
  fileName: string;
  buffer: ArrayBuffer;
}): Promise<LtabPdfAgentResult> {
  const pdfText = await extractPdfTextDetailed(opts.buffer, { fileName: opts.fileName }).catch((e) => ({
    text: "",
    backend: "none" as const,
    errorMessage: e instanceof Error ? e.message : "unknown",
  }));
  const text = pdfText.text ?? "";
  const notes: string[] = [];
  if (!looksLikeLtabCertificate(text) && text.trim()) {
    notes.push(`„${opts.fileName}” neizskatās pēc tipiskas LTAB izziņas — mēģināts nolasīt CSNg tabulu tik un tā.`);
  }
  const certificate = extractLtabCertificate(text);
  if (!certificate || !ltabCertificateHasContent(certificate)) {
    const backend = "backend" in pdfText ? pdfText.backend : "none";
    const extractError = "errorMessage" in pdfText ? (pdfText.errorMessage ?? "") : "";
    const emptyLayer = !text.trim();
    console.warn(`${LOG_PREFIX} ltab_extract_failed`, {
      fileName: opts.fileName,
      backend,
      textChars: text.replace(/\s/g, "").length,
      extractError: extractError.slice(0, 200),
    });
    return {
      actions: [],
      summary: emptyLayer
        ? `LTAB „${opts.fileName}”: PDF teksta slāni neizdevās nolasīt (${backend}${extractError ? `: ${extractError.slice(0, 120)}` : ""}).`
        : `LTAB „${opts.fileName}”: izziņas struktūra netika nolasīta.`,
      notes: notes.length
        ? notes
        : [
            emptyLayer
              ? "PDF teksta slānis bija tukšs — serverī neizdevās neviena teksta izvilkšanas metode."
              : "PDF teksta slānis nedeva LTAB izziņas laukus.",
          ],
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

