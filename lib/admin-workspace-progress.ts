import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";

function levelScore(l: TrafficFillLevel): number {
  if (l === "complete") return 1;
  if (l === "partial") return 0.5;
  return 0;
}

/** 0–100% pēc wizard soļu luksoforu līmeņiem (tukšs / procesā / gatavs). */
export function workspaceWizardProgressPct(levels: TrafficFillLevel[]): number {
  if (levels.length === 0) return 0;
  const sum = levels.reduce((acc, l) => acc + levelScore(l), 0);
  return Math.min(100, Math.round((sum / levels.length) * 100));
}
