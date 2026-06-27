import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type CompareMatrixRow = {
  label: string;
  mini: boolean;
  plus: boolean;
  premium: boolean;
};

export const TEST_PRICING_COMPARE_ROWS: CompareMatrixRow[] = [
  { label: "Sludinājuma analīze", mini: true, plus: true, premium: true },
  { label: "Tehnisko risku izvērtēšana", mini: true, plus: true, premium: true },
  { label: "Individuāla konsultācija", mini: true, plus: true, premium: true },
  { label: "Vietējo reģistru pārbaude", mini: false, plus: true, premium: true },
  { label: "Ziemeļvalstu reģistru pārbaude", mini: false, plus: true, premium: true },
  { label: "Tehnisko apskašu vēsture", mini: false, plus: true, premium: true },
  { label: "carVertical pilnā atskaite", mini: false, plus: false, premium: true },
  { label: "autoDNA vēstures atskaite", mini: false, plus: false, premium: true },
  { label: "Oficiālo dīleru un izsoļu portālu arhīvs*", mini: false, plus: false, premium: true },
  { label: "Eksperta pirkuma rekomendācija", mini: false, plus: false, premium: true },
];

export const TEST_PRICING_COMPARE_PRICES: Record<TestPricingPlanId, string> = {
  mini: "19,99 €",
  plus: "39,99 €",
  premium: "99,99 €",
};

export const TEST_PRICING_COMPARE_LABELS: Record<TestPricingPlanId, string> = {
  mini: "MINI",
  plus: "PLUS",
  premium: "PREMIUM",
};
