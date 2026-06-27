import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5BlockId = "mini" | "plus" | "premium";

export type Tp5DisplayRow = {
  kind: "bullet";
  label: string;
  id: string;
  /** Renders a trailing asterisk and enables the dealer-system footnote on premium tier. */
  footnoteMark?: boolean;
};

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
  { kind: "bullet", id: "mini-3", label: "Pirkuma rekomendācija" },
];

const PLUS_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "plus-1", label: "Eiropas publisko reģistru pārbaude" },
  { kind: "bullet", id: "plus-2", label: "Tehnisko apskašu vēsture" },
  { kind: "bullet", id: "plus-3", label: "Individuāla konsultācija un atbalsts pirms darījuma." },
];

const PREMIUM_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "prem-1", label: "carVertical vēstures atskaite" },
  { kind: "bullet", id: "prem-2", label: "autoDNA vēstures atskaite" },
  {
    kind: "bullet",
    id: "prem-3",
    label: "Oficiālo dīleru un izsoļu portālu arhīvs*",
    footnoteMark: true,
  },
];

const BLOCK_ROWS: Record<Tp5BlockId, Tp5DisplayRow[]> = {
  mini: MINI_ROWS,
  plus: PLUS_ROWS,
  premium: PREMIUM_ROWS,
};

const TIER_RANK: Record<TestPricingPlanId, number> = {
  mini: 0,
  plus: 1,
  premium: 2,
};

export function isTp5BlockActive(blockId: Tp5BlockId, activeTier: TestPricingPlanId): boolean {
  return TIER_RANK[blockId] <= TIER_RANK[activeTier];
}

/** @deprecated Use isTp5BlockActive — kept for tests migrating from lock model */
export function isTp5BlockLocked(blockId: Tp5BlockId, activeTier: TestPricingPlanId): boolean {
  return !isTp5BlockActive(blockId, activeTier);
}

export function getTp5ActiveBlockCount(activeTier: TestPricingPlanId): number {
  return TIER_RANK[activeTier] + 1;
}

export function getTp5BlockRows(blockId: Tp5BlockId): Tp5DisplayRow[] {
  return BLOCK_ROWS[blockId];
}
