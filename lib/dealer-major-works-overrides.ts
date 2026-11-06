/**
 * Pasūtījuma manuālie Lielie darbi labojumi.
 * Tukšs / nav lauka = paliek automātiskā klasifikācija. Manuālais uzvar.
 * Servisa vēstures rindas nemaina.
 */
import { majorAssemblyLabel, type DealerMajorAssemblyId, type DealerMajorWorkHit } from "@/lib/dealer-major-works";
import {
  isDealerMajorAssemblyId,
  type DealerMajorWorkOverride,
} from "@/lib/dealer-major-works-override-persist";

export type { DealerMajorWorkOverride, DealerMajorWorkOverrideAction } from "@/lib/dealer-major-works-override-persist";
export {
  dealerMajorWorkOverridesSnapshotField,
  isDealerMajorAssemblyId,
  parseDealerMajorWorkOverrides,
} from "@/lib/dealer-major-works-override-persist";

export function dealerMajorWorkHitKey(hit: Pick<DealerMajorWorkHit, "id" | "factId">): string {
  return `${hit.id}@${hit.factId}`;
}

export function nextCustomDealerMajorWorkOverrideKey(
  existing: readonly DealerMajorWorkOverride[],
): string {
  const keys = new Set(existing.map((o) => o.key));
  let n = 1;
  while (keys.has(`custom:${n}`)) n += 1;
  return `custom:${n}`;
}

function resolveOverrideHit(
  ov: DealerMajorWorkOverride,
  fallback: DealerMajorWorkHit | null,
): DealerMajorWorkHit {
  const assemblyId: DealerMajorAssemblyId =
    ov.assemblyId && isDealerMajorAssemblyId(ov.assemblyId)
      ? ov.assemblyId
      : fallback && isDealerMajorAssemblyId(fallback.id)
        ? fallback.id
        : "body_glass";
  const label = (ov.label ?? "").trim() || majorAssemblyLabel(assemblyId);
  return {
    id: assemblyId,
    label,
    factId: (ov.factId ?? "").trim() || fallback?.factId || ov.key,
    date: (ov.date ?? "").trim() || fallback?.date || "",
    km: (ov.km ?? "").trim() || fallback?.km || "",
  };
}

/**
 * Manuālie labojumi uzvar automātiku. Bez override paliek automātiskais trāpījums.
 * `hide` izņem rindu. `set` maina kategoriju / tekstu / datumu. Atslēgas dzēšana = atpakaļ uz automātisko.
 */
export function applyDealerMajorWorkOverrides(
  automatic: readonly DealerMajorWorkHit[],
  overrides: readonly DealerMajorWorkOverride[] | null | undefined,
): DealerMajorWorkHit[] {
  const byKey = new Map((overrides ?? []).map((o) => [o.key, o]));
  const used = new Set<string>();
  const out: DealerMajorWorkHit[] = [];

  for (const hit of automatic) {
    const key = dealerMajorWorkHitKey(hit);
    used.add(key);
    const ov = byKey.get(key);
    if (!ov) {
      out.push(hit);
      continue;
    }
    if (ov.action === "hide") continue;
    out.push(resolveOverrideHit(ov, hit));
  }

  for (const ov of overrides ?? []) {
    if (used.has(ov.key) || ov.action !== "set") continue;
    out.push(resolveOverrideHit(ov, null));
  }
  return out;
}

export function upsertDealerMajorWorkOverride(
  existing: readonly DealerMajorWorkOverride[],
  next: DealerMajorWorkOverride,
): DealerMajorWorkOverride[] {
  return [...existing.filter((o) => o.key !== next.key), next];
}

export function removeDealerMajorWorkOverride(
  existing: readonly DealerMajorWorkOverride[],
  key: string,
): DealerMajorWorkOverride[] {
  return existing.filter((o) => o.key !== key);
}

export type DealerMajorWorkEditorRow = {
  key: string;
  automatic: DealerMajorWorkHit | null;
  override: DealerMajorWorkOverride | null;
  effective: DealerMajorWorkHit | null;
  hidden: boolean;
  isCustom: boolean;
};

export function dealerMajorWorkEditorRows(
  automatic: readonly DealerMajorWorkHit[],
  overrides: readonly DealerMajorWorkOverride[],
): DealerMajorWorkEditorRow[] {
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  const used = new Set<string>();
  const rows: DealerMajorWorkEditorRow[] = [];

  for (const hit of automatic) {
    const key = dealerMajorWorkHitKey(hit);
    used.add(key);
    const override = byKey.get(key) ?? null;
    const applied = applyDealerMajorWorkOverrides([hit], override ? [override] : []);
    rows.push({
      key,
      automatic: hit,
      override,
      effective: applied[0] ?? null,
      hidden: override?.action === "hide",
      isCustom: false,
    });
  }

  for (const ov of overrides) {
    if (used.has(ov.key)) continue;
    const applied = applyDealerMajorWorkOverrides([], [ov]);
    rows.push({
      key: ov.key,
      automatic: null,
      override: ov,
      effective: applied[0] ?? null,
      hidden: ov.action === "hide",
      isCustom: true,
    });
  }
  return rows;
}
