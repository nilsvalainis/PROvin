import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROVIN_ALERT_CARD_DEFAULTS } from "@/lib/provin-alert-banners";

/**
 * Nila likums: lietotājam redzamā tekstā tikai «-», nekad garā (—) vai vidējā (–) domuzīme.
 * Pārbauda virkņu literāļus un JSX tekstu komponentos, lapās un tulkojumos (ne komentārus, ne salīdzinājumus).
 */
const FILES = [
  ...globSync("components/**/*.tsx"),
  ...globSync("app/**/*.tsx").filter((f) => !f.startsWith("app/dev/")),
  ...globSync("messages/**/*.json"),
  "lib/admin-rich-comment-fonts.ts",
  "lib/autodna-api.ts",
  "lib/outvin-history-probe.ts",
  "lib/history-reports-compare.ts",
].filter((f) => !/\.test\.|fixture/.test(f));

const SPACED_LONG_DASH = / [–—] /;

describe("UI teksti bez garās domuzīmes", () => {
  it("nav « — » / « – » lietotājam redzamās virknēs", () => {
    const hits: string[] = [];
    for (const f of FILES) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.replace(/\s\/\/.*$/, "");
          const t = code.trim();
          if (!SPACED_LONG_DASH.test(code) || /^(\/\/|\*|\/\*|\{\/\*)/.test(t)) return;
          const inString = /["'`][^"'`]*[–—][^"'`]*["'`]/.test(code) || />[^<{]*[–—][^<]*</.test(code);
          if (inString || f.endsWith(".json")) hits.push(`${f}:${i + 1}: ${t.slice(0, 100)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("PDF brīdinājumu kartīšu noklusējuma piezīmēs nav garās domuzīmes", () => {
    for (const card of Object.values(PROVIN_ALERT_CARD_DEFAULTS)) {
      if (!card) continue;
      for (const part of [card.label, card.value, card.note]) {
        expect(part).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});
