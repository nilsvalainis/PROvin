/**
 * Tehnisko risku ievads: aizliegts tikai slavinošs prezentācijas sākums.
 * Faktu teikums (aprīkojums + šī mezgla risks) ir atļauts.
 */

const PRAISE_INTRO_RE =
  /viens no (?:vis)?(?:veiksmīg|labāk|uzticam|izturīg)|veiksmīgāk[aā] konstrukcij|izturīgāk[aā] konstrukcij|\buzticamākais\b|\buzticamākā konstrukcij/i;

const EQUIPPED_OPENER_RE = /^(?:šī automašīna|šis auto|automašīna) ir aprīkota ar/i;

const RISK_FACT_RE =
  /risks|kaite|ķēd|zobsiksn|šāl|gultn|turbo|EGR|DPF|mehatron|plais|pirkuma risks|nodil|jāpārbaud/i;

const BRAND_RE = /(bmw|audi|volkswagen|\bvw\b|mercedes|renault|volvo|škoda|toyota)/i;

const IDENTITY_HEADING_RE = /identifikācij|dzinēja konstrukcija|riska\s+kartē|dzinēja\s+identifikācij/i;

function firstPara(text: string): string {
  return (text ?? "").trim().split(/\n\s*\n/)[0] ?? "";
}

function firstLine(para: string): string {
  return para.split("\n")[0] ?? "";
}

function firstSentence(para: string): string {
  return para.split(/(?<=[.!?…])\s+/)[0] ?? para;
}

export function isPraisingTechRisksIntro(text: string): boolean {
  const para = firstPara(text);
  if (!para) return false;
  const line = firstLine(para);
  const sentence = firstSentence(para).trim();

  if (IDENTITY_HEADING_RE.test(line)) return true;
  if (/\*\*[^*]*identifikācij[^*]*\*\*/i.test(para)) return true;
  if (PRAISE_INTRO_RE.test(sentence) || PRAISE_INTRO_RE.test(line)) return true;

  if (EQUIPPED_OPENER_RE.test(sentence)) {
    const hasRisk = RISK_FACT_RE.test(para);
    const hasPraise = PRAISE_INTRO_RE.test(para);
    return !hasRisk || hasPraise;
  }

  if (/aprīkota ar/i.test(line) && !RISK_FACT_RE.test(para)) return true;

  if (
    /\b(šis ir|šī ir|šī automašīna ir|šis auto ir)\b/i.test(para) &&
    BRAND_RE.test(para) &&
    !RISK_FACT_RE.test(para)
  ) {
    return true;
  }

  return false;
}
