import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type StackFeatureBlockId = "mini" | "plus" | "premium";

export type StackFeatureBlock = {
  id: StackFeatureBlockId;
  title: string;
  items: string[];
};

export const TEST_PRICING_STACK_BLOCKS: StackFeatureBlock[] = [
  {
    id: "mini",
    title: "MINI",
    items: [
      "Sludinājuma analīze",
      "Tehnisko risku izvērtēšana",
      "Individuāla konsultācija",
    ],
  },
  {
    id: "plus",
    title: "PLUS",
    items: [
      "Vietējo reģistru pārbaude",
      "Ziemeļvalstu reģistru pārbaude",
      "Tehnisko apskašu vēsture",
    ],
  },
  {
    id: "premium",
    title: "PREMIUM",
    items: [
      "carVertical pilnā atskaite",
      "autoDNA vēstures atskaite",
      "Oficiālo dīleru sistēmu dati",
      "Eksperta pirkuma rekomendācija",
    ],
  },
];

export type StackBlockVisualState = "active" | "faded";

export type StackBlocksViewState = {
  mini: StackBlockVisualState;
  plus: StackBlockVisualState;
  premium: StackBlockVisualState;
  warningAfterBlock?: StackFeatureBlockId;
  warningText?: string;
};

export function getStackBlocksViewState(tier: TestPricingPlanId): StackBlocksViewState {
  if (tier === "premium") {
    return { mini: "active", plus: "active", premium: "active" };
  }
  if (tier === "plus") {
    return {
      mini: "active",
      plus: "active",
      premium: "faded",
      warningAfterBlock: "premium",
      warningText: "CarVertical, autoDNA & Dīleru dati NAV iekļauti",
    };
  }
  return {
    mini: "active",
    plus: "faded",
    premium: "faded",
    warningAfterBlock: "premium",
    warningText: "Vēstures atskaites un papildus reģistri NAV iekļauti",
  };
}
