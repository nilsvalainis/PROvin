/**
 * Lielie darbi override persistences lauks. Bez dealer-major-works importa,
 * lai admin-source-blocks hidratācija neieiet ciklā.
 */

type DealerMajorAssemblyId =
  | "engine"
  | "timing_chain"
  | "timing_belt"
  | "crankshaft_seal"
  | "gearbox"
  | "clutch"
  | "transfer_case"
  | "differential"
  | "propshaft"
  | "dual_mass_flywheel"
  | "turbo"
  | "body_glass";

export type DealerMajorWorkOverrideAction = "hide" | "set";

export type DealerMajorWorkOverride = {
  /** Automātiskā trāpījuma atslēga `assembly@factId` vai `custom:n`. */
  key: string;
  action: DealerMajorWorkOverrideAction;
  assemblyId?: DealerMajorAssemblyId;
  /** Tukšs = mezgla noklusējuma etiķete. */
  label?: string;
  factId?: string;
  date?: string;
  km?: string;
};

const ASSEMBLY_IDS = new Set<string>([
  "engine",
  "timing_chain",
  "timing_belt",
  "crankshaft_seal",
  "gearbox",
  "clutch",
  "transfer_case",
  "differential",
  "propshaft",
  "dual_mass_flywheel",
  "turbo",
  "body_glass",
]);

export function isDealerMajorAssemblyId(value: string): value is DealerMajorAssemblyId {
  return ASSEMBLY_IDS.has(value);
}

function trimStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Vecie pasūtījumi bez lauka paliek `undefined` - netiek pārrakstīti. */
export function parseDealerMajorWorkOverrides(raw: unknown): DealerMajorWorkOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: DealerMajorWorkOverride[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const key = trimStr(rec.key);
    const action = rec.action;
    if (!key || (action !== "hide" && action !== "set") || seen.has(key)) continue;
    seen.add(key);
    const parsed: DealerMajorWorkOverride = { key, action };
    const assemblyId = trimStr(rec.assemblyId);
    if (assemblyId && isDealerMajorAssemblyId(assemblyId)) parsed.assemblyId = assemblyId;
    const label = trimStr(rec.label);
    if (label) parsed.label = label;
    const factId = trimStr(rec.factId);
    if (factId) parsed.factId = factId;
    const date = trimStr(rec.date);
    if (date) parsed.date = date;
    const km = trimStr(rec.km);
    if (km) parsed.km = km;
    out.push(parsed);
  }
  return out;
}

/** Persistences lauks - tikai ja masīvs ir, lai esošie melnraksti paliek neskarti. */
export function dealerMajorWorkOverridesSnapshotField(
  overrides: DealerMajorWorkOverride[] | null | undefined,
): { dealerMajorWorkOverrides?: DealerMajorWorkOverride[] } {
  return overrides != null ? { dealerMajorWorkOverrides: overrides } : {};
}
