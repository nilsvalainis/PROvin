import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5BlockId = "mini" | "plus" | "premium";

export type Tp5DisplayRow =
  | { kind: "bullet"; label: string; id: string }
  | { kind: "inherit"; tierName: "MINI" | "PLUS"; id: string };

export type Tp5FeatureBlock = {
  id: Tp5BlockId;
  title: string;
  unlockTier: TestPricingPlanId;
};

export const TP5_FEATURE_BLOCKS: Tp5FeatureBlock[] = [
  { id: "mini", title: "MINI", unlockTier: "mini" },
  { id: "plus", title: "PLUS", unlockTier: "plus" },
  { id: "premium", title: "PREMIUM", unlockTier: "premium" },
];

const MINI_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "mini-1", label: "Sludinājuma analīze" },
  { kind: "bullet", id: "mini-2", label: "Tehnisko risku izvērtēšana" },
  { kind: "bullet", id: "mini-3", label: "Individuāla konsultācija" },
];

const PLUS_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "plus-1", label: "Vietējo reģistru pārbaude" },
  { kind: "bullet", id: "plus-2", label: "Ziemeļvalstu reģistru pārbaude" },
  { kind: "bullet", id: "plus-3", label: "Tehnisko apskašu vēsture" },
];

const PREMIUM_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "prem-1", label: "carVertical & autoDNA pilnās atskaites" },
  { kind: "bullet", id: "prem-2", label: "Oficiālo dīleru sistēmu dati" },
  { kind: "bullet", id: "prem-3", label: "Eksperta pirkuma rekomendācija" },
];

const TIER_RANK: Record<TestPricingPlanId, number> = {
  mini: 0,
  plus: 1,
  premium: 2,
};

export function isTp5BlockLocked(blockId: Tp5BlockId, activeTier: TestPricingPlanId): boolean {
  return TIER_RANK[blockId] > TIER_RANK[activeTier];
}

export function getTp5BlockRows(
  blockId: Tp5BlockId,
  activeTier: TestPricingPlanId,
): Tp5DisplayRow[] {
  if (blockId === "mini") return MINI_ROWS;

  if (blockId === "plus") {
    if (activeTier === "plus") {
      return [{ kind: "inherit", tierName: "MINI", id: "plus-inherit-mini" }, ...PLUS_ROWS];
    }
    return PLUS_ROWS;
  }

  if (activeTier === "premium") {
    return PREMIUM_ROWS;
  }
  if (activeTier === "plus") {
    return PREMIUM_ROWS;
  }
  return PREMIUM_ROWS;
}

export function getTp5VisibleRowIds(activeTier: TestPricingPlanId): string[] {
  const ids: string[] = [];
  for (const block of TP5_FEATURE_BLOCKS) {
    if (!isTp5BlockLocked(block.id, activeTier)) {
      ids.push(...getTp5BlockRows(block.id, activeTier).map((r) => r.id));
    } else {
      ids.push(...getTp5BlockRows(block.id, activeTier).map((r) => r.id));
    }
  }
  return ids;
}
