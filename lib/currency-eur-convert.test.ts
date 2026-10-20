import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeCcVinBlock } from "@/lib/cc-vin-report";
import {
  convertAmountTextToEur,
  describeEurConversion,
  displayUsdAsEur,
  ECB_RATE_MISSING_MARKER,
  loadEcbDailyRates,
  parseEcbEurofxXml,
  setEcbDailyRatesForTests,
  USD_TO_EUR_RATE,
} from "@/lib/currency-eur-convert";

const SAMPLE_XML = `<?xml version="1.0"?>
<gesmes:Envelope>
  <Cube>
    <Cube time="2026-10-15">
      <Cube currency="USD" rate="1.09"/>
      <Cube currency="GBP" rate="0.85"/>
      <Cube currency="PLN" rate="4.3"/>
      <Cube currency="SEK" rate="11.3"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

beforeEach(() => {
  setEcbDailyRatesForTests(null);
});
afterEach(() => {
  setEcbDailyRatesForTests(null);
});

describe("parseEcbEurofxXml", () => {
  it("reads the ECB date and per-euro rates", () => {
    const table = parseEcbEurofxXml(SAMPLE_XML);
    expect(table?.date).toBe("2026-10-15");
    expect(table?.rates.USD).toBe(1.09);
    expect(table?.rates.EUR).toBe(1);
  });

  it("rejects XML without a Cube date", () => {
    expect(parseEcbEurofxXml("<Cube currency=\"USD\" rate=\"1.1\"/>")).toBeNull();
  });
});

describe("loadEcbDailyRates", () => {
  it("caches the parsed table for the day", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(SAMPLE_XML, { status: 200 });
    }) as unknown as typeof fetch;
    const first = await loadEcbDailyRates(fetcher);
    const second = await loadEcbDailyRates(fetcher);
    expect(first?.rates.USD).toBe(1.09);
    expect(second?.date).toBe("2026-10-15");
    expect(calls).toBe(1);
  });

  it("keeps a previous table when the request fails", async () => {
    setEcbDailyRatesForTests({ date: "2026-10-14", rates: { USD: 1.08 }, fetchedOn: "1970-01-01" });
    const fetcher = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const table = await loadEcbDailyRates(fetcher);
    expect(table?.rates.USD).toBe(1.08);
  });
});

describe("convertAmountTextToEur", () => {
  it("converts USD with the fixed 0.92 rate even without ECB", () => {
    expect(USD_TO_EUR_RATE).toBe(0.92);
    const conv = convertAmountTextToEur("38 745 USD");
    expect(conv?.converted).toBe(true);
    expect(conv?.display).toBe("35 650 €");
    expect(conv?.display).not.toMatch(/USD|ECB/);
    expect(describeEurConversion("38 745 USD", conv!)).toBe("38 745 USD → 35 650 €");
    expect(displayUsdAsEur("280 USD")).toBe("258 €");
    expect(displayUsdAsEur("1 360 USD")).toBe("1 250 €");
    expect(displayUsdAsEur("12 400 €")).toBe("12 400 €");
  });

  it("normalizes stored Checkcar.vin USD amount and sale price to EUR", () => {
    const b = normalizeCcVinBlock({
      damages: [{ date: "01.06.2016", region: "ASV", amount: "280 USD", description: "Front" }],
      sales: [{ date: "01.06.2016", venue: "Copart", odometer: "", price: "1 000 USD", status: "Pārdots" }],
    });
    expect(b.damages[0]?.amount).toBe("258 €");
    expect(b.sales[0]?.price).toBe("920 €");
  });

  it("converts PLN, SEK and GBP when those ECB rows exist", () => {
    setEcbDailyRatesForTests({ date: "2026-10-15", rates: { PLN: 4.3, SEK: 11.3, GBP: 0.85 } });
    expect(convertAmountTextToEur("4300 PLN")?.display).toBe("1 000 €");
    expect(convertAmountTextToEur("11 300 SEK")?.display).toBe("1 000 €");
    expect(convertAmountTextToEur("850 GBP")?.display).toBe("1 000 €");
    expect(describeEurConversion("850 GBP", convertAmountTextToEur("850 GBP")!)).toContain("ECB 15.10.2026");
  });

  it("still converts USD when no ECB table is loaded", () => {
    const conv = convertAmountTextToEur("4 200 USD");
    expect(conv?.converted).toBe(true);
    expect(conv?.rateMissing).toBeFalsy();
    expect(conv?.display).toBe("3 860 €");
    expect(conv?.display).not.toMatch(/USD|ECB/);
    expect(describeEurConversion("4 200 USD", conv!)).toBe("4 200 USD → 3 860 €");
  });

  it("does not invent a rate for a currency missing from the ECB table", () => {
    setEcbDailyRatesForTests({ date: "2026-10-15", rates: { USD: 1.09 } });
    const conv = convertAmountTextToEur("12 000 UAH");
    expect(conv?.rateMissing).toBe(true);
    expect(conv?.display).toMatch(/UAH/);
    expect(conv?.display).not.toMatch(/€/);
  });

  it("leaves EUR amounts as euro without claiming a conversion", () => {
    const conv = convertAmountTextToEur("8501 € - 9000 €");
    expect(conv?.converted).toBe(false);
    expect(conv?.fromCurrency).toBe("EUR");
    expect(conv?.display).toBe("8 501 - 9 000 €");
    expect(describeEurConversion("8501 € - 9000 €", conv!)).toBe("");
  });
});
