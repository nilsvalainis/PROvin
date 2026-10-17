import { describe, expect, it } from "vitest";
import {
  buildTechRiskOperatorFlags,
  isPaidPartsPriceSource,
  isVerifiedKbCostBand,
  parseTechnicalRiskMap,
  parseTechnicalRiskMapFromAiText,
  stripTechnicalRiskEurSentences,
} from "@/lib/admin-ai-technical-risk-map-types";

describe("parseTechnicalRiskMap", () => {
  it("fills recalls with nav atrasts when missing", () => {
    const map = parseTechnicalRiskMap({
      identification: { engine: { value: "N47D20", confidence: "A", evidence: "dīleris" } },
      risks: [{ component: "ķēde", failure_mode: "izstiepšanās" }],
    });
    expect(map?.recalls).toEqual([
      { id_or_title: "nav atrasts", source: "meklēšana", status_known: false },
    ]);
    expect(map?.identification.engine.confidence).toBe("A");
  });

  it("parses fenced JSON from a model reply", () => {
    const map = parseTechnicalRiskMapFromAiText(`piezīme
\`\`\`json
{"identification":{"engine":{"value":"B47D20","confidence":"B","evidence":"gads","candidates":["B47D20"]}},"risks":[],"recalls":[{"id_or_title":"nav atrasts","source":"KBA"}]}
\`\`\``);
    expect(map?.identification.engine.value).toBe("B47D20");
    expect(map?.recalls[0]?.id_or_title).toBe("nav atrasts");
  });

  it("accepts only verified KB cost bands and drops paid catalogs", () => {
    expect(isVerifiedKbCostBand({ source: "KB:N47D20", dated: "2026-09" })).toBe(true);
    expect(isVerifiedKbCostBand({ source: "KB:N47D20", dated: "" })).toBe(false);
    expect(isPaidPartsPriceSource("https://www.autodoc.de/n47")).toBe(true);
    expect(isVerifiedKbCostBand({ source: "https://www.autodoc.de", dated: "2026-09" })).toBe(false);
    const map = parseTechnicalRiskMap({
      identification: { engine: { value: "N47D20", confidence: "C", evidence: "" } },
      risks: [{ component: "ķēde", cost_band_eur: { min: 1, max: 2, source: "autodoc.de", dated: "2026-01" } }],
      unknowns: ["kārbas eļļa nav fiksēta"],
    });
    expect(map?.risks[0]?.cost_band_eur).toBeNull();
    expect(buildTechRiskOperatorFlags(map).some((f) => /C/.test(f))).toBe(true);
    expect(buildTechRiskOperatorFlags(map).some((f) => /kārbas eļļa/.test(f))).toBe(true);
  });

  it("strips EUR sentences without dropping the rest", () => {
    expect(
      stripTechnicalRiskEurSentences("Ķēde ir jāklausās. Orientējoši 400-800 EUR (PROVIN dati, 2026-09). Klātienē startu."),
    ).toBe("Ķēde ir jāklausās. Klātienē startu.");
  });

  it("keeps 2013. gadā together and drops Šāda summa after a EUR sentence", () => {
    expect(
      stripTechnicalRiskEurSentences(
        "Importēts 2013. gadā Vācijā. Orientējoši 800 EUR 2026. Šāda summa nav apstiprināta. Klātienē startu.",
      ),
    ).toBe("Importēts 2013. gadā Vācijā. Klātienē startu.");
  });
});
