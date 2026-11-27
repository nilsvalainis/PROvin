/**
 * Elektroauto (BEV) noteikšana un eļļas teksta tīrīšana (Nils 27.11.2026).
 *
 * Ja auto var identificēt kā BEV, dīlera eļļas intervālu laukā (`oilChangeIntervalNotes`) NEliek
 * rindkopu par eļļas maiņu («Eļļas maiņas ieraksti … dzinēja eļļas maiņa nav paredzēta …»).
 * Pirmā rinda «Ražotāja intervāls: nav piemērojams (elektroauto, KODS).» un pārējās sadaļas
 * (regulāro apkopju intervāli, datu hronoloģija) paliek.
 *
 * Hibrīdi (PHEV / HEV / MHEV, BMW i3 REx) NAV BEV - tiem ir iekšdedzes dzinējs un eļļas analīze paliek.
 */

export type BevSignals = {
  /** Degvielas lauki (CSDD, dīleris, OneAuto, Outvin). */
  fuel?: readonly (string | null | undefined)[];
  /** Dzinēja / motora kodi (piem. BMW HA0, HA0001N0). */
  engineCodes?: readonly (string | null | undefined)[];
  /** Marka / modelis / apraksti (piem. «BMW iX3», «Renault Megane E-Tech Electric»). */
  models?: readonly (string | null | undefined)[];
  /** Jau uzrakstītais eļļas lauka teksts (pirmā rinda «nav piemērojams (elektroauto …)»). */
  oilText?: string | null;
};

/** Hibrīda / iekšdedzes papildinājuma pazīmes - ja kāda ir, auto NAV BEV. */
const HYBRID_RE =
  /(?:hibr[iī]d|hybrid|гибрид|\bphev\b|\bmhev\b|\bhev\b|plug[\s-]?in|e[\s-]?hybrid|\brex\b|range[\s-]?extender|\beq[\s-]?(?:boost|power)\b|\bgte\b|\bdm-?i\b|\bdm-?p\b)/iu;

/** Iekšdedzes degviela - ja degvielas laukā ir tā, auto NAV BEV. */
const COMBUSTION_FUEL_RE =
  /(?:benz[iī]n|benzin|petrol|gasoline|бензин|d[iī]ze[lļ]|diesel|дизел|\blpg\b|\bcng\b|gāze|autogāz|газ|ūdeņra|hydrogen|wasserstoff|e85|etanol|ethanol)/iu;

/** Elektrības degviela (CSDD «Elektrība», «ELECTRIC», «Elektro», «Strom»). */
const ELECTRIC_FUEL_RE = /(?:elektr|electric|\bbev\b|\bev\b|электр|\bstrom\b)/iu;

/** Elektromotora kodi / apraksti dzinēja laukā. */
const BEV_ENGINE_CODE_RE = /^H[A-D]0(?:\d{3}[A-Z]\d)?$/;
const BEV_ENGINE_TEXT_RE = /(?:elektromotor|electric\s+motor|e-?motor\b|электродвигат|элекромотор)/iu;

/** Tīri elektriskie modeļi (hibrīdi izslēgti ar HYBRID_RE pirms šī). */
const BEV_MODEL_RES: readonly RegExp[] = [
  // BMW i3 / i4 / i5 / i7, iX / iX1 / iX2 / iX3 (i3 REx izslēgts ar HYBRID_RE). Lielajiem burtiem tikai ar
  // «BMW» priekšā - «I4» dzinēja aprakstā («2.0L I4») ir rindas 4 cilindri, ne modelis.
  /\bi[3457]\b|\biX[123]?\b/,
  /\bbmw\s+(?:i[3457]|ix[123]?)\b/i,
  /\bid\.?\s?(?:[34567]|buzz)\b/i, // VW ID.3 / ID.4 / ID.5 / ID.7 / ID. Buzz
  /\be-?(?:golf|up)\b/i,
  // Audi e-tron (bet A3 / A6 / A7 / A8 / Q7 e-tron ir PHEV)
  /(?<!\b(?:a3|a6|a7|a8|q7)\b[\w\s-]{0,20})\be-?tron\b/i,
  /\btaycan\b/i,
  /\btesla\b|\bmodel\s+[3sxy]\b/i,
  /\bleaf\b|\be-?nv200\b|\bariya\b/i,
  /\bzo[eé]\b|\bm[eé]gane\s+e-?tech\b|\bkangoo\s+e-?tech\b|\btwingo\s+(?:e-?tech|electric)\b/i,
  /\beq[abcestv]\b/i, // Mercedes EQA / EQB / EQC / EQE / EQS / EQV / EQT
  /\bioniq\s?[569]\b|\bkona\s+(?:electric|ev)\b/i,
  /\bev\s?[3569]\b|\be-?niro\b|\be-?soul\b/i,
  /\bpolestar\s?[234]\b/i,
  /\benyaq\b|\belroq\b|\bcitigo\s?e\b|\bborn\b/i,
  /\bex30\b|\bex40\b|\bex90\b|\bec40\b|\bc40\s+recharge\b|\bxc40\s+recharge\s+pure\b/i,
  /\bmach-?e\b|\bi-?pace\b/i,
  /\be-(?:208|2008|308|3008|5008|rifter|traveller|expert)\b|\b(?:corsa|mokka|combo|vivaro|zafira)-?e\b|\b[eë]-c4\b|\b[eë]-berlingo\b/i,
  /\bbz4x\b|\bsolterra\b|\bux\s?300e\b|\brz\s?450e\b|\b500e\b|\bmx-?30\b|\bspring\b/i,
  /\bmini\s+(?:cooper\s+)?(?:se|electric)\b|\bsmart\s+(?:eq|#[135])\b/i,
  /\belectric\b|\belektro(?:auto|mobil)?\b/i,
];

function nonEmpty(list: readonly (string | null | undefined)[] | undefined): string[] {
  return (list ?? []).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
}

/** Eļļas lauka pirmā rinda jau saka, ka auto ir elektroauto. */
export const BEV_OEM_LINE_RE = /Ražotāja\s+intervāls:\s*nav\s+piemērojams\s*\(\s*elektroauto/iu;

/** Vai degvielas lauks ir tīri elektrisks (nevis «Benzīns/elektrība»). */
export function fuelIsBatteryElectric(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return ELECTRIC_FUEL_RE.test(t) && !COMBUSTION_FUEL_RE.test(t) && !HYBRID_RE.test(t);
}

export function engineCodeIsBev(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return BEV_ENGINE_CODE_RE.test(t.toUpperCase().replace(/\s+/g, "")) || BEV_ENGINE_TEXT_RE.test(t);
}

export function modelIsBev(raw: string): boolean {
  const t = raw.trim();
  if (!t || HYBRID_RE.test(t)) return false;
  return BEV_MODEL_RES.some((re) => re.test(t));
}

/**
 * Vai auto ir tīrs elektroauto. Kārtība: hibrīda pazīme -> nē; iekšdedzes degviela -> nē;
 * elektrības degviela -> jā; elektromotora kods -> jā; elektriskais modelis -> jā;
 * eļļas lauka pirmā rinda «nav piemērojams (elektroauto» -> jā.
 */
export function isBatteryElectricVehicle(signals: BevSignals): boolean {
  const fuel = nonEmpty(signals.fuel);
  const engines = nonEmpty(signals.engineCodes);
  const models = nonEmpty(signals.models);
  if ([...fuel, ...engines, ...models].some((s) => HYBRID_RE.test(s))) return false;
  if (fuel.some((f) => COMBUSTION_FUEL_RE.test(f))) return false;
  if (fuel.some(fuelIsBatteryElectric)) return true;
  if (engines.some(engineCodeIsBev)) return true;
  if (models.some(modelIsBev)) return true;
  return BEV_OEM_LINE_RE.test(signals.oilText ?? "");
}

// ---------------------------------------------------------------------------
// Eļļas maiņas rindkopu izmešana BEV tekstam
// ---------------------------------------------------------------------------

/** Virsraksts par eļļu (LV / EN / RU / DE). */
const OIL_HEADING_RE = /(?:eļļ|\boil\b|масл|(?<!\p{L})öl)/iu;

/** Teikums par dzinēja eļļas maiņu. */
const OIL_CHANGE_SENTENCE_RE =
  /(?:eļļ\p{L}*\s+maiņ|maiņ\p{L}*\s+eļļ|dzinēja\s+eļļ|motoreļļ|eļļas\s+filtr|oil\s+change|engine\s+oil|oil\s+filter|замен\p{L}*\s+(?:моторного\s+)?масл|масл\p{L}*\s+замен|моторн\p{L}*\s+масл|масляного\s+фильтр|ölwechsel|motoröl|ölfilter)/iu;
/** Teikums par elektromotoru + eļļu («elektromotoram eļļa nav nepieciešama»). */
const EMOTOR_RE = /(?:elektromotor|elektroaut|electric\s+(?:motor|vehicle|car)|\bev\b|электро|elektrofahrzeug|elektroauto)/iu;
const OIL_WORD_RE = /(?:eļļ|\boil\b|масл|(?<!\p{L})öl)/iu;
/** Reduktora / transmisijas eļļa BEV ir īsts apkopes darbs - to neaiztiek. */
const NON_ENGINE_OIL_RE = /(?:reduktor|transmisij|kārb|pārnesum|gearbox|transmission|reduction\s+gear|getriebe|редуктор|трансмисс|коробк)/iu;

function plainOf(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function sentenceIsOilChange(sentence: string): boolean {
  const p = plainOf(sentence);
  if (!p || NON_ENGINE_OIL_RE.test(p)) return false;
  if (OIL_CHANGE_SENTENCE_RE.test(p)) return true;
  return EMOTOR_RE.test(p) && OIL_WORD_RE.test(p);
}

/** Teikumu robeža: [.!?] + atstarpe + lielais burts / pēdiņa / gads / datums (ne «29. jūnija»). */
const SENTENCE_SPLIT_RE = /(?<=[.!?])((?:\s|&nbsp;)+)(?=[\p{Lu}«„"(<]|\d{4}\.\s|\d{1,2}\.\d{1,2}\.\d{4})/u;

function dropOilSentences(line: string): string {
  const parts = line.split(SENTENCE_SPLIT_RE);
  // parts: [s0, sep0, s1, sep1, s2 ...]
  const kept: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const s = parts[i] ?? "";
    if (sentenceIsOilChange(s)) continue;
    kept.push(s);
  }
  return kept.join(" ").trim();
}

const OEM_LINE_START_RE = /^(?:<[^>]+>)*\s*Ražotāja\s+intervāls\s*:/iu;

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^<(strong|b)>[^<]*<\/\1>$/i.test(t)) return true;
  const p = plainOf(t);
  if (!p || OEM_LINE_START_RE.test(t)) return false;
  if (/[.!?:;,]$/.test(p)) return false;
  return p.split(/\s+/).length <= 6 && p.length <= 60;
}

/** Rindu atdalītāji: `<br>`, jauna rinda, `</p>` / `<p>`. */
const LINE_SPLIT_RE = /(<br\s*\/?>|\r?\n|<\/p>\s*<p[^>]*>)/i;

/**
 * Izmet no eļļas lauka teksta visu par dzinēja eļļas maiņu: sadaļas ar eļļas virsrakstu
 * («Eļļas maiņas ieraksti», «Eļļas maiņu regularitāte», «Pēdējā fiksētā eļļas maiņa» un tulkojumi)
 * un atsevišķus teikumus par eļļas maiņu / elektromotoru un eļļu pārējās sadaļās.
 * Pirmā rinda «Ražotāja intervāls: …» paliek. Strādā ar HTML (`<br>`) un vienkāršu tekstu.
 */
export function stripOilChangeContentForBev(text: string): string {
  const src = text ?? "";
  if (!src.trim()) return src;
  const isHtml = /<br\s*\/?>|<\/?(?:p|strong|b|div)\b/i.test(src);
  const tokens = src.split(LINE_SPLIT_RE);
  type Line = { text: string; sep: string; heading: boolean; blank: boolean };
  const lines: Line[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const t = tokens[i] ?? "";
    lines.push({
      text: t,
      sep: tokens[i + 1] ?? "",
      heading: isHeadingLine(t),
      blank: plainOf(t) === "",
    });
  }

  let dropSection = false;
  const out: Line[] = [];
  for (const line of lines) {
    if (line.blank) {
      out.push(line);
      continue;
    }
    if (OEM_LINE_START_RE.test(line.text.trim())) {
      dropSection = false;
      out.push(line);
      continue;
    }
    if (line.heading) {
      dropSection = OIL_HEADING_RE.test(plainOf(line.text)) && !NON_ENGINE_OIL_RE.test(plainOf(line.text));
      if (!dropSection) out.push(line);
      continue;
    }
    if (dropSection) continue;
    const cleaned = dropOilSentences(line.text);
    if (!plainOf(cleaned)) continue;
    out.push({ ...line, text: cleaned });
  }

  // Virsraksts bez satura (nākamais ne-tukšais ir virsraksts vai beigas) - prom.
  const final: Line[] = [];
  for (let i = 0; i < out.length; i++) {
    const line = out[i]!;
    if (line.heading) {
      const next = out.slice(i + 1).find((l) => !l.blank);
      if (!next || next.heading) continue;
    }
    final.push(line);
  }

  const sepDefault = isHtml ? "<br>" : "\n";
  let joined = "";
  final.forEach((line, i) => {
    joined += line.text;
    if (i < final.length - 1) joined += line.sep || sepDefault;
  });
  return joined
    .replace(/(?:(?:\s|&nbsp;)*<br\s*\/?>){3,}/gi, "<br><br>")
    .replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, "\n\n")
    .replace(/^(?:\s|&nbsp;|<br\s*\/?>)+/gi, "")
    .replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/gi, "");
}

/**
 * Pirmā rinda BEV: ja AI uzrakstījis km / mēn. vai «nav droši zināms», aizvieto ar
 * «Ražotāja intervāls: nav piemērojams (elektroauto[, KODS]).». Ja rinda jau ir «nav piemērojams», nemaina.
 */
export function bevOemLine(engineCode?: string | null): string {
  const code = (engineCode ?? "").trim().toUpperCase();
  return `Ražotāja intervāls: nav piemērojams (elektroauto${code ? `, ${code}` : ""}).`;
}

const OEM_LINE_RE = /Ražotāja\s+intervāls\s*:[^<\n]*?(?:\.(?=(?:\s|&nbsp;)+\p{Lu})|(?=<|\n|$))/u;

export function normalizeBevOemLine(text: string, engineCode?: string | null): string {
  const src = text ?? "";
  const m = OEM_LINE_RE.exec(src);
  if (!m || BEV_OEM_LINE_RE.test(m[0])) return src;
  return src.slice(0, m.index) + bevOemLine(engineCode) + src.slice(m.index + m[0].length);
}

/** AI prompta direktīva BEV eļļas laukam. */
export const BEV_OIL_FIELD_DIRECTIVE_LV = `ELEKTROAUTO (BEV): šim auto nav iekšdedzes dzinēja un dzinēja eļļas maiņa nav paredzēta.
- Pirmā rinda tieši: „Ražotāja intervāls: nav piemērojams (elektroauto, [motora kods]).”
- NERAKSTI sadaļu „Eļļas maiņas ieraksti” un nevienu teikumu par eļļas maiņu, eļļas filtru vai to, ka elektromotoram eļļa nav vajadzīga.
- Raksti tikai par regulāro apkopju intervāliem (ierakstu skaits, periods, km) un datu hronoloģiju (garākais periods bez ierakstiem, mēneši kopš pēdējā ieraksta).`;
