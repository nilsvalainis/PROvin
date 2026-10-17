/**
 * Tehnisko risku v2 karte - kopīgi tipi (klients + serveris, bez server-only).
 * Shēma: docs/tech-risk-v2.md
 */

export type IdentificationConfidence = "A" | "B" | "C";

export type IdentifiedAggregateField = {
  value: string;
  confidence: IdentificationConfidence;
  evidence: string;
  candidates: string[];
};

export type TechnicalRiskIdentification = {
  engine: IdentifiedAggregateField;
  gearbox: IdentifiedAggregateField;
  platform: IdentifiedAggregateField;
  drive?: IdentifiedAggregateField;
};

export type TechnicalRiskMapSource = {
  type: "kb" | "tsb" | "recall" | "specialist" | "forum";
  ref: string;
  accessed: string;
};

export type TechnicalRiskMapItem = {
  component: string;
  failure_mode: string;
  typical_km_range: [number, number] | null;
  this_car_position: "pirms" | "iekšā" | "pēc" | "nezināms";
  already_done_evidence: string | null;
  probability: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  priority: number;
  applies_to_this_car: boolean;
  confidence: "high" | "medium" | "low";
  sources: TechnicalRiskMapSource[];
  cost_band_eur: { min: number; max: number; source: string; dated: string } | null;
  inspection_hint: string;
};

/** Maksas detaļu katalogi nav EUR avots. */
const PAID_PARTS_PRICE_RE =
  /autodoc|partslink|exist\.ua|partsouq|fcpeuro|rockauto|ecs\s*tuning|partsinmotion|mister-auto|auto-doc/i;

export function isPaidPartsPriceSource(source: string): boolean {
  return PAID_PARTS_PRICE_RE.test(source);
}

/** EUR josla atļauta tikai no verificēta KB ieraksta ar avotu un datumu. */
export function isVerifiedKbCostBand(
  band: { source?: string | null; dated?: string | null } | null | undefined,
): boolean {
  if (!band) return false;
  const source = (band.source ?? "").trim();
  const dated = (band.dated ?? "").trim();
  if (!source || !dated) return false;
  if (isPaidPartsPriceSource(source)) return false;
  return /^(KB:|kb:)/.test(source) || /^KB\b/i.test(source);
}

export function verifiedKbCostBandsFromMap(
  map: TechnicalRiskMap | null | undefined,
): Array<{ min: number; max: number; source: string; dated: string }> {
  if (!map) return [];
  return map.risks
    .map((r) => r.cost_band_eur)
    .filter((b): b is { min: number; max: number; source: string; dated: string } =>
      Boolean(b && isVerifiedKbCostBand(b)),
    );
}

const EUR_SENTENCE_RE = /€|EUR|\beiro\b/i;

export function stripTechnicalRiskEurSentences(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!EUR_SENTENCE_RE.test(line)) return line;
      return line
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !EUR_SENTENCE_RE.test(s))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildTechRiskOperatorFlags(map: TechnicalRiskMap | null | undefined): string[] {
  if (!map) return [];
  const flags: string[] = [];
  if (map.identification.engine.confidence === "C") {
    flags.push("OPERATORA KAROG: dzinēja kods ar ticamību C. Nolasīt marķējumu uz bloka; neuzminēt kodu.");
  }
  if (map.identification.gearbox.confidence === "C") {
    flags.push("OPERATORA KAROG: kārbas kods nav drošs. Nolasīt plāksnīti; neuzminēt tipu.");
  }
  for (const u of map.unknowns) {
    flags.push(`OPERATORA KAROG: trūkst datu (${u}). Rakstīt tikai to, kas ir avotos.`);
  }
  return flags;
}

export type TechnicalRiskRecall = {
  id_or_title: string;
  source: string;
  status_known: boolean;
};

export type TechnicalRiskMap = {
  identification: TechnicalRiskIdentification;
  risks: TechnicalRiskMapItem[];
  damage_interpretation: unknown[];
  recalls: TechnicalRiskRecall[];
  strengths: Array<{ text: string; source: string }>;
  unknowns: string[];
  /** Operatora slēdzis: slēpt verificētās KB EUR joslas tekstā. */
  hide_cost_bands?: boolean;
};

const CONFIDENCES = new Set<IdentificationConfidence>(["A", "B", "C"]);
const LEVELS = new Set(["high", "medium", "low"]);
const POSITIONS = new Set(["pirms", "iekšā", "pēc", "nezināms"]);
const SOURCE_TYPES = new Set(["kb", "tsb", "recall", "specialist", "forum"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asLevel(v: unknown, fallback: "high" | "medium" | "low" = "medium"): "high" | "medium" | "low" {
  const t = str(v).toLowerCase();
  return LEVELS.has(t) ? (t as "high" | "medium" | "low") : fallback;
}

function emptyField(): IdentifiedAggregateField {
  return { value: "", confidence: "C", evidence: "", candidates: [] };
}

function parseField(raw: unknown): IdentifiedAggregateField {
  if (!raw || typeof raw !== "object") return emptyField();
  const o = raw as Record<string, unknown>;
  const confidenceRaw = str(o.confidence).toUpperCase();
  const candidates = Array.isArray(o.candidates)
    ? o.candidates.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
    : [];
  return {
    value: str(o.value),
    confidence: CONFIDENCES.has(confidenceRaw as IdentificationConfidence)
      ? (confidenceRaw as IdentificationConfidence)
      : "C",
    evidence: str(o.evidence),
    candidates,
  };
}

function parseSources(raw: unknown): TechnicalRiskMapSource[] {
  if (!Array.isArray(raw)) return [];
  const out: TechnicalRiskMapSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = str(o.type).toLowerCase();
    const ref = str(o.ref);
    if (!ref) continue;
    out.push({
      type: SOURCE_TYPES.has(type) ? (type as TechnicalRiskMapSource["type"]) : "specialist",
      ref,
      accessed: str(o.accessed),
    });
  }
  return out;
}

function parseRisk(raw: unknown, index: number): TechnicalRiskMapItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const component = str(o.component);
  if (!component) return null;
  let range: [number, number] | null = null;
  if (Array.isArray(o.typical_km_range) && o.typical_km_range.length >= 2) {
    const a = Number(o.typical_km_range[0]);
    const b = Number(o.typical_km_range[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) range = [a, b];
  }
  const pos = str(o.this_car_position).toLowerCase();
  let cost: TechnicalRiskMapItem["cost_band_eur"] = null;
  if (o.cost_band_eur && typeof o.cost_band_eur === "object") {
    const c = o.cost_band_eur as Record<string, unknown>;
    const min = Number(c.min);
    const max = Number(c.max);
    if (Number.isFinite(min) && Number.isFinite(max) && !isPaidPartsPriceSource(str(c.source))) {
      cost = { min, max, source: str(c.source), dated: str(c.dated) };
    }
  }
  return {
    component,
    failure_mode: str(o.failure_mode),
    typical_km_range: range,
    this_car_position: POSITIONS.has(pos) ? (pos as TechnicalRiskMapItem["this_car_position"]) : "nezināms",
    already_done_evidence: str(o.already_done_evidence) || null,
    probability: asLevel(o.probability),
    impact: asLevel(o.impact),
    priority: Number.isFinite(Number(o.priority)) ? Number(o.priority) : index + 1,
    applies_to_this_car: o.applies_to_this_car !== false,
    confidence: asLevel(o.confidence),
    sources: parseSources(o.sources),
    cost_band_eur: cost,
    inspection_hint: str(o.inspection_hint),
  };
}

function parseRecalls(raw: unknown): TechnicalRiskRecall[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id_or_title: "nav atrasts", source: "meklēšana", status_known: false }];
  }
  const out: TechnicalRiskRecall[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      const title = item.trim();
      out.push({
        id_or_title: title,
        source: /nav atrasts/i.test(title) ? "meklēšana" : "",
        status_known: false,
      });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = str(o.id_or_title) || str(o.title) || str(o.id);
    if (!title) continue;
    out.push({
      id_or_title: title,
      source: str(o.source),
      status_known: o.status_known === true,
    });
  }
  return out.length > 0
    ? out
    : [{ id_or_title: "nav atrasts", source: "meklēšana", status_known: false }];
}

export function parseTechnicalRiskMap(raw: unknown): TechnicalRiskMap | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const identificationRaw =
    o.identification && typeof o.identification === "object"
      ? (o.identification as Record<string, unknown>)
      : {};
  const risks = Array.isArray(o.risks)
    ? o.risks.map((r, i) => parseRisk(r, i)).filter((r): r is TechnicalRiskMapItem => r != null)
    : [];
  const strengths = Array.isArray(o.strengths)
    ? o.strengths
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const x = s as Record<string, unknown>;
          const text = str(x.text);
          return text ? { text, source: str(x.source) } : null;
        })
        .filter((s): s is { text: string; source: string } => s != null)
    : [];
  const unknowns = Array.isArray(o.unknowns)
    ? o.unknowns.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim())
    : [];
  return {
    identification: {
      engine: parseField(identificationRaw.engine),
      gearbox: parseField(identificationRaw.gearbox),
      platform: parseField(identificationRaw.platform),
      drive: identificationRaw.drive ? parseField(identificationRaw.drive) : undefined,
    },
    risks,
    damage_interpretation: Array.isArray(o.damage_interpretation) ? o.damage_interpretation : [],
    recalls: parseRecalls(o.recalls),
    strengths,
    unknowns,
    ...(o.hide_cost_bands === true ? { hide_cost_bands: true } : {}),
  };
}

/** Persistences lauks - tikai ja karte ir, lai esošie melnraksti paliek neskarti. */
export function technicalRiskMapSnapshotField(
  map: TechnicalRiskMap | null | undefined,
): { technicalRiskMap?: TechnicalRiskMap } {
  return map ? { technicalRiskMap: map } : {};
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as unknown;
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseTechnicalRiskMapFromAiText(text: string): TechnicalRiskMap | null {
  return parseTechnicalRiskMap(extractJsonObject(text));
}

export function allowedEngineCodesFromIdentification(
  identification: TechnicalRiskIdentification | null | undefined,
): string[] {
  if (!identification) return [];
  const out = new Set<string>();
  const push = (v: string) => {
    const t = v.trim();
    if (t) out.add(t.toUpperCase());
  };
  push(identification.engine.value);
  for (const c of identification.engine.candidates) push(c);
  return [...out];
}
