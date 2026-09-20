import { describe, expect, it } from "vitest";
import {
  buildPdfFactCardHtml,
  collectRegistryFactCardRows,
  polishPdfFactCardRows,
} from "@/lib/pdf-fact-card";

describe("pdf-fact-card", () => {
  it("liek Dānijas faktus divās kv kolonnās, bez birkām un ar lielo burtu", () => {
    const rows = collectRegistryFactCardRows({
      ownersSummary: "Dānijas īpašnieku skaits: 2 (pēc reģistrācijas darbībām Dānijā, ne pēc OCTA).",
      statusRecords: [
        "Izmantošanas veids: privāta pasažieru pārvadāšana",
        "Degviela: dīzelis",
        "Jauda / piedziņa: 300 HK (221 kW) · pilnpiedziņa",
        "Euronorma: Euro VI",
        "DPF: ir",
        "Reģistrācijas statuss: noņemts no uzskaites (14.10.2024)",
        "Sekundārais statuss: noņemts no uzskaites (noņemta spēkā esoša reģistrācija)",
        "Pēdējā apskate: 16.10.2024, izturēta",
        "Pašreizējā OCTA: GF-FORSIKRING A/S (beigusies)",
      ].join("\n"),
      autoNotes: "Neizturētas apskates: 1.",
    });
    expect(rows).toEqual([
      { k: "Īpašnieku skaits Dānijā", v: "2" },
      { k: "Izmantošanas veids", v: "Privāti" },
      { k: "Degviela", v: "Dīzelis" },
      { k: "Jauda / piedziņa", v: "300 HK (221 kW) · Pilnpiedziņa" },
      { k: "Reģistrācijas statuss", v: "Noņemts no uzskaites (14.10.2024)" },
      { k: "Pēdējā apskate", v: "16.10.2024, Izturēta" },
      { k: "Pašreizējā OCTA", v: "GF-FORSIKRING A/S (Beigusies)" },
      { k: "Neizturētas apskates", v: "1" },
    ]);
    const html = buildPdfFactCardHtml(rows);
    expect(html).toContain("pdf-v1-kv-pair");
    expect(html).toContain("pdf-v1-kv");
    expect(html).toContain("Transportlīdzekļa informācija");
    expect(html).toContain("<td>Degviela</td><td>Dīzelis</td>");
    expect(html).not.toContain("Euronorma");
    expect(html).not.toContain("DPF");
    expect(html).not.toContain("Sekundārais");
    expect(html).not.toContain("pdf-report-comment-note");
  });

  it("nemaina jau tīru Dānijas skaita rindu", () => {
    expect(
      polishPdfFactCardRows([{ k: "Īpašnieku skaits Dānijā", v: "2" }]),
    ).toEqual([{ k: "Īpašnieku skaits Dānijā", v: "2" }]);
  });
});
