import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Nila nosacījums: Copilot NEKAD nestrādā automātiski. AI tiek saukts tikai tad, kad
 * operators Copilot logā nosūta ziņu (vai pielikumu). Bez tā - nav neviena AI izsaukuma.
 */
const runOrderCopilotAi = vi.fn();
const runCopilotSmartAgent = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-auth", () => ({ getAdminSession: vi.fn(async () => true) }));
vi.mock("@/lib/admin-ai", () => ({ getAnthropicApiKeyFromEnv: () => "test-key" }));
vi.mock("@/lib/admin-ai-demo-guard", () => ({ assertAiAllowedForSession: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/admin-copilot-ai", () => ({
  COPILOT_HISTORY_TURNS: 20,
  buildCopilotContextText: vi.fn(() => ""),
  runOrderCopilotAi: (...a: unknown[]) => runOrderCopilotAi(...a),
}));
vi.mock("@/lib/admin-copilot-agent", () => ({
  runCopilotSmartAgent: (...a: unknown[]) => runCopilotSmartAgent(...a),
}));
vi.mock("@/lib/admin-copilot-budget", () => ({
  readCopilotBudgetStatus: vi.fn(async () => null),
  addCopilotSpend: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-copilot-chat-store", () => ({
  appendCopilotChatMessages: vi.fn(async () => true),
  clearCopilotChat: vi.fn(async () => true),
  isCopilotChatStoreEnabled: () => false,
  readCopilotChat: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-costs-persist", () => ({ persistAiCostRecords: vi.fn() }));

import { GET, POST } from "@/app/api/admin/copilot/route";

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  runOrderCopilotAi.mockReset();
  runCopilotSmartAgent.mockReset();
});

describe("Copilot nekad nestrādā pats", () => {
  it("bez ziņas (arī gudrajā režīmā) AI netiek saukts", async () => {
    for (const mode of ["cheap", "smart"]) {
      const res = await post({ sessionId: "cs_test_1", message: "   ", mode, sourceBlocks: {} });
      expect(res.status).toBe(400);
    }
    expect(runOrderCopilotAi).not.toHaveBeenCalled();
    expect(runCopilotSmartAgent).not.toHaveBeenCalled();
  });

  it("sarunas ielāde (GET, lapas atvēršana) AI nesauc", async () => {
    const res = await GET(new Request("http://localhost/api/admin/copilot?sessionId=cs_test_1"));
    expect(res.status).toBe(200);
    expect(runOrderCopilotAi).not.toHaveBeenCalled();
    expect(runCopilotSmartAgent).not.toHaveBeenCalled();
  });

  it("ar operatora ziņu: noklusējums ir lētais režīms, gudrais tikai ar mode=smart", async () => {
    runOrderCopilotAi.mockResolvedValue({ reply: "Labi.", actions: [], clarificationNeeded: "" });
    runCopilotSmartAgent.mockResolvedValue({
      reply: "Labi.",
      actions: [],
      clarificationNeeded: "",
      fieldProposals: [],
      modelUsed: "claude-sonnet-5-5",
    });
    expect((await post({ sessionId: "cs_test_1", message: "kas trūkst?", sourceBlocks: {} })).status).toBe(200);
    expect(runOrderCopilotAi).toHaveBeenCalledTimes(1);
    expect(runCopilotSmartAgent).not.toHaveBeenCalled();
    expect((await post({ sessionId: "cs_test_1", message: "kas trūkst?", mode: "smart", sourceBlocks: {} })).status).toBe(200);
    expect(runCopilotSmartAgent).toHaveBeenCalledTimes(1);
  });
});
