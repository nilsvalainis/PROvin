import type { TestPricingPlanId } from "@/lib/test-pricing-plans";
import type { Tp5DisplayRow } from "@/lib/test-pricing-5-display";

/** Mobile `/test-pricing-5` — two-tier product model (maps to plus / premium checkout). */
export type Tp5MobileTierId = Extract<TestPricingPlanId, "plus" | "premium">;

export const TP5_MOBILE_TIER_ORDER: Tp5MobileTierId[] = ["plus", "premium"];

export const TP5_MOBILE_TAB_LABEL: Record<Tp5MobileTierId, string> = {
  plus: "PROVIN MINI",
  premium: "PROVIN AUDITS",
};

export const TP5_MOBILE_TIER_META: Record<
  Tp5MobileTierId,
  { title: string; description: string }
> = {
  plus: {
    title: "PROVIN MINI",
    description:
      "Padziļināta tehnisko datu analīze un konsultācija. Rekomendējam veikt Latvijā reģistrētiem auto.",
  },
  premium: {
    title: "PROVIN AUDITS",
    description:
      "Maksimālā pieejamā datu aizsardzība un reāls ekspertu atbalsts dārga auto iegādei.",
  },
};

export const TP5_MOBILE_CTA_LABEL: Record<Tp5MobileTierId, string> = {
  plus: "PASŪTĪT MINI AUDITU — 39,99 €",
  premium: "PASŪTĪT PROVIN AUDITU — 89,99 €",
};

export const TP5_MOBILE_TURNAROUND = "⏱️ Izpilde: līdz 48h";

const MOBILE_FEATURE_ROWS: Tp5DisplayRow[] = [
  { kind: "bullet", id: "mob-1", label: "Sludinājuma un tehnisko risku analīze" },
  { kind: "bullet", id: "mob-2", label: "TA vēsture un publisko reģistru pārbaude" },
  { kind: "bullet", id: "mob-3", label: "Ieteikumi klātienes apskatei" },
  { kind: "bullet", id: "mob-4", label: "carVertical un autoDNA integrācija" },
  {
    kind: "bullet",
    id: "mob-5",
    label: "Oficiālo dīleru sistēmu dati",
    footnoteMark: true,
  },
  { kind: "bullet", id: "mob-6", label: "Individuāla konsultācija" },
  {
    kind: "bullet",
    id: "mob-7",
    label: "📞 Konsultācija un atbalsts — tieša saziņa pirms darījuma.",
  },
];

const MINI_ACTIVE_COUNT = 3;

export function getTp5MobileFeatureLayout(tierId: Tp5MobileTierId): {
  activeRows: Tp5DisplayRow[];
  inactiveRows: Tp5DisplayRow[];
} {
  if (tierId === "premium") {
    return { activeRows: MOBILE_FEATURE_ROWS, inactiveRows: [] };
  }
  return {
    activeRows: MOBILE_FEATURE_ROWS.slice(0, MINI_ACTIVE_COUNT),
    inactiveRows: MOBILE_FEATURE_ROWS.slice(MINI_ACTIVE_COUNT),
  };
}
