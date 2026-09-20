import { describe, expect, it } from "vitest";
import { buildPdfFactCardHtml, collectRegistryFactCardRows } from "@/lib/pdf-fact-card";

describe("pdf-fact-card", () => {
  it("liek Dānijas faktus kv tabulā, ne komentāru kastē", () => {
    const rows = collectRegistryFactCardRows({
      ownersSummary: "Dānijas īpašnieku skaits: 2 (pēc reģistrācijas darbībām Dānijā, ne pēc OCTA).",
      statusRecords: [
        "Izmantošanas veids: privāta pasažieru pārvadāšana",
        "Degviela: dīzelis",
        "Jauda / piedziņa: 300 HK (221 kW) · pilnpiedziņa",
        "Pēdējā apskate: 16.10.2024, izturēta",
      ].join("\n"),
      autoNotes: "Neizturētas apskates: 1.",
    });
    expect(rows).toEqual([
      { k: "Dānijas īpašnieku skaits", v: "2 (pēc reģistrācijas darbībām Dānijā, ne pēc OCTA)" },
      { k: "Izmantošanas veids", v: "privāta pasažieru pārvadāšana" },
      { k: "Degviela", v: "dīzelis" },
      { k: "Jauda / piedziņa", v: "300 HK (221 kW) · pilnpiedziņa" },
      { k: "Pēdējā apskate", v: "16.10.2024, izturēta" },
      { k: "Neizturētas apskates", v: "1" },
    ]);
    const html = buildPdfFactCardHtml(rows);
    expect(html).toContain("pdf-v1-kv");
    expect(html).toContain("Transportlīdzekļa informācija");
    expect(html).toContain("<td>Degviela</td><td>dīzelis</td>");
    expect(html).not.toContain("pdf-report-comment-note");
  });
});
