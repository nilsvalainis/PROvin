/**
 * Tehnisko risku izejas validators (v2).
 * E = kļūda (viena pārģenerēšana); W = brīdinājums operatoram.
 */
import {
  allowedEngineCodesFromIdentification,
  isVerifiedKbCostBand,
  verifiedKbCostBandsFromMap,
  type TechnicalRiskIdentification,
  type TechnicalRiskMap,
} from "@/lib/admin-ai-technical-risk-map-types";
import { PROVIN_KB_EUR_ACTIVE } from "@/lib/provin-kb";

export type TechnicalRiskLintLevel = "E" | "W";

export type TechnicalRiskLintIssue = {
  id: string;
  level: TechnicalRiskLintLevel;
  message: string;
};

export type TechnicalRiskLintInput = {
  text: string;
  identification?: TechnicalRiskIdentification | null;
  map?: TechnicalRiskMap | null;
  allowCostBands?: boolean;
};

export type TechnicalRiskLintResult = {
  ok: boolean;
  errors: TechnicalRiskLintIssue[];
  warnings: TechnicalRiskLintIssue[];
  issues: TechnicalRiskLintIssue[];
};

const INTRO_RE = /^(Šī|Šajā)\s+(automašīn\w+|auto)\s+(ir aprīkota|uzstādīt)/i;
const FLAGSHIP_RE = /viens no\s+(veiksmīgāk|uzticamāk|pārbaudītāk)/i;
const PRAISE_RE = /uzticam|veiksmīg|pārbaudītāk|izcil|slaven|labākaj|premium|legend/i;
const RISK_FACT_RE = /risk|kļūm|ķēd|zobsiksn|noplūd|maiņ|noberz|gultn|tipiski|klātien|defekt|vāj|resur/i;
const EXPERIENCE_RE = /manā\s+(pieredzē|praksē)|es esmu redzējis/i;
const CONSULTATIVE_BAN_RE = /\bobligāti\b|\bkritiski\b|netiek rekomendēts/i;
const N57_CONROD_RE = /\bN57\b/i;
const CONROD_BEARING_RE = /kla[nņ]a\s+gultn|šatun|conrod|connecting.?rod/i;

export function textMentionsN57ConrodBearing(text: string): boolean {
  return N57_CONROD_RE.test(text) && CONROD_BEARING_RE.test(text);
}

function isPraisingIntro(text: string): boolean {
  if (FLAGSHIP_RE.test(text)) return true;
  const head = text.slice(0, 280).trim();
  if (!INTRO_RE.test(head)) return false;
  const first = head.split(/(?<=[.!?])\s+/)[0] ?? head;
  if (PRAISE_RE.test(first)) return true;
  return !RISK_FACT_RE.test(first);
}
const EUR_RE = /€|EUR|\beiro\b/i;
const MARKDOWN_LINE_RE = /^(\s*[-*]\s|\s*#{1,6}\s)/m;
const MARKDOWN_INLINE_RE = /\*\*|__|\*(?=\S)/;
const RESOURCE_KM_RE = /\d{3}[ \u00a0]?000\s*km/i;
const RESOURCE_CTX_RE = /resurs|kalpo|izturēs/i;
const ALARM_RE = /kritisk|katastrof|anomālij|!/i;
const MIXED_HEADING_RE = /negadījum\w*\s+vēsture|nobraukuma\s+analīze|eļļas\s+maiņas\s+intervāl/i;
const NEGATION_RE = /neattiecas|nav risks|nav raksturīg/i;
const CHAIN_RE = /sadales\s+ķēd|timing\s+chain|\bķēd(?:e|es|ēm|ēm)?\b/i;
const TIMING_BELT_RE = /zobsiksn|timing\s+belt/i;
const AUX_BELT_RE = /papildsiksn|piedziņas\s+siksn/i;
const ENGINE_CODE_RE =
  /\b(?:OM\d{3}(?:\.\d{2,3})?|[A-Z]{1,3}\d{2,4}[A-Z]{0,3}\d{0,2})\b/g;
const ENGINE_CODE_FALSE_POSITIVE = new Set([
  "EURO",
  "CSDD",
  "LTAB",
  "VIN",
  "PDF",
  "HTML",
  "HTTP",
  "HTTPS",
  "JSON",
  "PROVIN",
  "IRISS",
  "AUTO",
  "BMW",
  "AUDI",
  "VOLVO",
  "FORD",
  "TESLA",
  "TDI",
  "TFSI",
  "FSI",
  "TSI",
  "CDI",
  "HDI",
  "CRDI",
  "XDRIVE",
  "QUATTRO",
  "MATIC",
  "DSG",
  "S",
  "TA",
  "ADAS",
  "SRS",
  "DPF",
  "EGR",
  "OEM",
  "KBA",
  "NHTSA",
  "EU",
]);

function countSections(text: string): number {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.length;
}

function extractEngineCodeTokens(text: string): string[] {
  const out = new Set<string>();
  const matches = text.toUpperCase().match(ENGINE_CODE_RE) ?? [];
  for (const raw of matches) {
    const t = raw.replace(/[.,;:]+$/, "");
    if (t.length < 4) continue;
    if (ENGINE_CODE_FALSE_POSITIVE.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    out.add(t);
  }
  return [...out];
}

function headingLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length <= 80 && !/[.!?]$/.test(l));
}

export function lintTechnicalRiskText(input: TechnicalRiskLintInput): TechnicalRiskLintResult {
  const text = input.text ?? "";
  const issues: TechnicalRiskLintIssue[] = [];

  if (isPraisingIntro(text)) {
    issues.push({
      id: "L1",
      level: "E",
      message: "Aizliegts slavinājuma ievads (viens no uzticamākajiem / slavinājuma „aprīkota ar”).",
    });
  }
  if (EXPERIENCE_RE.test(text)) {
    issues.push({
      id: "L2",
      level: "E",
      message: "Izdomāta pieredze (manā pieredzē / manā praksē).",
    });
  }

  const allowEur = input.allowCostBands === true;
  const hideEur = input.map?.hide_cost_bands === true;
  const verifiedBands = verifiedKbCostBandsFromMap(input.map);
  if (EUR_RE.test(text)) {
    const amounts = [...text.matchAll(/\d[\d\s.,]{0,8}\d/g)].map((m) =>
      Number(String(m[0]).replace(/\s/g, "").replace(",", ".")),
    );
    const amountOk =
      verifiedBands.length > 0 &&
      amounts.some((n) =>
        verifiedBands.some((b) => Number.isFinite(n) && n >= b.min && n <= b.max),
      );
    const bandOk = input.map?.risks.some((r) => isVerifiedKbCostBand(r.cost_band_eur)) === true;
    if (!PROVIN_KB_EUR_ACTIVE || hideEur || !allowEur || !bandOk || !amountOk) {
      issues.push({
        id: "L3",
        level: "E",
        message:
          "EUR summa nav atļauta: KB EUR joslas nav ieviestas, vajag KB: + datumu, slēdzis nedrīkst slēpt, summai jāsakrīt ar karti.",
      });
    }
  }

  const allowed = new Set(
    allowedEngineCodesFromIdentification(input.identification ?? input.map?.identification).map((c) =>
      c.replace(/[^A-Z0-9]/g, ""),
    ),
  );
  if (allowed.size > 0) {
    for (const token of extractEngineCodeTokens(text)) {
      const compact = token.replace(/[^A-Z0-9]/g, "");
      if (!allowed.has(compact) && ![...allowed].some((a) => a.includes(compact) || compact.includes(a))) {
        issues.push({
          id: "L4",
          level: "E",
          message: `Svešs dzinēja kods tekstā: ${token}.`,
        });
        break;
      }
    }
  }

  const hasChain = CHAIN_RE.test(text);
  const hasTimingBelt = TIMING_BELT_RE.test(text);
  const onlyAuxBelt = AUX_BELT_RE.test(text) && !hasTimingBelt;
  if (hasChain && hasTimingBelt && !onlyAuxBelt) {
    issues.push({
      id: "L5",
      level: "E",
      message: "Ķēde un zobsiksna vienam dzinējam (atļauta tikai papildsiksna / piedziņas siksna).",
    });
  }

  if (MARKDOWN_LINE_RE.test(text) || MARKDOWN_INLINE_RE.test(text)) {
    issues.push({
      id: "L6",
      level: "E",
      message: "Markdown nav atļauts (*, __, saraksta zīmes, #).",
    });
  }

  if (RESOURCE_KM_RE.test(text) && RESOURCE_CTX_RE.test(text)) {
    const hasSource = Boolean(input.map?.risks.some((r) => r.sources.length > 0));
    if (!hasSource) {
      issues.push({
        id: "L7",
        level: "W",
        message: "Resursa skaitlis bez avota kartē.",
      });
    }
  }

  if (ALARM_RE.test(text)) {
    issues.push({
      id: "L8",
      level: "W",
      message: "Trauksmes vārdi (kritisk / katastrof / anomālij / !).",
    });
  }

  if (CONSULTATIVE_BAN_RE.test(text)) {
    issues.push({
      id: "L13",
      level: "W",
      message: "Taisnā pavēle (obligāti / kritiski / netiek rekomendēts). Lietot konsultatīvu formulējumu.",
    });
  }

  if (headingLines(text).some((h) => MIXED_HEADING_RE.test(h))) {
    issues.push({
      id: "L9",
      level: "W",
      message: "Sadaļu jaukšana (negadījumu vēsture / nobraukuma analīze / eļļas intervāli).",
    });
  }

  if (NEGATION_RE.test(text)) {
    issues.push({
      id: "L10",
      level: "W",
      message: "Nolieguma sadaļa (neattiecas / nav risks).",
    });
  }

  const confidence =
    input.identification?.engine.confidence ?? input.map?.identification.engine.confidence;
  if (confidence === "C" && !/marķējum/i.test(text)) {
    issues.push({
      id: "L11",
      level: "W",
      message: "Dzinēja kods ar ticamību C bez atrunas par marķējumu.",
    });
  }

  const sections = countSections(text);
  if (text.trim() && (sections < 4 || sections > 12)) {
    issues.push({
      id: "L12",
      level: "W",
      message: `Sadaļu skaits ${sections} (gaidīts 4-12).`,
    });
  }

  const errors = issues.filter((i) => i.level === "E");
  const warnings = issues.filter((i) => i.level === "W");
  return { ok: errors.length === 0, errors, warnings, issues };
}

export function formatTechnicalRiskLintErrors(issues: TechnicalRiskLintIssue[]): string {
  return issues.map((i) => `${i.id} ${i.level}: ${i.message}`).join("\n");
}
