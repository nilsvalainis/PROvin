import { beforeEach, describe, expect, it, vi } from "vitest";

const generateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: vi.fn(async () => true) }));
vi.mock("@/lib/admin-ai-demo-guard", () => ({ assertAiAllowedForSession: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/admin-ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin-ai")>()),
  getAnthropicApiKeyFromEnv: () => "test-key",
  aiGenerateText: generateMock,
}));

import { POST } from "@/app/api/admin/ai/fact-check-fix/route";
import { factCheckFlagsResolvedByText } from "@/components/admin/AdminFactCheckPanel";
import {
  FACT_CHECK_AI_FIX_MAX_FLAGS,
  buildFactCheckAiFixUserPrompt,
  clipFactCheckAiFixFlags,
  factCheckAiFixField,
  parseFactCheckAiFixResponse,
} from "@/lib/fact-check-ai-fix";
import { runFactCheckAiFix } from "@/lib/fact-check-ai-fix-server";
import { applyFlashMaxReviewFinding } from "@/lib/flash-max-final-review";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

const TEXT = "Dzinējs DW12RU ar FAP filtru. Eļļa mainīta 4 reizes.";
const FLAG: FactCheckFlag = {
  id: "powertrain_engine",
  level: "E",
  kind: "powertrain_engine",
  message: "Ielādētais dzinēja kods ir DW10FE, teksts nosauc DW12RU.",
  sentence: "Dzinējs DW12RU ar FAP filtru.",
};
const MODEL_JSON = JSON.stringify({
  findings: [
    { field: "field", kind: "fakts", reason: "Dzinēja kods pēc lapas ir DW10FE.", find: "DW12RU", replace: "DW10FE" },
    { field: "field", kind: "fakts", reason: "Nav tekstā.", find: "neeksistē", replace: "x" },
    { field: "citi", kind: "fakts", reason: "Cits lauks.", find: "Eļļa", replace: "Eļļa" },
  ],
});

describe("faktu pārbaudes «Labot» ar AI", () => {
  beforeEach(() => generateMock.mockReset());

  it("prompts satur lauka tekstu, pretrunu un faktu lapu", () => {
    const field = factCheckAiFixField("Eļļas maiņas intervāli", TEXT);
    const prompt = buildFactCheckAiFixUserPrompt(field, [FLAG], "Dzinēja kods: DW10FE");
    expect(prompt).toContain(TEXT);
    expect(prompt).toContain("teksts nosauc DW12RU");
    expect(prompt).toContain("Dzinēja kods: DW10FE");
  });

  it("parsē tikai derīgus labojumus šim laukam", () => {
    const field = factCheckAiFixField("Lauks", TEXT);
    const out = parseFactCheckAiFixResponse(MODEL_JSON, field);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ find: "DW12RU", replace: "DW10FE", kind: "fakts" });
  });

  it("apgriež karodziņus līdz griestiem un izmet tukšos", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...FLAG, id: `f${i}` }));
    expect(clipFactCheckAiFixFlags([...many, { message: "" }, null])).toHaveLength(FACT_CHECK_AI_FIX_MAX_FLAGS);
  });

  it("servera funkcija ar mock AI atgriež labojumus, kļūdu -> ok:false", async () => {
    const field = factCheckAiFixField("Lauks", TEXT);
    const facts = { sessionId: "s", vin: "", listingUrl: "", sourceBlocks: undefined } as never;
    const ok = await runFactCheckAiFix({ field, flags: [FLAG], facts }, async () => MODEL_JSON);
    expect(ok).toMatchObject({ ok: true, findings: [{ replace: "DW10FE" }] });
    const bad = await runFactCheckAiFix({ field, flags: [FLAG], facts }, async () => "nav json");
    expect(bad).toEqual({ ok: false, error: "fact_fix_invalid_json" });
  });

  it("API: pieprasījums ar mock AI atgriež diff labojumus, teksts serverī netiek mainīts", async () => {
    generateMock.mockResolvedValue(MODEL_JSON);
    const res = await POST(
      new Request("http://x/api/admin/ai/fact-check-fix", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess_1", vin: "VF1", text: `<p>${TEXT}</p>`, fieldLabel: "Lauks", flags: [FLAG] }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { findings: Array<{ find: string; replace: string }> };
    expect(data.findings).toEqual([expect.objectContaining({ find: "DW12RU", replace: "DW10FE" })]);
    expect(generateMock).toHaveBeenCalledTimes(1);
    const call = generateMock.mock.calls[0]![0] as { userPrompt: string };
    expect(call.userPrompt).toContain("teksts nosauc DW12RU");
  });

  it("API: bez karodziņiem AI netiek saukts", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ sessionId: "s", text: TEXT, flags: [] }) }),
    );
    expect(await res.json()).toEqual({ findings: [] });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("diff piemērošana: pieņemtais labojums aizstāj tikai fragmentu; karodziņš atrisināts", () => {
    const next = applyFlashMaxReviewFinding(TEXT, { find: "DW12RU", replace: "DW10FE" });
    expect(next).toBe("Dzinējs DW10FE ar FAP filtru. Eļļa mainīta 4 reizes.");
    expect(applyFlashMaxReviewFinding(TEXT, { find: "nav tekstā", replace: "x" })).toBeNull();
    expect(factCheckFlagsResolvedByText([FLAG], next!)).toEqual([FLAG]);
    expect(factCheckFlagsResolvedByText([FLAG], TEXT)).toEqual([]);
  });
});
