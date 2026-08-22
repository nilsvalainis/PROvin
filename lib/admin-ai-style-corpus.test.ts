import { describe, expect, it } from "vitest";
import {
  AI_STYLE_CORPUS_RULES,
  buildStyleCorpusAiContext,
  styleCorpusHasFactLeak,
} from "@/lib/admin-ai-style-corpus";
import { PROVIN_STYLE_CORPUS_SAMPLES } from "@/lib/admin-ai-style-corpus-data";

describe("style corpus", () => {
  it("teaches adapt / supplement / connect and forbids copy-paste", () => {
    expect(AI_STYLE_CORPUS_RULES).toMatch(/ADAPT/);
    expect(AI_STYLE_CORPUS_RULES).toMatch(/SUPPLEMENT/);
    expect(AI_STYLE_CORPUS_RULES).toMatch(/CONNECT/);
    expect(AI_STYLE_CORPUS_RULES).toMatch(/Never paste|nekopē|Never copy/i);
    expect(AI_STYLE_CORPUS_RULES).toMatch(/OPERATOR/);
  });

  it("injects compact samples without VIN / km / EUR / dates", () => {
    expect(styleCorpusHasFactLeak()).toBe(false);
    const ctx = buildStyleCorpusAiContext("technical_risks");
    expect(ctx).toMatch(/stilistiskā atmiņa/);
    expect(ctx).toMatch(/divmasu spararats|ieplūdes kolektors|pneimatika/);
    expect(ctx.length).toBeLessThan(3_200);
    expect(ctx).not.toMatch(/[A-HJ-NPR-Z0-9]{17}/);
    expect(ctx).not.toMatch(/€/);
  });

  it("prefers the active field's samples first", () => {
    const ctx = buildStyleCorpusAiContext("inspection");
    const firstSample = ctx.indexOf("Paraugs — ");
    expect(firstSample).toBeGreaterThan(0);
    expect(ctx.slice(firstSample, firstSample + 40)).toMatch(/klātienes ieteikumu ritms/);
  });

  it("keeps at least one sample per core field", () => {
    const fields = new Set(PROVIN_STYLE_CORPUS_SAMPLES.map((s) => s.field));
    expect(fields.has("source")).toBe(true);
    expect(fields.has("technical_risks")).toBe(true);
    expect(fields.has("inspection")).toBe(true);
  });
});
