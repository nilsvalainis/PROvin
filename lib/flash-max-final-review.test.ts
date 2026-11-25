import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FLASH_MAX_FINAL_REVIEW_SYSTEM,
  FLASH_MAX_REVIEW_FIELD_MAX_CHARS,
  FLASH_MAX_REVIEW_MAX_FINDINGS,
  FLASH_MAX_REVIEW_MAX_TOKENS,
  applyFlashMaxReviewFinding,
  buildFlashMaxReviewUserPrompt,
  clipFlashMaxReviewFields,
  formatFlashMaxReviewNotice,
  parseFlashMaxReviewResponse,
  type FlashMaxReviewField,
} from "@/lib/flash-max-final-review";
import { postFlashMaxFinalReview } from "@/lib/flash-max-final-review-client";
import { runFlashMaxFinalReview } from "@/lib/flash-max-final-review-server";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

const fields: FlashMaxReviewField[] = [
  { id: "mileage", label: "Nobraukums", text: "Pēdējais nobraukums ir 182 000 km (2023). Atrites pazīmes nav konstatētas." },
  { id: "summary", label: "3. Kopsavilkums", text: "Auto nobraukums ir 128 000 km. Ieteicams pirkt pēc apskates." },
];

const json = (findings: unknown[]) => JSON.stringify({ findings });

describe("FLASH MAX noslēguma pārbaude - atbildes apstrāde", () => {
  it("derīgi ieteikumi paliek, nederīgie (nezināms lauks, fragments nav laukā, 'eksperts', bez izmaiņas) tiek izmesti", () => {
    const out = parseFlashMaxReviewResponse(
      json([
        {
          field: "summary",
          kind: "pretruna",
          reason: "Nobraukums pretrunā ar nobraukuma sadaļu \u2014 182 000 km.",
          find: "Auto nobraukums ir 128 000 km.",
          replace: "Auto pēdējais fiksētais nobraukums ir 182 000 km (2023).",
        },
        { field: "nav_tada", kind: "fakts", reason: "x", find: "", replace: "y" },
        { field: "summary", kind: "fakts", reason: "x", find: "Šāda teikuma nav.", replace: "y" },
        { field: "summary", kind: "valoda", reason: "Eksperts iesaka", find: "Ieteicams pirkt pēc apskates.", replace: "Ieteicams." },
        { field: "summary", kind: "valoda", reason: "x", find: "Ieteicams pirkt pēc apskates.", replace: "Ieteicams pirkt pēc apskates." },
        { field: "mileage", kind: "fakts", reason: "Bez fragmenta drīkst tikai trūkstošam riskam.", find: "", replace: "Teksts." },
      ]),
      fields,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ fieldId: "summary", kind: "pretruna", find: "Auto nobraukums ir 128 000 km." });
    expect(out[0]!.reason).not.toMatch(/[\u2014\u2013]/);
  });

  it("trūkstošs risks bez fragmenta tiek pievienots lauka beigās; nezināms veids kļūst par 'nepamatots'", () => {
    const out = parseFlashMaxReviewResponse(
      "```json\n" +
        json([
          { field: "summary", kind: "risks", reason: "Fakti rāda nobraukuma brīdinājumu.", find: "", replace: "CarVertical fiksē nobraukuma brīdinājumu." },
          { field: "mileage", kind: "cits", reason: "Nav pamata datos.", find: "Atrites pazīmes nav konstatētas.", replace: "Atrites dati avotos nav pieejami." },
        ]) +
        "\n```",
      fields,
    );
    expect(out.map((f) => f.kind)).toEqual(["risks", "nepamatots"]);
    expect(applyFlashMaxReviewFinding(fields[1]!.text, out[0]!)).toBe(
      `${fields[1]!.text}\n\nCarVertical fiksē nobraukuma brīdinājumu.`,
    );
  });

  it("ne vairāk par griestiem; nederīgs JSON ir kļūda", () => {
    const many = Array.from({ length: 30 }, () => ({
      field: "summary",
      kind: "valoda",
      reason: "r",
      find: "Ieteicams pirkt pēc apskates.",
      replace: "Ieteicams pārbaudīt pēc apskates.",
    }));
    expect(parseFlashMaxReviewResponse(json(many), fields)).toHaveLength(FLASH_MAX_REVIEW_MAX_FINDINGS);
    expect(() => parseFlashMaxReviewResponse("Viss kārtībā.", fields)).toThrow(/invalid_json/);
    expect(() => parseFlashMaxReviewResponse('{"findings": "nav"}', fields)).toThrow(/invalid_json/);
  });

  it("pieņemšana aizstāj tikai fragmentu; ja teksts mainīts, nekas netiek pārrakstīts", () => {
    const f = { find: "128 000 km", replace: "182 000 km" };
    expect(applyFlashMaxReviewFinding("Nobraukums 128 000 km.", f)).toBe("Nobraukums 182 000 km.");
    expect(applyFlashMaxReviewFinding("Operators jau pārrakstīja.", f)).toBeNull();
  });

  it("lauku apgriešana: tukšie un dublikāti izmesti, garums ierobežots", () => {
    const out = clipFlashMaxReviewFields([
      { id: "a", label: "A", text: "x".repeat(FLASH_MAX_REVIEW_FIELD_MAX_CHARS + 500) },
      { id: "a", label: "A2", text: "y" },
      { id: "b", label: "B", text: "   " },
      "nederīgs",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toHaveLength(FLASH_MAX_REVIEW_FIELD_MAX_CHARS);
  });

  it("uzvedne satur faktus un visus laukus; sistēmas uzdevums aizliedz jaunus faktus un 'eksperts'", () => {
    const prompt = buildFlashMaxReviewUserPrompt(fields, "KANONISKIE FAKTI\n- Nobraukums: 182 000 km");
    expect(prompt).toContain("182 000 km");
    expect(prompt).toContain('<field id="mileage"');
    expect(prompt).toContain('<field id="summary"');
    expect(FLASH_MAX_FINAL_REVIEW_SYSTEM).toMatch(/NEVER introduce facts/);
    expect(FLASH_MAX_FINAL_REVIEW_SYSTEM).toContain("eksperts");
  });

  it("paziņojums operatoram", () => {
    expect(formatFlashMaxReviewNotice({ status: "done", findings: [], fieldLabels: {} })).toBe("Pārbaudīts, iebildumu nav.");
    expect(formatFlashMaxReviewNotice({ status: "error", error: "x" })).toMatch(/neizdevās - FLASH MAX teksti saglabāti/);
  });
});

describe("FLASH MAX noslēguma pārbaude - viens izsaukums (mock, bez īsta API)", () => {
  const facts = { sourceBlocks: createDefaultSourceBlocks() };

  it("viens Opus izsaukums ar ierobežotiem max_tokens, bez latviešu slīpēšanas", async () => {
    const generate = vi.fn(async () =>
      json([{ field: "summary", kind: "pretruna", reason: "Nesakrīt ar nobraukuma sadaļu.", find: "128 000 km", replace: "182 000 km" }]),
    );
    const res = await runFlashMaxFinalReview({ fields, facts }, generate);
    expect(generate).toHaveBeenCalledTimes(1);
    const call = (generate.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(call.model).toBe("claude-opus-5-5");
    expect(call.maxTokens).toBe(FLASH_MAX_REVIEW_MAX_TOKENS);
    expect(call.skipLatvianPolish).toBe(true);
    expect(res).toMatchObject({ ok: true, findings: [{ fieldId: "summary" }] });
  });

  it("kļūda vai nederīgs JSON: viens izsaukums, bez atkārtojuma, atgriež kļūdu", async () => {
    const failing = vi.fn(async () => {
      throw new Error("overloaded");
    });
    expect(await runFlashMaxFinalReview({ fields, facts }, failing)).toEqual({ ok: false, error: "final_review_failed" });
    expect(failing).toHaveBeenCalledTimes(1);
    const prose = vi.fn(async () => "Viss kārtībā.");
    expect(await runFlashMaxFinalReview({ fields, facts }, prose)).toEqual({ ok: false, error: "final_review_invalid_json" });
    expect(prose).toHaveBeenCalledTimes(1);
  });

  it("bez laukiem API netiek saukts", async () => {
    const generate = vi.fn(async () => "{}");
    expect(await runFlashMaxFinalReview({ fields: [], facts }, generate)).toEqual({ ok: true, findings: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it("klients: tieši viens pieprasījums, kļūda netiek izmesta", async () => {
    const fetchOk = vi.fn(async () => new Response(JSON.stringify({ findings: [] }), { status: 200 }));
    expect(await postFlashMaxFinalReview({ fields }, fetchOk as unknown as typeof fetch)).toEqual({ ok: true, findings: [] });
    expect(fetchOk).toHaveBeenCalledTimes(1);
    const fetchErr = vi.fn(async () => new Response(JSON.stringify({ error: "final_review_failed" }), { status: 502 }));
    expect(await postFlashMaxFinalReview({ fields }, fetchErr as unknown as typeof fetch)).toEqual({
      ok: false,
      error: "final_review_failed",
    });
    const fetchThrow = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await postFlashMaxFinalReview({ fields }, fetchThrow as unknown as typeof fetch)).toEqual({ ok: false, error: "network" });
    expect(fetchThrow).toHaveBeenCalledTimes(1);
  });
});
