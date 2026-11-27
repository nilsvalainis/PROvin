/**
 * Deterministisks pēcfiltrs klienta ekspertlaukiem (S-AI2, 27.11.2026):
 * kopsavilkums, negadījumu kopsavilkums, tehniskie riski, klātienes apskate.
 * NEATTIECAS uz avotu komentāriem (tur apdrošināšanas EUR drīkst palikt).
 *
 * Prompts jau aizliedz EUR un remonta minējumus; šis ir pēdējais drošības tīkls:
 * - teikums ar € / EUR / eiro -> izmet (stripUnauthorizedEuroAmounts);
 * - remonta minējums («iespējams, nomainīts bamperis», «visticamāk pārkrāsots») -> izmet;
 * - «kalibrēšana» bez avota (avotos nav kalibrēšanas / vējstikla maiņas) -> izmet;
 * - teikumi, kas runā pretī ielādētajai kārbai (S-AI1) -> izmet.
 */
import { splitIntoSentences } from "@/lib/lv-sentences";
import { stripUnauthorizedEuroAmounts } from "@/lib/source-summary-comment-format";
import {
  findGearboxContradictions,
  stripGearboxContradictions,
  type CanonicalGearbox,
} from "@/lib/gearbox-kind-guard";

const B = String.raw`(?<![\p{L}\p{N}])`;
const L = String.raw`\p{L}*`;

const HEDGE = String.raw`(?:iespējams|iespējami|visticamāk|droši\s+vien|varbūt|šķiet|domājams|acīmredzot|varētu\s+būt|varētu\s+tikt|ticams,?\s+ka|izskatās,?\s+ka|nav\s+izslēgts,?\s+ka)`;
/**
 * Remonta divdabji: nomainīts, pārkrāsota, remontēts, iztaisnots, salabots, kalibrēta; lietvārds «remonts».
 * «krāsojums» / «nomaiņa» apzināti nav: prompta obligātā atruna («neizslēdz ... kosmētisku krāsojumu») un
 * apkopes teikumi («siksnas nomaiņa») ir pareizi.
 */
const REPAIR = String.raw`(?:(?:no|pār|iz|sa)?(?:mainīt|remontēt|krāsot|taisnot|labot|metināt|kalibrēt|lakot)(?:s|a|i|as|ts|ta|ti|tas)|remont(?:s|u|a|ēt${L})|kalibrēšan${L})`;
const REPAIR_GUESS_RE = new RegExp(`${B}${HEDGE}[^.!?\\n]{0,80}?${B}${REPAIR}(?![\\p{L}\\p{N}])`, "iu");

const CALIBRATION_RE = /kalibr\p{L}*/iu;
/** Avota pierādījums, ka kalibrēšana ir tēma: pati kalibrēšana vai vējstikla maiņa (ADAS kamera). */
const CALIBRATION_SOURCE_RE = /kalibr|calibr|vējstikl|windscreen|windshield|frontscheibe|windschutzscheibe/i;

export type ExpertFieldGuardOptions = {
  /** Avotu teksts (AI konteksts), pret kuru pārbauda «kalibrēšanu». Bez tā kalibrēšanas teikumus neaiztiek. */
  sourceText?: string | null;
  gearbox?: CanonicalGearbox | null;
};

function sentenceIsRepairSpeculation(s: string, calibrationAllowed: boolean): boolean {
  if (REPAIR_GUESS_RE.test(s)) return true;
  if (!calibrationAllowed && CALIBRATION_RE.test(s)) return true;
  return false;
}

function calibrationAllowed(opts: ExpertFieldGuardOptions): boolean {
  if (opts.sourceText == null) return true;
  return CALIBRATION_SOURCE_RE.test(opts.sourceText);
}

export type ExpertFieldIssue = { id: "eur" | "repair_guess" | "calibration" | "gearbox"; sentence: string };

/** Lint (bez labošanas): kas šajā tekstā pārkāpj ekspertlauku likumus. */
export function findExpertFieldIssues(text: string, opts: ExpertFieldGuardOptions = {}): ExpertFieldIssue[] {
  if (!text) return [];
  const out: ExpertFieldIssue[] = [];
  const calOk = calibrationAllowed(opts);
  for (const line of text.split("\n")) {
    for (const raw of splitIntoSentences(line)) {
      const s = raw.trim();
      if (!s) continue;
      if (/€|\bEUR\b|\beiro\b/i.test(s)) out.push({ id: "eur", sentence: s });
      else if (REPAIR_GUESS_RE.test(s)) out.push({ id: "repair_guess", sentence: s });
      else if (!calOk && CALIBRATION_RE.test(s)) out.push({ id: "calibration", sentence: s });
    }
  }
  if (opts.gearbox) {
    for (const hit of findGearboxContradictions(text, opts.gearbox)) out.push({ id: "gearbox", sentence: hit.sentence });
  }
  return out;
}

/** Izmet remonta minējumu un bezavota kalibrēšanas teikumus. Virsrakstu bez satura izmet kopā ar rindkopu. */
export function stripRepairSpeculation(text: string, opts: ExpertFieldGuardOptions = {}): string {
  if (!text) return text;
  const calOk = calibrationAllowed(opts);
  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split("\n");
      const kept = lines.map((line) =>
        splitIntoSentences(line)
          .filter((s) => !sentenceIsRepairSpeculation(s, calOk))
          .join("")
          .trim(),
      );
      if (lines.length > 1 && kept[0] && !kept.slice(1).some(Boolean)) return "";
      return kept.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Visi ekspertlauka pēcfiltri vienā secībā: EUR -> remonta minējumi -> kārba. */
export function applyExpertFieldGuards(text: string, opts: ExpertFieldGuardOptions = {}): string {
  if (!text) return text;
  let out = stripUnauthorizedEuroAmounts(text);
  out = stripRepairSpeculation(out, opts);
  if (opts.gearbox) out = stripGearboxContradictions(out, opts.gearbox);
  return out;
}
