/**
 * Copilot «Gudrais režīms» - Claude rīku cilpa vienas operatora ziņas ietvarā.
 *
 * - Darbojas TIKAI, kad operators Copilot logā nosūta ziņu ar ieslēgtu «Gudrais režīms».
 *   Nav fona palaišanas, cron vai auto-trigeru; pēc atbildes cilpa beidzas.
 * - Modelis: COPILOT_MODEL (noklusējums claude-sonnet-5-5), effort high, adaptive thinking.
 *   Kļūmes / atteikuma gadījumā - claude-sonnet-5, un atbildē to pasaka.
 * - Prompt caching: sistēmas prompts + rīki (skaidri breakpointi) un sarunas prefikss
 *   (automātiskais `cache_control` pieprasījuma līmenī - katrā solī kešs pārvietojas uz beigām).
 * - Rīki tikai sagatavo priekšlikumus; rakstīšana un dzēšana - tikai ar operatora pogu.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { ADMIN_COPILOT_SYSTEM } from "@/lib/admin-copilot-ai";
import { parseCopilotAiPayload } from "@/lib/admin-copilot-parse";
import type { AiOrderContextInput } from "@/lib/admin-ai-order-context";
import { shouldAiModelFailover } from "@/lib/ai-model-failover";
import { recordAiUsage } from "@/lib/ai-usage-meter";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { CopilotAction, CopilotFieldProposal, CopilotSourceKey } from "@/lib/admin-copilot-types";
import {
  COPILOT_SECTION_FIELD,
  COPILOT_SMART_TOOLS,
  checkClientTextsBeforeSend,
  isClientCommentSourceField,
  isSmartForbiddenAction,
  listMissingFieldsForTool,
  readSourceForTool,
  validateFieldProposal,
  type CopilotAuditValues,
  type CopilotGenerateSection,
} from "@/lib/admin-copilot-smart-tools";
import { COPILOT_GENERATE_SECTIONS } from "@/lib/admin-copilot-smart-tools";

export const COPILOT_SMART_MODEL_DEFAULT = "claude-sonnet-5-5";
export const COPILOT_SMART_FALLBACK_MODEL = "claude-sonnet-5";
export const COPILOT_SMART_MAX_STEPS = 8;
const SMART_MAX_TOKENS = 32_000;
const SMART_REQUEST_TIMEOUT_MS = 240_000;
const TOOL_RESULT_MAX_CHARS = 40_000;

export function copilotSmartModel(): string {
  return process.env.COPILOT_MODEL?.trim() || COPILOT_SMART_MODEL_DEFAULT;
}

export const COPILOT_SMART_SYSTEM_ADDENDUM = `

=== SMART MODE (tools) ===
You now work in a short tool loop for ONE operator message. You have tools; there is no JSON reply schema.
- Read first when needed (read_source, list_missing_fields), then act.
- Every change goes through propose_write (or generate_comment for ✨ texts). Nothing you propose is written until the operator presses the confirm button. Deletions only when the operator asked for them.
- Copilot actions inside propose_write use exactly the action objects described above (type, source, date, ...).
- Texts for the client (comments, summary, risks, inspection plan, price fit, mileage comment): plain Latvian, PROVIN RULES apply.
- Never touch «Servisa vēsture» (serviceHistoryNotes, set_service_history).
- Paid sources (AutoDNA / CarVertical purchase, CSDD SMS izziņa, new dealer report purchase) are NOT available. If they are needed, tell the operator which button to press.
- Use as few steps as possible (max ${COPILOT_SMART_MAX_STEPS}). Then finish with a short Latvian answer for the operator: what you found, what you proposed and what still needs the operator. No markdown tables, no code fences.`;

export type CopilotAgentDeps = {
  createMessage: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
  /** Opus pulēšana (finalizeGeneratedComment) - atbildei un katram klienta tekstam. */
  polish: (text: string) => Promise<string>;
  generateComment: (section: CopilotGenerateSection, ctx: AiOrderContextInput) => Promise<string>;
  runVinScan: (opts: { sessionId: string; vin: string; listingUrl: string | null }) => Promise<string>;
  dealerReparse: (sessionId: string) => Promise<string>;
};

export type CopilotSmartAgentInput = {
  sessionId: string;
  message: string;
  /** Konteksts lietotāja ziņas sākumā: tabulas, audits, vēsture, ieslēgtie avoti. */
  contextText: string;
  pdfs?: { fileName: string; buffer: ArrayBuffer }[];
  photos?: { fileName: string; mimeType: string; buffer: ArrayBuffer }[];
  sourceBlocks: WorkspaceSourceBlocks;
  allowedSources: CopilotSourceKey[];
  auditInput: AiOrderContextInput;
  auditValues: CopilotAuditValues;
  model?: string;
  deps?: Partial<CopilotAgentDeps>;
};

export type CopilotSmartAgentResult = {
  reply: string;
  clarificationNeeded: string;
  actions: CopilotAction[];
  fieldProposals: CopilotFieldProposal[];
  /** Īss rīku žurnāls (operatora logam un testiem). */
  toolLog: string[];
  modelUsed: string;
  usedFallback: boolean;
  steps: number;
};

/* ------------------------------------------------------------------ */
/* Noklusētās atkarības (tīkls). Testi tās aizstāj.                     */
/* ------------------------------------------------------------------ */

let cachedClient: { key: string; client: Anthropic } | null = null;

function smartClient(): Anthropic {
  const key = getAnthropicApiKeyFromEnv();
  if (!key) throw new Error("missing_ai_key");
  if (cachedClient?.key === key) return cachedClient.client;
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: SMART_REQUEST_TIMEOUT_MS });
  cachedClient = { key, client };
  return client;
}

async function defaultCreateMessage(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  // Straumē, lai garš thinking + rīku ievads neaptur HTTP pieprasījumu.
  const stream = smartClient().messages.stream(params, { timeout: SMART_REQUEST_TIMEOUT_MS });
  stream.on("error", () => {});
  const message = await stream.finalMessage();
  const u = message.usage;
  recordAiUsage({
    provider: "anthropic",
    model: params.model,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
  });
  return message;
}

async function defaultPolish(text: string): Promise<string> {
  const { finalizeGeneratedComment } = await import("@/lib/admin-ai-polish");
  return finalizeGeneratedComment(text);
}

async function defaultGenerateComment(section: CopilotGenerateSection, ctx: AiOrderContextInput): Promise<string> {
  const { AI_ADMIN_FIELD_DEFAULT_TIER } = await import("@/lib/ai-admin-field-defaults");
  switch (section) {
    case "summary": {
      const m = await import("@/lib/admin-ai-summary");
      return m.generateSummaryAnalysisWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.summary });
    }
    case "technical_risks": {
      const m = await import("@/lib/admin-ai-technical-risks");
      return (await m.generateTechnicalRiskAnalysisWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks }))
        .text;
    }
    case "inspection": {
      const m = await import("@/lib/admin-ai-inspection");
      return m.generateInspectionRecommendationsWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.inspection });
    }
    case "price": {
      const m = await import("@/lib/admin-ai-price");
      return m.generatePriceAnalysisWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.price });
    }
    case "incidents": {
      const m = await import("@/lib/admin-ai-incidents-summary");
      return m.generateIncidentsSummaryWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.incidents });
    }
    case "mileage": {
      const m = await import("@/lib/admin-ai-mileage-comment");
      return m.generateMileageCommentWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.mileage });
    }
    case "sources_comparison": {
      const m = await import("@/lib/admin-ai-sources-comparison");
      return m.generateSourcesComparisonWithAi({ ...ctx, modelTier: AI_ADMIN_FIELD_DEFAULT_TIER.sources_comparison });
    }
  }
}

async function defaultRunVinScan(opts: { sessionId: string; vin: string; listingUrl: string | null }): Promise<string> {
  const [{ after }, { runOrderFreeVinScan }] = await Promise.all([
    import("next/server"),
    import("@/lib/order-vin-scan-run"),
  ]);
  after(() =>
    runOrderFreeVinScan(opts.sessionId, { vin: opts.vin, listingUrl: opts.listingUrl, force: true }).catch((err) =>
      console.error("[copilot-agent] vin_scan", err),
    ),
  );
  return "Bezmaksas VIN SCAN palaists fonā. Rezultāti VIN SCAN blokā pēc ~1 min (šī ziņa tos neredzēs).";
}

async function defaultDealerReparse(sessionId: string): Promise<string> {
  const { reparseDealerDataFromRaw } = await import("@/lib/dealer-data-job");
  const r = await reparseDealerDataFromRaw({ sessionId });
  if (r.ok) return "Dīlera dati pārparsēti no saglabātā RAW (bez maksas). Pārlādē OFICIĀLĀ DĪLERA DATI bloku.";
  const reason = String(r.reason ?? "");
  if (reason.startsWith("reparse_blocked:")) {
    return "Saglabātā RAW nav vai vajag maksas soli - jaunu dīlera ielasi palaiž operators ar pogu.";
  }
  return `Pārparsēt neizdevās (${reason.slice(0, 120) || "nezināms iemesls"}).`;
}

/* ------------------------------------------------------------------ */
/* Cilpa                                                               */
/* ------------------------------------------------------------------ */

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function messageText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function clipToolText(text: string): string {
  return text.length > TOOL_RESULT_MAX_CHARS ? `${text.slice(0, TOOL_RESULT_MAX_CHARS)}… (nogriezts)` : text;
}

function buildTools(): Anthropic.Tool[] {
  return COPILOT_SMART_TOOLS.map((t, i) =>
    i === COPILOT_SMART_TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t,
  );
}

export function buildCopilotSmartSystem(): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: `${ADMIN_COPILOT_SYSTEM}${COPILOT_SMART_SYSTEM_ADDENDUM}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

export async function runCopilotSmartAgent(input: CopilotSmartAgentInput): Promise<CopilotSmartAgentResult> {
  if (!input.message.trim() && !(input.pdfs?.length || input.photos?.length)) {
    // Copilot nekad nestrādā bez operatora ziņas vai pielikuma.
    throw new Error("empty_message");
  }
  const deps: CopilotAgentDeps = {
    createMessage: defaultCreateMessage,
    polish: defaultPolish,
    generateComment: defaultGenerateComment,
    runVinScan: defaultRunVinScan,
    dealerReparse: defaultDealerReparse,
    ...input.deps,
  };
  const primary = input.model?.trim() || copilotSmartModel();
  let model = primary;
  let usedFallback = false;

  const actions: CopilotAction[] = [];
  const fieldProposals: CopilotFieldProposal[] = [];
  const toolLog: string[] = [];
  /** Audita vērtības + šīs ziņas priekšlikumi (check_pdf_before_send redz arī tos). */
  const auditView: CopilotAuditValues = { ...input.auditValues };

  const firstContent: Anthropic.ContentBlockParam[] = [];
  for (const [i, pdf] of (input.pdfs ?? []).entries()) {
    firstContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: bufferToBase64(pdf.buffer) },
    });
    firstContent.push({ type: "text", text: `[PDF ${i + 1}: ${pdf.fileName}]` });
  }
  for (const [i, photo] of (input.photos ?? []).entries()) {
    firstContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: photo.mimeType as Anthropic.Base64ImageSource["media_type"],
        data: bufferToBase64(photo.buffer),
      },
    });
    firstContent.push({ type: "text", text: `[FOTO ${i + 1}: ${photo.fileName}. Only legibly visible values.]` });
  }
  firstContent.push({ type: "text", text: input.contextText });
  firstContent.push({
    type: "text",
    text: `=== OPERATOR MESSAGE ===\n${input.message.trim() || "(tikai pielikums - izvelc datus)"}`,
  });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: firstContent }];
  const system = buildCopilotSmartSystem();
  const tools = buildTools();

  async function runTool(block: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
    const args = (block.input && typeof block.input === "object" ? block.input : {}) as Record<string, unknown>;
    const done = (content: string, isError = false): Anthropic.ToolResultBlockParam => ({
      type: "tool_result",
      tool_use_id: block.id,
      content: clipToolText(content),
      ...(isError ? { is_error: true } : {}),
    });
    toolLog.push(block.name);
    try {
      switch (block.name) {
        case "read_source": {
          const r = readSourceForTool(input.sourceBlocks, String(args.key ?? ""));
          return done(r.text, !r.ok);
        }
        case "list_missing_fields":
          return done(
            listMissingFieldsForTool({ blocks: input.sourceBlocks, audit: auditView, vin: input.auditInput.vin }),
          );
        case "propose_write": {
          const writes = Array.isArray(args.writes) ? args.writes : [];
          const lines: string[] = [];
          for (const w of writes.slice(0, 60)) {
            const o = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
            if (o.kind === "copilot_action") {
              const parsed = parseCopilotAiPayload(
                JSON.stringify({ reply: "", clarificationNeeded: "", actions: [o.action] }),
              ).actions[0];
              if (!parsed) {
                lines.push("noraidīts: nederīga darbība");
                continue;
              }
              if (isSmartForbiddenAction(parsed)) {
                lines.push("noraidīts: «Servisa vēsture» netiek mainīta");
                continue;
              }
              actions.push(parsed);
              lines.push(`pieņemts (gaida apstiprinājumu): ${parsed.type} ${parsed.source}`);
              continue;
            }
            const r = validateFieldProposal(o, { blocks: input.sourceBlocks, audit: auditView });
            if (!r.ok) {
              lines.push(`noraidīts: ${r.error}`);
              continue;
            }
            const p = r.proposal;
            const needsPolish = p.kind === "audit_field" || isClientCommentSourceField(p.field);
            const value = needsPolish ? await deps.polish(p.value) : p.value;
            const proposal = { ...p, value } as CopilotFieldProposal;
            fieldProposals.push(proposal);
            if (proposal.kind === "audit_field") auditView[proposal.field] = value;
            lines.push(`pieņemts (gaida apstiprinājumu): ${proposal.label}`);
          }
          return done(lines.length ? lines.join("\n") : "Nav neviena ieraksta.", lines.length === 0);
        }
        case "run_vin_scan": {
          const vin = input.auditInput.vin?.trim() ?? "";
          if (!vin) return done("Pasūtījumā nav VIN.", true);
          return done(await deps.runVinScan({ sessionId: input.sessionId, vin, listingUrl: input.auditInput.listingUrl }));
        }
        case "run_dealer_ingest":
          return done(await deps.dealerReparse(input.sessionId));
        case "generate_comment": {
          const section = String(args.section ?? "") as CopilotGenerateSection;
          if (!(COPILOT_GENERATE_SECTIONS as readonly string[]).includes(section)) {
            return done(`Nezināma sadaļa „${section}”.`, true);
          }
          const field = COPILOT_SECTION_FIELD[section];
          const notes = typeof args.operatorNotes === "string" ? args.operatorNotes : "";
          const raw = await deps.generateComment(section, {
            ...input.auditInput,
            ...(notes ? { operatorNotes: notes } : {}),
          });
          if (!raw.trim()) return done("Ģenerators atgrieza tukšu tekstu.", true);
          const value = await deps.polish(raw);
          const r = validateFieldProposal(
            { kind: "audit_field", field, value },
            { blocks: input.sourceBlocks, audit: auditView },
          );
          if (!r.ok) return done(r.error, true);
          fieldProposals.push(r.proposal);
          auditView[field] = value;
          return done(`Sagatavots priekšlikums laukam „${r.proposal.label}” (gaida apstiprinājumu):\n${value}`);
        }
        case "check_pdf_before_send":
          return done(checkClientTextsBeforeSend(auditView));
        default:
          return done(`Nezināms rīks „${block.name}”.`, true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return done(`Rīks neizdevās: ${msg.slice(0, 300)}`, true);
    }
  }

  let finalText = "";
  let steps = 0;
  let lastMessage: Anthropic.Message | null = null;
  while (steps < COPILOT_SMART_MAX_STEPS) {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: SMART_MAX_TOKENS,
      system,
      tools,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      // Automātiskais kešs: breakpoint pārvietojas uz pēdējo bloku katrā solī.
      cache_control: { type: "ephemeral" },
    };
    let message: Anthropic.Message;
    try {
      message = await deps.createMessage(params);
    } catch (e) {
      if (!usedFallback && model !== COPILOT_SMART_FALLBACK_MODEL && shouldAiModelFailover(e)) {
        model = COPILOT_SMART_FALLBACK_MODEL;
        usedFallback = true;
        continue;
      }
      throw e;
    }
    if (message.stop_reason === "refusal" && !usedFallback && model !== COPILOT_SMART_FALLBACK_MODEL) {
      model = COPILOT_SMART_FALLBACK_MODEL;
      usedFallback = true;
      continue;
    }
    steps += 1;
    lastMessage = message;
    // Saturu (arī thinking blokus) atdod atpakaļ nemainītu.
    messages.push({ role: "assistant", content: message.content as Anthropic.ContentBlockParam[] });
    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      finalText = messageText(message);
      break;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) results.push(await runTool(tu));
    messages.push({ role: "user", content: results });
  }

  if (!finalText && lastMessage?.stop_reason === "refusal") {
    finalText = "Modelis atteicās apstrādāt šo pieprasījumu. Pamēģini pārformulēt vai lieto parasto režīmu.";
  }
  if (!finalText) {
    const partial = lastMessage ? messageText(lastMessage) : "";
    finalText =
      partial ||
      (steps >= COPILOT_SMART_MAX_STEPS
        ? `Sasniegts soļu limits (${COPILOT_SMART_MAX_STEPS}). Sagatavotais ir zemāk; turpini ar jaunu ziņu.`
        : "Gatavs.");
  }
  let reply = await deps.polish(finalText);
  if (usedFallback) reply = `${reply}\n\nStrādāja rezerves modelis (${model}).`;

  return {
    reply,
    clarificationNeeded: "",
    actions,
    fieldProposals,
    toolLog,
    modelUsed: model,
    usedFallback,
    steps,
  };
}
