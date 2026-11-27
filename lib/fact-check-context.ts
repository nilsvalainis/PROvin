/**
 * Faktu pārbaudes konteksta sargs (Nils 27.11.2026: «izrauj faktu no konteksta, tā nedrīkst!»).
 *
 * Noliegums ir apgalvojums par datiem tikai tad, ja teikums to tiešām apgalvo. Hipotētiski,
 * nosacījuma un neziņas teikumi («tas nenozīmē, ka … nav veikta», «nevar apgalvot, ka … nav»,
 * «ja … nav», «teorētiski var liecināt», «nevaram apliecināt») NAV apgalvojums, ka darbs nav veikts.
 * Mūsu deterministiskās eļļas piebildes (`oil-interval-dealer-notes`) nekad nav faktu kļūda.
 *
 * Lieto gan deterministiskajos noteikumos (teikuma izvēlē, lai īsts noliegums blakus teikumā netiktu
 * palaists garām), gan kā filtru pēc AI atbildes.
 */
import {
  oilAfterLastChangeNotePresent,
  oilGenericRecordsNotePresent,
  oilNotSkippedNotePresent,
  oilPossibleChangeNotePresent,
} from "@/lib/oil-interval-dealer-notes";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

/** Hipotēze / noliegta hipotēze / neziņa: LV, EN, RU, DE. */
const HYPOTHETICAL_NEGATION_RES: readonly RegExp[] = [
  // LV (nosacījums «ja … nav» - tāpat kā `CONDITIONAL_RE` pretrunu pārbaudē)
  /(?:^|[,;:(]\s*|\s)(?:ja|gadījumā,?\s+ja)\s/iu,
  /(?<!\p{L})(?:nenozīmē|nenozime|nepierāda|nevar\p{L}*\s+(?:\S+\s+){0,2}?(?:apgalvot|secināt|apliecināt|apstiprināt|izslēgt|teikt|droši\s+teikt)|neizslēdz|nav\s+pierādījums|teorētiski|iespējams,|nav\s+(?:zināms|skaidrs),?\s+vai)(?!\p{L})/iu,
  // EN
  /\b(?:does\s+not\s+mean|doesn['’]t\s+mean|does\s+not\s+prove|doesn['’]t\s+prove|is\s+not\s+proof|no\s+proof|cannot\s+(?:be\s+)?(?:claimed|said|concluded|confirmed|ruled\s+out|confirm|claim|conclude|say)|can['’]t\s+(?:confirm|claim|conclude|say)|in\s+theory|theoretically|it\s+is\s+possible\s+that|not\s+known\s+whether|unclear\s+whether|if)\b/iu,
  // RU
  /(?<!\p{L})(?:не\s+означает|не\s+доказывает|не\s+является\s+доказательством|нельзя\s+(?:утверждать|сказать|сделать\s+вывод|исключать)|не\s+можем\s+подтвердить|теоретически|возможно|неизвестно,?\s+(?:был|ли)|если)(?!\p{L})/iu,
  // DE
  /(?<!\p{L})(?:bedeutet\s+nicht|heißt\s+nicht|beweist\s+nicht|kein\s+Beweis|kann\s+nicht\s+(?:behauptet|gesagt|bestätigt|ausgeschlossen)|nicht\s+bestätigen|theoretisch|möglicherweise|unklar,?\s+ob|wenn|falls)(?!\p{L})/iu,
];

export function isHypotheticalNegationSentence(sentence: string): boolean {
  const s = (sentence ?? "").trim();
  if (!s) return false;
  return HYPOTHETICAL_NEGATION_RES.some((re) => re.test(s));
}

/** Viena no eļļas obligātajām piebildēm (1./2./3. + pārsniegums pēc pēdējās maiņas, visas valodas, arī vecie formulējumi). */
export function isOilRequiredNoteSentence(sentence: string): boolean {
  const s = (sentence ?? "").trim();
  if (!s) return false;
  return (
    oilNotSkippedNotePresent(s) ||
    oilGenericRecordsNotePresent(s) ||
    oilPossibleChangeNotePresent(s) ||
    oilAfterLastChangeNotePresent(s)
  );
}

/** Teikums nav apgalvojums par datiem - faktu pārbaude to neatzīmē. */
export function isFactCheckExemptSentence(sentence: string): boolean {
  return isOilRequiredNoteSentence(sentence) || isHypotheticalNegationSentence(sentence);
}

/** Atradumu veidi, kas balstās uz noliegumu («nav X»), - tikai tos filtrē pēc konteksta. */
const NEGATION_FLAG_KINDS = new Set([
  "negated_fact",
  "no_accidents_claim",
  "no_damage_claim",
  "no_recalls_claim",
  "recall_denied",
  "contradiction",
]);

/**
 * Filtrs pēc deterministiskās un AI pārbaudes: atmet noliegumu atradumus uz hipotētiskiem teikumiem;
 * jebkuru atradumu uz obligātās eļļas piebildes atmet vienmēr.
 */
export function dropContextExemptFlags<T extends Pick<FactCheckFlag, "sentence" | "kind">>(flags: readonly T[]): T[] {
  return flags.filter((f) => {
    const sentence = f.sentence ?? "";
    if (isOilRequiredNoteSentence(sentence)) return false;
    if (NEGATION_FLAG_KINDS.has(String(f.kind)) && isHypotheticalNegationSentence(sentence)) return false;
    return true;
  });
}

/** AI faktu pārbaudes norāde: vērtēt kontekstā, nekad neatzīmēt obligātās piebildes. */
export const FACT_CHECK_CONTEXT_DIRECTIVE = `KONTEKSTS (obligāti): vērtē katru teikumu VISA teksta un rindkopas kontekstā, nevis izrautu frāzi. Hipotētisks, nosacījuma vai neziņas teikums («tas nenozīmē, ka … nav veikta», «nevar apgalvot, ka … nav», «ja … nav», «teorētiski var liecināt», «taču ierakstos tas nav apstiprināts», EN «does not mean», RU «не означает», DE «bedeutet nicht») NAV apgalvojums, ka darbs nav veikts - to neatzīmē. NEKAD neatzīmē obligātās eļļas piebildes: «Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā…», «…ir arī dīlera ieraksti bez detalizēta darbu apraksta … teorētiski var liecināt par eļļas maiņu…», «…eļļas filtra korpusa maiņa … nav pierādīts», «Kopš pēdējās fiksētās eļļas maiņas (…) līdz pēdējam dīlera ierakstam (…) … - tas pārsniedz ražotāja intervālu.» (arī tulkojumos). «Visi intervāli starp eļļas maiņām iekļaujas … neviens nepārsniedz» un «periods kopš pēdējās eļļas maiņas pārsniedz ražotāja intervālu» NAV pretruna: pirmais runā par intervāliem STARP maiņām, otrais par periodu PĒC pēdējās maiņas - to neatzīmē.`;
