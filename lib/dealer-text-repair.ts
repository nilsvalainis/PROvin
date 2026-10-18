/**
 * Dīlera / OEM importa teksta labošana: latin1 / cp1252 baiti, kas nolasīti kā UTF-8
 * (vācu umlauti kļūst par „�”), klasiskais „Ã¶” mojibake un acīmredzami izvilkšanas artefakti.
 * Idempotents: jau tīram tekstam neko nemaina.
 */

const REPLACEMENT_CHAR = "\uFFFD";

/** UTF-8 baiti, kas nolasīti kā cp1252 („MotorÃ¶l”). */
const UTF8_AS_CP1252: readonly [string, string][] = [
  ["Ã¤", "ä"],
  ["Ã¶", "ö"],
  ["Ã¼", "ü"],
  ["Ã„", "Ä"],
  ["Ã\u2013", "Ö"],
  ["Ãœ", "Ü"],
  ["ÃŸ", "ß"],
  ["Ã©", "é"],
  ["Ã¨", "è"],
  ["Â§", "§"],
  ["Â°", "°"],
  ["Â ", " "],
];

type UmlautFix = { re: RegExp; lower: string; upper: string };

/**
 * „�” vietā zināmos vācu darbnīcas vārdos. `~` šablonā = U+FFFD.
 * Tikai droši atpazīstami celmi; nezināmi vārdi paliek neskarti (AI tulkojums tos interpretē).
 */
function stem(pattern: string, lower: string): UmlautFix {
  const src = pattern.replace(/~/g, REPLACEMENT_CHAR);
  return { re: new RegExp(src, "giu"), lower, upper: lower.toLocaleUpperCase("de") };
}

const UMLAUT_STEMS: UmlautFix[] = [
  stem("motor~l", "motoröl"),
  stem("getriebe~l", "getriebeöl"),
  stem("hydraulik~l", "hydrauliköl"),
  stem("(?<!\\p{L})~l(?=wechsel|filter|service|stand|ablass|verlust|wanne|k[~üu]hler|\\P{L}|$)", "öl"),
  stem("r~der", "räder"),
  stem("pr~f", "prüf"),
  stem("sicherheitsprfg", "sicherheitsprüfg"),
  stem("(?<=\\p{L})prfung", "prüfung"),
  stem("fl~ssigkeit", "flüssigkeit"),
  stem("k~hl", "kühl"),
  stem("z~nd", "zünd"),
  stem("schl~ssel", "schlüssel"),
  stem("st~rung", "störung"),
  stem("ger~usch", "geräusch"),
  stem("(?<!\\p{L})t~r(?=\\p{L}{0,8}(?!\\p{L}))", "tür"),
  stem("r~ck(?=ruf|leucht|fahr|spiegel|sitz|wand|lauf|stell)", "rück"),
  stem("h~ndler", "händler"),
  stem("l~fter", "lüfter"),
  stem("(?<!\\p{L})~ber(?=pr|holung|holen|tragen|sicht)", "über"),
  stem("(?<!\\p{L})f~r(?!\\p{L})", "für"),
  stem("ausf~hr", "ausführ"),
  stem("durchgef~hrt", "durchgeführt"),
  stem("gem~ss", "gemäss"),
  stem("erg~nz", "ergänz"),
  stem("sto~d[äa~]mpfer", "stoßdämpfer"),
  stem("d~mpfer", "dämpfer"),
  stem("gl~hkerze", "glühkerze"),
];

/** § nāk pirms skaitļa: „SICHERHEITSPRÜFG � 57” → „§ 57” (AT §57a). */
const PARAGRAPH_SIGN_RE = new RegExp(`(^|[\\s(])${REPLACEMENT_CHAR}\\s*(?=\\d)`, "gu");

const TYPO_FIXES: readonly [RegExp, string][] = [
  [/\bTansmitter/g, "Transmitter"],
  [/\bTANSMITTER/g, "TRANSMITTER"],
  [/\btansmitter/g, "transmitter"],
];

function matchCase(source: string, lower: string, upper: string): string {
  const letters = source.replace(/[^\p{L}]/gu, "");
  if (letters && letters === letters.toLocaleUpperCase("de") && letters !== letters.toLocaleLowerCase("de")) {
    return upper.replace(/ß/g, "SS");
  }
  if (letters && letters[0] === letters[0]!.toLocaleUpperCase("de")) {
    return lower.charAt(0).toLocaleUpperCase("de") + lower.slice(1);
  }
  return lower;
}

function repairCp1252Mojibake(text: string): string {
  if (!/[ÃÂ]/.test(text)) return text;
  let out = text;
  for (const [bad, good] of UTF8_AS_CP1252) out = out.split(bad).join(good);
  return out;
}

/**
 * Vācu darbnīcas / DMS celmi ar umlautu vai ß. „�” vietā liek to burtu, kura variants
 * dod garāko celmu, kas pārklāj šo pozīciju. Ja neviens neder vai ir neizšķirts, „�” paliek.
 */
const GERMAN_UMLAUT_WORD_STEMS: readonly string[] = [
  "durchführ", "durchgeführ", "ausführ", "ausgeführ", "geführ", "führ", "überführ",
  "prüf", "geprüf", "überprüf", "nachprüf", "über", "überhol", "übernahm", "übergab", "für",
  "änder", "geänder", "veränder", "abänder", "räder", "räd", "ersatzrad", "öl", "öls",
  "schlüssel", "störung", "gestör", "geräusch", "gerät", "steuergerät", "tür", "türen",
  "rück", "zurück", "händler", "lüfter", "flüssig", "kühl", "zünd", "dämpf", "stoßdämpf",
  "glüh", "gemäß", "gemäss", "regelmäß", "ergänz", "läng", "gehäus", "häus", "schläuch",
  "spül", "füll", "befüll", "nachfüll", "aufgefüll", "gefüll", "düse", "träger", "kürz",
  "öffn", "geöffn", "zubehör", "hör", "lös", "gelös", "höhe", "erhöh", "größ", "groß",
  "maß", "straß", "fuß", "schließ", "verschleiß", "heiß", "weiß", "schweiß", "außen",
  "plätt", "blätt", "wischerblät", "bürst", "läuf", "anhäng", "häng", "sätz", "zusätz",
  "früh", "kält", "wärm", "wärmetausch", "schäd", "beschädig", "gewähr", "wähl", "ausgewähl",
  "nässe", "näh", "löch", "dröhn", "fänger", "hülse", "bügel", "müll", "verkürz", "säub",
  "gesäub", "räum", "geräum", "präz", "übertrag", "überbrück", "brück", "rüttel", "drück",
  "druckknöpf", "knöpf", "köpf", "schlöss", "zahnräd", "getriebeöl", "motoröl", "ölwechsel",
  "ölfilter", "ölstand", "ölwanne", "ölverlust", "ölservice", "ölkühler", "bremsflüssig",
  "kühlmittel", "kühler", "zündkerz", "glühkerz", "rückleucht", "rückfahr", "rückruf",
  "türgriff", "türschloss", "kältemittel", "mängel", "mangelbeseitig", "beschläg",
  "auslös", "ausgelös", "entlüft", "belüft", "lüftung", "gebläse", "gebläs", "gelände",
];

const UMLAUT_CANDIDATES = ["ü", "ä", "ö", "ß"] as const;

function resolveWordUmlauts(word: string): string {
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== REPLACEMENT_CHAR) continue;
    const lower = chars.map((c) => c.toLocaleLowerCase("de"));
    let best: { cand: string; len: number } | null = null;
    let tie = false;
    for (const cand of UMLAUT_CANDIDATES) {
      lower[i] = cand;
      const w = lower.join("");
      for (const stemText of GERMAN_UMLAUT_WORD_STEMS) {
        for (let at = w.indexOf(stemText); at >= 0; at = w.indexOf(stemText, at + 1)) {
          if (at > i || i >= at + stemText.length) continue;
          if (!best || stemText.length > best.len) {
            best = { cand, len: stemText.length };
            tie = false;
          } else if (stemText.length === best.len && best.cand !== cand) {
            tie = true;
          }
        }
      }
    }
    if (best && !tie) chars[i] = best.cand;
  }
  const original = [...word];
  const letters = original.filter((c) => /\p{L}/u.test(c)).join("");
  const upper = letters.length > 1 && letters === letters.toLocaleUpperCase("de");
  return chars
    .map((c, i) => {
      if (original[i] !== REPLACEMENT_CHAR || c === REPLACEMENT_CHAR) return c;
      if (upper) return c === "ß" ? "SS" : c.toLocaleUpperCase("de");
      return i === 0 && c !== "ß" ? c.toLocaleUpperCase("de") : c;
    })
    .join("");
}

function repairGenericUmlauts(text: string): string {
  if (!text.includes(REPLACEMENT_CHAR)) return text;
  return text.replace(/[\p{L}\uFFFD]*\uFFFD[\p{L}\uFFFD]*/gu, (word) =>
    /\p{L}/u.test(word) ? resolveWordUmlauts(word) : word,
  );
}

function repairUmlautStems(text: string): string {
  let out = text;
  for (const fix of UMLAUT_STEMS) {
    out = out.replace(fix.re, (m) => matchCase(m, fix.lower, fix.upper));
  }
  return repairGenericUmlauts(out.replace(PARAGRAPH_SIGN_RE, "$1§ "));
}

/** „… _ _.” / „___” izvilkšanas atlikumi rindas beigās vai kā atsevišķa rinda. */
function stripExtractionArtifacts(text: string): string {
  return text
    .split("\n")
    .flatMap((line) => {
      if (!line.includes("_")) return [line];
      const cleaned = line.replace(/(?:\s*_)+[\s_.]*$/u, "").replace(/\s+$/u, "");
      return cleaned.trim() ? [cleaned] : [];
    })
    .join("\n");
}

/** Vai tekstā ir pazaudēti (U+FFFD) vai mojibake simboli. */
export function hasDealerTextEncodingDamage(text: string): boolean {
  return text.includes(REPLACEMENT_CHAR) || /Ã[¤¶¼„\u2013œŸ©¨]|Â§/.test(text);
}

export function repairDealerImportText(raw: string): string {
  if (!raw) return raw;
  let text = repairCp1252Mojibake(raw);
  if (text.includes(REPLACEMENT_CHAR) || /sicherheitsprfg|(?<=\p{L})prfung/iu.test(text)) {
    text = repairUmlautStems(text);
  }
  for (const [re, good] of TYPO_FIXES) text = text.replace(re, good);
  if (text.includes("_")) text = stripExtractionArtifacts(text);
  return text;
}

/**
 * HTTP atbildes baiti → teksts. UTF-8, ja derīgs; citādi windows-1252
 * (OEM eksporti bieži sūta latin1 bez charset galvenes).
 */
export function decodeDealerResponseBytes(bytes: ArrayBuffer | Uint8Array, contentType?: string | null): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const declared = /charset\s*=\s*"?([\w-]+)/i.exec(contentType ?? "")?.[1]?.toLowerCase() ?? "";
  if (declared && declared !== "utf-8" && declared !== "utf8") {
    try {
      return new TextDecoder(declared).decode(view);
    } catch {
      // Nezināms charset: turpina ar UTF-8 / cp1252.
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("windows-1252").decode(view);
  }
}
