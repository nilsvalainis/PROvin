import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-ai", () => ({ getAnthropicApiKeyFromEnv: () => "test-key" }));
vi.mock("@/lib/admin-copilot-ai", () => ({ ADMIN_COPILOT_SYSTEM: "COPILOT SYSTEM" }));
vi.mock("@/lib/ai-usage-meter", () => ({ recordAiUsage: vi.fn() }));

import type Anthropic from "@anthropic-ai/sdk";
import {
  COPILOT_SMART_FALLBACK_MODEL,
  COPILOT_SMART_MAX_STEPS,
  runCopilotSmartAgent,
  type CopilotAgentDeps,
  type CopilotSmartAgentInput,
} from "@/lib/admin-copilot-agent";
import { COPILOT_SMART_TOOLS, emptyCopilotAuditValues } from "@/lib/admin-copilot-smart-tools";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { COPILOT_SOURCE_KEYS } from "@/lib/admin-copilot-types";

type Block = Anthropic.ContentBlock;

let toolSeq = 0;
function toolUse(name: string, input: Record<string, unknown> = {}): Block {
  toolSeq += 1;
  return { type: "tool_use", id: `tu_${toolSeq}`, name, input } as unknown as Block;
}
function text(t: string): Block {
  return { type: "text", text: t, citations: null } as unknown as Block;
}
function msg(content: Block[], stop: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic.Message {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "m",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

/** Scenārijs: katrs solis = viena modeļa atbilde. Pierakstām pieprasījumus. */
function scripted(steps: Array<Anthropic.Message | Error>) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const createMessage = vi.fn(async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    calls.push(structuredClone(params));
    const next = steps.shift();
    if (!next) return msg([text("Gatavs.")]);
    if (next instanceof Error) throw next;
    return next;
  });
  return { createMessage, calls };
}

function deps(over: Partial<CopilotAgentDeps> = {}): Partial<CopilotAgentDeps> {
  return {
    polish: vi.fn(async (t: string) => `PULĒTS:${t}`),
    generateComment: vi.fn(async () => "Ģenerēts kopsavilkums."),
    runVinScan: vi.fn(async () => "VIN SCAN palaists."),
    dealerReparse: vi.fn(async () => "Dīlera dati pārparsēti."),
    ...over,
  };
}

function input(over: Partial<CopilotSmartAgentInput> = {}): CopilotSmartAgentInput {
  return {
    sessionId: "cs_test_1",
    message: "kas trūkst?",
    contextText: "=== CURRENT TABLES ===\n(tabulas)",
    sourceBlocks: mergeSourceBlocksWithDefaults({}),
    allowedSources: [...COPILOT_SOURCE_KEYS],
    auditInput: {
      sessionId: "cs_test_1",
      vin: "WBA5R1C0XLFH42873",
      listingUrl: null,
      customerName: null,
      notes: null,
      sourceBlocks: mergeSourceBlocksWithDefaults({}),
    },
    auditValues: emptyCopilotAuditValues(),
    ...over,
  };
}

function toolResults(calls: Anthropic.MessageCreateParamsNonStreaming[], callIndex: number) {
  const last = calls[callIndex]!.messages.at(-1)!;
  return (last.content as Anthropic.ToolResultBlockParam[]).filter((b) => b.type === "tool_result");
}

afterEach(() => {
  delete process.env.COPILOT_MODEL;
});

describe("Copilot gudrais režīms - pieprasījuma uzbūve", () => {
  it("«izvelc datus no PDF»: PDF dokuments, Sonnet 5.5 effort high, kešs sistēmai, rīkiem un sarunai", async () => {
    const s = scripted([
      msg(
        [
          toolUse("propose_write", {
            writes: [
              {
                kind: "copilot_action",
                action: { type: "upsert_mileage", source: "autodna", date: "12.03.2020", odometer: "123456", country: "Vācija", confidence: "high" },
              },
            ],
          }),
        ],
        "tool_use",
      ),
      msg([text("Ielasīts 1 nobraukuma ieraksts.")]),
    ]);
    const out = await runCopilotSmartAgent(
      input({
        message: "izvelc datus no PDF",
        pdfs: [{ fileName: "autodna.pdf", buffer: new TextEncoder().encode("%PDF").buffer as ArrayBuffer }],
        deps: deps({ createMessage: s.createMessage }),
      }),
    );
    const first = s.calls[0]!;
    expect(first.model).toBe("claude-sonnet-5-5");
    expect(first.output_config?.effort).toBe("high");
    expect(first.thinking).toEqual({ type: "adaptive" });
    expect(first.cache_control).toEqual({ type: "ephemeral" });
    expect((first.system as Anthropic.TextBlockParam[])[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect((first.tools!.at(-1) as Anthropic.Tool).cache_control).toEqual({ type: "ephemeral" });
    const firstContent = first.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(firstContent[0]!.type).toBe("document");
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0]!.type).toBe("upsert_mileage");
    expect(out.reply).toBe("PULĒTS:Ielasīts 1 nobraukuma ieraksts.");
    expect(out.steps).toBe(2);
  });

  it("COPILOT_MODEL maina modeli", async () => {
    process.env.COPILOT_MODEL = "claude-opus-5-5";
    const s = scripted([msg([text("Labi.")])]);
    await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(s.calls[0]!.model).toBe("claude-opus-5-5");
  });

  it("rīku sarakstā nav maksas avotu", () => {
    const names = COPILOT_SMART_TOOLS.map((t) => t.name).join(",");
    expect(names).not.toMatch(/autodna|carvertical|sms|purchase|buy|oneauto/i);
    expect(COPILOT_SMART_TOOLS.map((t) => t.name)).toEqual([
      "read_source",
      "list_missing_fields",
      "propose_write",
      "run_vin_scan",
      "run_dealer_ingest",
      "generate_comment",
      "check_pdf_before_send",
    ]);
  });
});

describe("Copilot gudrais režīms - tipiskās Nila komandas", () => {
  it("«kas trūkst?»: list_missing_fields un atbilde bez darbībām", async () => {
    const s = scripted([msg([toolUse("list_missing_fields")], "tool_use"), msg([text("Trūkst kopsavilkuma.")])]);
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    const res = toolResults(s.calls, 1);
    expect(String(res[0]!.content)).toContain("Tukši audita lauki");
    expect(out.actions).toEqual([]);
    expect(out.fieldProposals).toEqual([]);
  });

  it("«kāpēc nesakrīt nobraukums?»: parasta atbilde bez rīkiem", async () => {
    const s = scripted([msg([text("CSDD un AutoDNA atšķiras par 2 000 km 2021. gadā.")])]);
    const out = await runCopilotSmartAgent(
      input({ message: "kāpēc nesakrīt nobraukums?", deps: deps({ createMessage: s.createMessage }) }),
    );
    expect(out.steps).toBe(1);
    expect(out.toolLog).toEqual([]);
    expect(out.reply).toContain("PULĒTS:");
  });

  it("«izdzēs dublikātus»: read_source, tad dzēšanas priekšlikums (izpilda tikai poga)", async () => {
    const s = scripted([
      msg([toolUse("read_source", { key: "autodna" })], "tool_use"),
      msg(
        [
          toolUse("propose_write", {
            writes: [
              { kind: "copilot_action", action: { type: "delete_mileage", source: "autodna", date: "01.01.2020", odometer: "100000", confidence: "high" } },
            ],
          }),
        ],
        "tool_use",
      ),
      msg([text("Piedāvāju dzēst 1 dublikātu.")]),
    ]);
    const out = await runCopilotSmartAgent(
      input({ message: "izdzēs dublikātus", deps: deps({ createMessage: s.createMessage }) }),
    );
    expect(String(toolResults(s.calls, 1)[0]!.content)).toMatch(/^\{/);
    expect(out.actions.map((a) => a.type)).toEqual(["delete_mileage"]);
  });

  it("«valsts no CSDD»: nobraukuma rinda ar valsti", async () => {
    const s = scripted([
      msg(
        [
          toolUse("propose_write", {
            writes: [
              { kind: "copilot_action", action: { type: "upsert_mileage", source: "carvertical", date: "05.06.2022", odometer: "150000", country: "Latvija", confidence: "high" } },
            ],
          }),
        ],
        "tool_use",
      ),
      msg([text("Valsts ielikta.")]),
    ]);
    const out = await runCopilotSmartAgent(
      input({ message: "valsts no CSDD", deps: deps({ createMessage: s.createMessage }) }),
    );
    expect(out.actions[0]).toMatchObject({ type: "upsert_mileage", country: "Latvija" });
  });

  it("«pārģenerē kopsavilkumu»: generate_comment + Opus pulēšana pirms priekšskatījuma", async () => {
    const d = deps();
    const s = scripted([msg([toolUse("generate_comment", { section: "summary" })], "tool_use"), msg([text("Gatavs.")])]);
    const out = await runCopilotSmartAgent(
      input({ message: "pārģenerē kopsavilkumu", deps: { ...d, createMessage: s.createMessage } }),
    );
    expect(d.generateComment).toHaveBeenCalledWith("summary", expect.objectContaining({ vin: "WBA5R1C0XLFH42873" }));
    expect(out.fieldProposals).toEqual([
      expect.objectContaining({ kind: "audit_field", field: "iriss", value: "PULĒTS:Ģenerēts kopsavilkums." }),
    ]);
  });

  it("«pārģenerē tehniskos riskus ar piezīmi»: operatora piezīme nonāk ģeneratorā", async () => {
    const d = deps();
    const s = scripted([
      msg([toolUse("generate_comment", { section: "technical_risks", operatorNotes: "īsāk" })], "tool_use"),
      msg([text("Gatavs.")]),
    ]);
    const out = await runCopilotSmartAgent(input({ deps: { ...d, createMessage: s.createMessage } }));
    expect(d.generateComment).toHaveBeenCalledWith("technical_risks", expect.objectContaining({ operatorNotes: "īsāk" }));
    expect(out.fieldProposals[0]).toMatchObject({ field: "tehniskoRiskuAnalize" });
  });

  it("«pārbaudi PDF pirms sūtīšanas»: atrod «nepirkt», garo domuzīmi un avota nosaukumu", async () => {
    const audit = emptyCopilotAuditValues();
    audit.iriss = "Iesakām nepirkt — AutoDNA rāda bojājumus.";
    const s = scripted([msg([toolUse("check_pdf_before_send")], "tool_use"), msg([text("Atradu 3 lietas.")])]);
    await runCopilotSmartAgent(
      input({ message: "pārbaudi PDF pirms sūtīšanas", auditValues: audit, deps: deps({ createMessage: s.createMessage }) }),
    );
    const res = String(toolResults(s.calls, 1)[0]!.content);
    expect(res).toContain("pirkt/nepirkt");
    expect(res).toContain("garā domuzīme");
    expect(res).toContain("AutoDNA");
    expect(res).toContain("tukšs");
  });

  it("«pārbaudi PDF» redz arī šīs ziņas priekšlikumus", async () => {
    const s = scripted([
      msg([toolUse("propose_write", { writes: [{ kind: "audit_field", field: "iriss", value: "Labs auto." }] })], "tool_use"),
      msg([toolUse("check_pdf_before_send")], "tool_use"),
      msg([text("Gatavs.")]),
    ]);
    await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    const res = String(toolResults(s.calls, 2)[0]!.content);
    expect(res).not.toContain("3. Kopsavilkums: tukšs");
  });

  it("«ieraksti kopsavilkumā …»: audit_field tiek pulēts un netiek ierakstīts pats", async () => {
    const d = deps();
    const s = scripted([
      msg([toolUse("propose_write", { writes: [{ kind: "audit_field", field: "iriss", value: "Teksts." }] })], "tool_use"),
      msg([text("Gatavs.")]),
    ]);
    const out = await runCopilotSmartAgent(input({ deps: { ...d, createMessage: s.createMessage } }));
    expect(d.polish).toHaveBeenCalledWith("Teksts.");
    expect(out.fieldProposals[0]).toMatchObject({ kind: "audit_field", value: "PULĒTS:Teksts.", previous: "" });
  });

  it("«ieraksti Tirgus laukā …»: source_field priekšlikums jebkuram blokam", async () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    const tirgus = blocks.tirgus as unknown as Record<string, unknown>;
    const field = Object.keys(tirgus).find((k) => typeof tirgus[k] === "string" && !/comment/i.test(k))!;
    const s = scripted([
      msg([toolUse("propose_write", { writes: [{ kind: "source_field", source: "tirgus", field, value: "12 500 €" }] })], "tool_use"),
      msg([text("Gatavs.")]),
    ]);
    const out = await runCopilotSmartAgent(input({ sourceBlocks: blocks, deps: deps({ createMessage: s.createMessage }) }));
    expect(out.fieldProposals[0]).toMatchObject({ kind: "source_field", source: "tirgus", field, value: "12 500 €" });
  });

  it("«Servisa vēsture» netiek aiztikta", async () => {
    const s = scripted([
      msg(
        [
          toolUse("propose_write", {
            writes: [
              { kind: "copilot_action", action: { type: "set_service_history", source: "auto_records", text: "01.01.2020 | 1 km | x", confidence: "high" } },
              { kind: "copilot_action", action: { type: "clear_field", source: "auto_records", field: "serviceHistoryNotes", confidence: "high" } },
              { kind: "source_field", source: "auto_records", field: "serviceHistoryNotes", value: "x" },
            ],
          }),
        ],
        "tool_use",
      ),
      msg([text("Gatavs.")]),
    ]);
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(out.actions).toEqual([]);
    expect(out.fieldProposals).toEqual([]);
    expect(String(toolResults(s.calls, 1)[0]!.content)).toContain("Servisa vēsture");
  });

  it("listing_analysis un nezināmi lauki tiek noraidīti", async () => {
    const s = scripted([
      msg(
        [
          toolUse("propose_write", {
            writes: [
              { kind: "source_field", source: "listing_analysis", field: "comments", value: "x" },
              { kind: "source_field", source: "autodna", field: "nav_tada_lauka", value: "x" },
              { kind: "audit_field", field: "nav", value: "x" },
            ],
          }),
        ],
        "tool_use",
      ),
      msg([text("Gatavs.")]),
    ]);
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(out.fieldProposals).toEqual([]);
    expect(String(toolResults(s.calls, 1)[0]!.content).match(/noraidīts/g)).toHaveLength(3);
  });

  it("«palaid VIN SCAN»: tikai bezmaksas skenēšana ar pasūtījuma VIN", async () => {
    const d = deps();
    const s = scripted([msg([toolUse("run_vin_scan")], "tool_use"), msg([text("Palaists.")])]);
    await runCopilotSmartAgent(input({ message: "palaid VIN SCAN", deps: { ...d, createMessage: s.createMessage } }));
    expect(d.runVinScan).toHaveBeenCalledWith({ sessionId: "cs_test_1", vin: "WBA5R1C0XLFH42873", listingUrl: null });
  });

  it("VIN SCAN bez VIN - kļūda rīkam, nevis palaišana", async () => {
    const d = deps();
    const s = scripted([msg([toolUse("run_vin_scan")], "tool_use"), msg([text("Nav VIN.")])]);
    const base = input();
    await runCopilotSmartAgent({ ...base, auditInput: { ...base.auditInput, vin: null }, deps: { ...d, createMessage: s.createMessage } });
    expect(d.runVinScan).not.toHaveBeenCalled();
    expect(toolResults(s.calls, 1)[0]!.is_error).toBe(true);
  });

  it("«ielasi dīlera datus»: tikai pārparsēšana no jau apmaksāta RAW", async () => {
    const d = deps();
    const s = scripted([msg([toolUse("run_dealer_ingest")], "tool_use"), msg([text("Gatavs.")])]);
    await runCopilotSmartAgent(input({ message: "ielasi dīlera datus", deps: { ...d, createMessage: s.createMessage } }));
    expect(d.dealerReparse).toHaveBeenCalledWith("cs_test_1");
  });

  it("vairāki rīki vienā solī - visi rezultāti vienā lietotāja ziņā", async () => {
    const s = scripted([
      msg([toolUse("read_source", { key: "csdd" }), toolUse("list_missing_fields")], "tool_use"),
      msg([text("Gatavs.")]),
    ]);
    await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(toolResults(s.calls, 1)).toHaveLength(2);
  });

  it("nezināms rīks - is_error", async () => {
    const s = scripted([msg([toolUse("buy_autodna")], "tool_use"), msg([text("Gatavs.")])]);
    await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(toolResults(s.calls, 1)[0]!.is_error).toBe(true);
  });
});

describe("Copilot gudrais režīms - kļūmes un robežas", () => {
  it("pārslodze (529) - rezerves modelis claude-sonnet-5, atbildē to pasaka", async () => {
    const overloaded = Object.assign(new Error("overloaded_error"), { status: 529 });
    const s = scripted([overloaded, msg([text("Atbilde.")])]);
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(s.calls.map((c) => c.model)).toEqual(["claude-sonnet-5-5", COPILOT_SMART_FALLBACK_MODEL]);
    expect(out.usedFallback).toBe(true);
    expect(out.reply).toContain("Strādāja rezerves modelis (claude-sonnet-5)");
  });

  it("atteikums (refusal) - rezerves modelis, nevis klusi Haiku", async () => {
    const s = scripted([msg([], "refusal"), msg([text("Atbilde.")])]);
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    expect(s.calls[1]!.model).toBe(COPILOT_SMART_FALLBACK_MODEL);
    expect(s.calls.some((c) => /haiku/.test(c.model))).toBe(false);
    expect(out.modelUsed).toBe(COPILOT_SMART_FALLBACK_MODEL);
  });

  it("neatgūstama kļūda (400) - bez rezerves modeļa", async () => {
    const bad = Object.assign(new Error("invalid_request_error"), { status: 400 });
    const s = scripted([bad]);
    await expect(runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }))).rejects.toThrow();
    expect(s.calls).toHaveLength(1);
  });

  it(`ne vairāk kā ${COPILOT_SMART_MAX_STEPS} soļi vienai ziņai`, async () => {
    const createMessage = vi.fn(async () => msg([toolUse("list_missing_fields")], "tool_use"));
    const out = await runCopilotSmartAgent(input({ deps: deps({ createMessage }) }));
    expect(createMessage).toHaveBeenCalledTimes(COPILOT_SMART_MAX_STEPS);
    expect(out.reply).toContain("soļu limits");
  });

  it("bez operatora ziņas un pielikuma AI netiek saukts", async () => {
    const createMessage = vi.fn();
    await expect(runCopilotSmartAgent(input({ message: "  ", deps: deps({ createMessage }) }))).rejects.toThrow(
      "empty_message",
    );
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("thinking bloki tiek atdoti atpakaļ nemainīti", async () => {
    const thinking = { type: "thinking", thinking: "", signature: "sig123" } as unknown as Block;
    const s = scripted([msg([thinking, toolUse("list_missing_fields")], "tool_use"), msg([text("Gatavs.")])]);
    await runCopilotSmartAgent(input({ deps: deps({ createMessage: s.createMessage }) }));
    const assistant = s.calls[1]!.messages[1]!;
    expect(assistant.role).toBe("assistant");
    expect((assistant.content as Array<{ type: string; signature?: string }>)[0]).toMatchObject({
      type: "thinking",
      signature: "sig123",
    });
  });
});
