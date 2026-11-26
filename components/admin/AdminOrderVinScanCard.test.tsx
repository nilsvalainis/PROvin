import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AdminOrderVinScanCard } from "@/components/admin/AdminOrderVinScanCard";
import { sameOrderVinScanRecord, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { renderHtml, renderText } from "@/lib/test-render";
import { browserFetchLane } from "@/lib/vin-scan/browser-fetch";
import { vinScanCatalogItem } from "@/lib/vin-scan/catalog";
import { FakeElement, runUserscriptAt } from "@/lib/vin-scan/test-helpers/userscript-vm";

const VIN = "WBA5R1C0XLFH42873";

function row(id: string, status: string, summary: string) {
  return { id, label: id, country: "US", status, summary, detail: "", openUrl: `https://example.test/${id}` };
}

const record = {
  at: "2026-11-17T10:00:00.000Z",
  vin: VIN,
  status: "done",
  indicators: [
    { ...row("carfax_eu", "", ""), ...browserFetchLane("carfax_eu") },
    { ...row("nicb", "", ""), ...browserFetchLane("nicb") },
    row("csdd", "found", "Ir dati"),
    row("bid_cars", "none", "Nav izsoles arhīvā"),
  ],
} as unknown as OrderVinScanRecord;

function card(initial: OrderVinScanRecord | null) {
  return (
    <AdminOrderVinScanCard
      sessionId="cs_test_card"
      vin={VIN}
      listingUrl=""
      initial={initial}
      onImportAuction={() => undefined}
      onImportCsdd={() => undefined}
      onImportListing={() => undefined}
    />
  );
}

describe("pasūtījuma VIN SCAN kartīte", () => {
  it("rāda virsrakstu un kopsavilkumu, bez parauga tekstiem", () => {
    const text = renderText(card(record));
    expect(text).toContain("VIN SCAN avoti");
    expect(text).toContain("Skenēt vēlreiz");
    expect(text).not.toMatch(/paraugs/i);
    expect(text).not.toMatch(/carvertical|pirkt/i);
  });

  it("ieliek marķieri, pēc kura PROVIN skripts ielādē from-browser avotus no operatora pārlūka", () => {
    const html = renderHtml(card(record));
    const span = /<span hidden=""([^>]*data-provin-order-vin[^>]*)>/.exec(html);
    expect(span).not.toBeNull();
    const attrs = Object.fromEntries([...span![1]!.matchAll(/\s([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
    expect(attrs["data-provin-order-vin"]).toBe(VIN);
    expect(attrs["data-provin-order-session"]).toBe("cs_test_card");

    const run = runUserscriptAt("https://www.provin.lv/admin/orders/cs_test_card", {
      elements: [new FakeElement("span", { attrs })],
    });
    expect(run.gm.xhr.map((req) => req.url).sort()).toEqual(
      [vinScanCatalogItem("carfax_eu").openUrl(VIN), vinScanCatalogItem("nicb").openUrl(VIN)].sort(),
    );
  });

  it("bez gaidošiem from-browser avotiem skripts neko neielādē", () => {
    const done = { ...record, indicators: [row("csdd", "found", "Ir dati")] } as unknown as OrderVinScanRecord;
    const html = renderHtml(card(done));
    const span = /<span hidden=""([^>]*data-provin-order-vin[^>]*)>/.exec(html);
    const attrs = Object.fromEntries([...span![1]!.matchAll(/\s([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
    expect(attrs["data-provin-browser-fetch"]).toBeUndefined();
    const run = runUserscriptAt("https://www.provin.lv/admin/orders/cs_test_card", {
      elements: [new FakeElement("span", { attrs })],
    });
    expect(run.gm.xhr).toHaveLength(0);
  });

  it("25.11: tāds pats saturs jaunā objektā nav «izmaiņa» (aptauja / props neatiestata kartīti)", () => {
    const clone = JSON.parse(JSON.stringify(record)) as OrderVinScanRecord;
    expect(clone).not.toBe(record);
    expect(sameOrderVinScanRecord(record, clone)).toBe(true);
    expect(renderHtml(card(clone))).toBe(renderHtml(card(record)));
    expect(sameOrderVinScanRecord(record, { ...clone, status: "running" })).toBe(false);
    const changed = JSON.parse(JSON.stringify(record)) as OrderVinScanRecord;
    changed.indicators[0]!.status = "found";
    expect(sameOrderVinScanRecord(record, changed)).toBe(false);
    expect(sameOrderVinScanRecord(null, null)).toBe(true);
    expect(sameOrderVinScanRecord(record, null)).toBe(false);
  });

  it("25.11: skenēšanu sāk tikai lietotāja darbība (poga, «Atkārtot», telefona doks) - nekad efekts", () => {
    const src = readFileSync(path.join(process.cwd(), "components/admin/AdminOrderVinScanCard.tsx"), "utf8");
    const calls = [...src.matchAll(/startScan\(/g)].map((m) => src.slice(Math.max(0, m.index! - 700), m.index!));
    expect(calls).toHaveLength(4);
    for (const before of calls) {
      const tail = before.slice(-160);
      expect(/onClick=\{\(\) => void $/.test(tail) || /row\.action === "retry"/.test(tail) || /const onMobileScan = \(\) => \{/.test(before)).toBe(true);
    }
    // Vienīgā POST ar `force: true` ir startScan iekšā.
    expect(src.match(/force: true/g)).toHaveLength(1);
  });
});
