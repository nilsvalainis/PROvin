import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateExpertCommentQuality,
  type CommentQualityOptions,
} from "@/lib/gemini-eval/comment-quality";

type Fixture = {
  id: string;
  field: CommentQualityOptions["field"];
  expectPass: boolean;
  codes?: string[];
  text: string;
};

const fixturesPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden-comments.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as Fixture[];

describe("gemini-eval comment quality (golden fixtures)", () => {
  for (const fx of fixtures) {
    it(`${fx.id} (${fx.expectPass ? "pass" : "fail"})`, () => {
      const issues = evaluateExpertCommentQuality(fx.text, { field: fx.field });
      if (fx.expectPass) {
        expect(issues, JSON.stringify(issues)).toEqual([]);
      } else {
        expect(issues.length).toBeGreaterThan(0);
        if (fx.codes?.length) {
          for (const code of fx.codes) {
            expect(issues.some((i) => i.code === code)).toBe(true);
          }
        }
      }
    });
  }
});
