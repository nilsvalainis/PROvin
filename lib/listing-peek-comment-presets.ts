/**
 * Ātrie vērtējumi — sagataves klientam. Operatora frāzes: īss vērtējums,
 * vieta PROVIN AUDITS. Bez panikas un bez remonta EUR.
 * Vienā sadaļā drīkst atlasīt vairākas frāzes (secīgi, punkts + atstarpe).
 */

export const LISTING_PEEK_COMMENT_GREETING = "Sveiki!";

export const LISTING_PEEK_COMMENT_CLOSER =
  "Šis ir virspusējs sākotnējais vērtējums. Pilnu spēkrata analīzi ar nobraukuma hronoloģiju, negadījumu datiem, dīleru vēsturi un specifisko tehnisko risku analīzi nodrošina PROVIN AUDITS, kas ir drošākais veids, kā pilnvērtīgi noskaidrot digitālo auto vēsturi un var ļaut izvairīties no dārgiem remontiem un iegūt argumentus cenas apspriešanai.";

export type ListingPeekTopicId =
  | "odometer"
  | "incidents"
  | "technical"
  | "seller"
  | "photos"
  | "dealer";

export type ListingPeekTone = "positive" | "caution" | "concern" | "critical" | "info";

export type ListingPeekPhrase = {
  id: string;
  tone: ListingPeekTone;
  label: string;
  text: string;
};

export type ListingPeekTopic = {
  id: ListingPeekTopicId;
  title: string;
  phrases: readonly ListingPeekPhrase[];
};

export const LISTING_PEEK_TOPICS: readonly ListingPeekTopic[] = [
  {
    id: "odometer",
    title: "Nobraukums",
    phrases: [
      {
        id: "odometer-labs",
        tone: "positive",
        label: "Labs",
        text: "Sākotnējie dati norāda uz augstu odometra rādījumu ticamību, tomēr pilnīgai pārliecībai nobraukuma hronoloģija ir jāsalīdzina ar starptautiskajiem un dīleru reģistriem.",
      },
      {
        id: "odometer-japeta",
        tone: "caution",
        label: "Jāpēta",
        text: "Odometra rādījuma atbilstību šobrīd nav iespējams pilnvērtīgi apstiprināt, tāpēc pilnīgai pārliecībai nobraukuma hronoloģija ir jāsalīdzina ar starptautiskajiem un dīleru reģistriem.",
      },
      {
        id: "odometer-ncsdd",
        tone: "caution",
        label: "Nav CSDD",
        text: "Tā kā automašīnai vēl nav veikta agregātu numuru salīdzināšana Latvijā, CSDD sistēmā ārvalstu tehniskajās apskatēs fiksētie odometra rādījumi šobrīd nav pieejami. Tie uzrādīsies tikai pēc numuru salīdzināšanas. Ja pārdevējs nav gatavs veikt numuru salīdzināšanu šo datu iegūšanai - pilnīgai pārliecībai nobraukuma hronoloģija ir jāsalīdzina ar starptautiskajiem un dīleru reģistriem.",
      },
      {
        id: "odometer-kritisks",
        tone: "critical",
        label: "Kritisks",
        text: "Pieejamie dati norāda uz iespējamu odometra rādījumu manipulāciju un prasa detalizētu nobraukuma analīzi datubāzēs.",
      },
      {
        id: "odometer-ierobezoti",
        tone: "concern",
        label: "Ierobežoti dati",
        text: "Šajā gadījumā pilnvērtīgu nobraukuma hronoloģiju no publiskajiem ārvalstu reģistriem iegūt var būt sarežģīti.",
      },
      {
        id: "odometer-tehniska-pase",
        tone: "info",
        label: "Tehniskā pase",
        text: "Konkrētajai automašīnai datus no ārvalstu reģistriem iegūt var būt sarežģīti, tāpēc papildu vēstures datu iegūšanai ir nepieciešams pārdevējam palūgt atsūtīt ārvalsts reģistrācijas apliecības (tehniskās pases) foto, kurā redzama reģistrācijas valsts numurzīme.",
      },
      {
        id: "odometer-dilera-dati",
        tone: "info",
        label: "Dīlera dati",
        text: "Izšķirošu lomu nobraukuma hronoloģijas, reālā nobraukuma un servisa intervālu pārbaudē šeit var nospēlēt oficiālā dīlera datubāze, kurā fiksētie servisa apmeklējumi var ļaut precīzi restaurēt auto lietošanas vēsturi.",
      },
    ],
  },
  {
    id: "incidents",
    title: "Negadījumi",
    phrases: [
      {
        id: "incidents-nav-redzams",
        tone: "positive",
        label: "Nav redzams",
        text: "Papildus tam atskaites ļaus mums pārbaudīt arī iespējamo negadījumu vēsturi, kurā šobrīd sākotnējās bojājumu pazīmes nav fiksētas.",
      },
      {
        id: "incidents-japeta",
        tone: "caution",
        label: "Jāpēta",
        text: "Tāpat caur šiem avotiem ir nepieciešams padziļināti pārbaudīt automašīnas negadījumu vēsturi, lai izslēgtu slēptos bojājumus un remontus.",
      },
      {
        id: "incidents-pazimes",
        tone: "concern",
        label: "Pazīmes",
        text: "Vienlaikus pieejamā informācija liecina par iespējamu dalību negadījumā, tāpēc ir būtiski noskaidrot fiksēto bojājumu raksturu un aprēķināto zaudējumu apmēru.",
      },
      {
        id: "incidents-butiski",
        tone: "critical",
        label: "Būtiski bojājumi",
        text: "Vienlaikus pieejamie dati norāda uz nopietnu negadījumu spēkrata vēsturē, tāpēc obligāti jāpārbauda remonta apjoms un skartie mezgli.",
      },
      {
        id: "incidents-octa",
        tone: "info",
        label: "OCTA",
        text: "Jāņem vērā, ka Latvijas OCTA datubāzē atlīdzību pieteikumi nav fiksēti, taču KASKO un ārvalstu negadījumu datus ir iespējams pārbaudīt, tikai veicot padziļinātu atskaites pieprasījumu.",
      },
    ],
  },
  {
    id: "technical",
    title: "Tehnika",
    phrases: [
      {
        id: "technical-merens",
        tone: "positive",
        label: "Mērens",
        text: "Konceptuāli uzticams auto, tomēr ir nianses, kuras noteikti būs jāņem vērā gan apskatē klātienē, gan turpmākās ekspluatācijas laikā.",
      },
      {
        id: "technical-nianses",
        tone: "caution",
        label: "Nianses",
        text: "Tehniski, šim modelim ir raksturīgas specifiskas nianses, kas prasa pastiprinātu uzmanību gan klātienes pārbaudē, gan turpmākās ekspluatācijas laikā.",
      },
      {
        id: "technical-jaskata",
        tone: "concern",
        label: "Jāskata",
        text: "Tehniski automašīna ir aprīkota ar mezgliem, pret kuriem jāizturas ar īpašu piesardzību gan diagnostikā, gan turpmākajā lietošanā.",
      },
      {
        id: "technical-problematisks",
        tone: "critical",
        label: "Problemātisks",
        text: "Analizējot tehnisko pusi, konkrētajai modifikācijai un dzinējam ir raksturīgi specifiski riski, ko pirms pirkuma svarīgi savlaicīgi diagnosticēt, lai izvairītos no neparedzētiem ieguldījumiem.",
      },
    ],
  },
  {
    id: "seller",
    title: "Pārdevējs",
    phrases: [
      {
        id: "seller-labs",
        tone: "positive",
        label: "Labs",
        text: "Attiecībā uz pārdevēju - tam ir salīdzinoši laba reputācija un caurspīdīgs profils, kas ir pozitīvs rādītājs, tomēr tas pilnībā neatbrīvo no paša auto un vēstures pārbaudes.",
      },
      {
        id: "seller-neitrals",
        tone: "caution",
        label: "Neitrāls",
        text: "Savukārt publiski pieejamā informācija par pārdevēju ir ierobežota, tāpēc riski jāvērtē kopsakarā ar paša spēkrata faktisko stāvokli un dokumentāciju.",
      },
      {
        id: "seller-jautajumi",
        tone: "concern",
        label: "Jautājumi",
        text: "Uzmanību pievērš arī pārdevēja darbības stils, kas rada papildu jautājumus.",
      },
      {
        id: "seller-risks",
        tone: "critical",
        label: "Paaugstināts risks",
        text: "Pieejamā informācija par automašīnas pārdevēju arī prasa ievērot piesardzību.",
      },
    ],
  },
  {
    id: "photos",
    title: "Bildes",
    phrases: [
      {
        id: "photos-tiras",
        tone: "positive",
        label: "Tīras",
        text: "Virspusēji izvērtējot sludinājuma fotogrāfijas, būtiski vizuālie defekti netika novēroti.",
      },
      {
        id: "photos-lietosanas",
        tone: "positive",
        label: "Lietošanas pazīmes",
        text: "Redzamas tikai deklarētajam vecumam un nobraukumam atbilstošas lietošanas pazīmes.",
      },
      {
        id: "photos-maz",
        tone: "caution",
        label: "Maz",
        text: "Virspusēji izvērtējot sludinājuma fotogrāfijas, tika konstatēts, ka ar pievienotajiem attēliem pilnvērtīgu virsbūves un salona vizuālo analīzi veikt nav iespējams.",
      },
      {
        id: "photos-nianses",
        tone: "concern",
        label: "Nianses",
        text: "Virspusēji izvērtējot sludinājuma fotogrāfijas, attēlos tika pamanītas atsevišķas zonas, kuras klātienē būs jāpārbauda īpaši uzmanīgi.",
      },
      {
        id: "photos-lenki",
        tone: "info",
        label: "Leņķi",
        text: "Jāņem vērā, ka dažādu atspīdumu un leņķu dēļ pilnvērtīgu foto analīzi veikt nav iespējams.",
      },
    ],
  },
  {
    id: "dealer",
    title: "Oficiālā dīlera dati",
    phrases: [
      {
        id: "dealer-ir",
        tone: "positive",
        label: "Ir",
        text: "Pie nosacījuma, ka šis auto ir ticis apkopts pie oficiālā dīlera, bieži ir iegūstami detalizēti ieraksti no oficiālā dīlera datubāzēm par veiktajām apkopēm un remontiem.",
      },
      {
        id: "dealer-svarigi",
        tone: "caution",
        label: "Svarīgi dati",
        text: "Datu iegūšana no oficiālā dīlera šeit var nospēlēt izšķirošu lomu, īpaši apkopju intervālu pētīšanā.",
      },
      {
        id: "dealer-nezinams",
        tone: "concern",
        label: "Nezināms",
        text: "Prognozēt datu pieejamību oficiālā dīlera datubāzēs ir sarežģīti.",
      },
      {
        id: "dealer-nav",
        tone: "critical",
        label: "Nav",
        text: "Šim auto iegūt digitāli fiksētus starptautiskos datus no oficiālā dīlera datubāzes parasti nav iespējams.",
      },
    ],
  },
] as const;

export const LISTING_PEEK_TOPIC_IDS = LISTING_PEEK_TOPICS.map((t) => t.id);

export function listingPeekPhraseByTone(
  topicId: ListingPeekTopicId,
  tone: ListingPeekTone,
): string {
  const topic = LISTING_PEEK_TOPICS.find((t) => t.id === topicId);
  return topic?.phrases.find((p) => p.tone === tone)?.text ?? "";
}

export function listingPeekPhraseById(phraseId: string): string {
  for (const topic of LISTING_PEEK_TOPICS) {
    const hit = topic.phrases.find((p) => p.id === phraseId);
    if (hit) return hit.text;
  }
  return "";
}

/** Frāzes, kas jau ir ielikti sadaļas tekstā (vairāku izvēle). */
export function listingPeekSelectedPhraseIds(topicId: ListingPeekTopicId, fieldText: string): string[] {
  const topic = LISTING_PEEK_TOPICS.find((t) => t.id === topicId);
  if (!topic || !fieldText.trim()) return [];
  return topic.phrases.filter((p) => fieldText.includes(p.text)).map((p) => p.id);
}

/** Klienta e-pasts ir parasts teksts — Gemini citādi atstāj field-agent `**bold**`. */
export function stripListingPeekMarkdown(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<![\w*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

/** Sagatave turpina iepriekšējo tekstu tajā pašā rindkopā: punkts + viena atstarpe. */
export function joinListingPeekSentences(existing: string, add: string): string {
  const next = add.replace(/\r/g, "").trim();
  const current = existing.replace(/\r/g, "").replace(/[ \t]+$/gm, "").replace(/\n+$/, "").trimEnd();
  if (!next) return current.trim();
  if (!current.trim()) return next;
  if (current.includes(next)) return current.trim();
  const left = current.trim();
  if (/[.!?…]$/.test(left)) return `${left} ${next}`;
  return `${left}. ${next}`;
}

/** Noņem vienu sagataves frāzi no sadaļas teksta (toggle off). */
export function removeListingPeekSentence(existing: string, remove: string): string {
  const drop = remove.replace(/\r/g, "").trim();
  if (!drop) return existing.replace(/\r/g, "").trim();
  let t = existing.replace(/\r/g, "");
  if (!t.includes(drop)) return t.trim();
  t = t.replace(drop, " ");
  t = t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?…])/g, "$1")
    .replace(/([.!?…])\s*\1+/g, "$1")
    .replace(/\.\s*\./g, ".")
    .trim();
  return t;
}

/** Pievieno frāzi, ja nav; noņem, ja jau ir. */
export function toggleListingPeekSentence(existing: string, phrase: string): string {
  const text = phrase.replace(/\r/g, "").trim();
  if (!text) return existing.replace(/\r/g, "").trim();
  if (existing.includes(text)) return removeListingPeekSentence(existing, text);
  return joinListingPeekSentences(existing, text);
}

export function assembleListingPeekCustomerComment(input: {
  greeting?: boolean;
  closer?: boolean;
  lines: Partial<Record<ListingPeekTopicId, string>>;
}): string {
  const points = LISTING_PEEK_TOPIC_IDS.map((id) => input.lines[id]?.trim() ?? "").filter(Boolean);
  let body = input.greeting !== false ? LISTING_PEEK_COMMENT_GREETING : "";
  for (const text of points) {
    body = joinListingPeekSentences(body, text);
  }
  const blocks: string[] = [];
  if (body) blocks.push(body);
  if (input.closer) blocks.push(LISTING_PEEK_COMMENT_CLOSER);
  return blocks.join("\n\n").trim();
}

/** Ieliek teikumu vēstulē pirms AUDITS closer — tajā pašā rindkopā caur punktu un atstarpi. */
export function insertListingPeekLetterSentence(letter: string, sentence: string): string {
  const add = sentence.trim();
  const current = letter.replace(/\r/g, "").trim();
  if (!add) return current;
  if (current.includes(add)) return current;
  if (current.includes(LISTING_PEEK_COMMENT_CLOSER)) {
    const before = current.slice(0, current.indexOf(LISTING_PEEK_COMMENT_CLOSER)).trim();
    const joined = joinListingPeekSentences(before, add);
    return `${joined}\n\n${LISTING_PEEK_COMMENT_CLOSER}`.trim();
  }
  return joinListingPeekSentences(current, add);
}

export function applyListingPeekLetterCloser(letter: string, closer: boolean): string {
  const current = letter.replace(/\r/g, "").trim();
  const has = current.includes(LISTING_PEEK_COMMENT_CLOSER);
  if (closer && !has) {
    return current ? `${current}\n\n${LISTING_PEEK_COMMENT_CLOSER}` : LISTING_PEEK_COMMENT_CLOSER;
  }
  if (!closer && has) {
    return current.replace(LISTING_PEEK_COMMENT_CLOSER, "").trim();
  }
  return current;
}

const emptyPeekLines = (): Record<ListingPeekTopicId, string> => ({
  odometer: "",
  incidents: "",
  technical: "",
  seller: "",
  photos: "",
  dealer: "",
});

/** Atver jau nosūtīto vēstuli atpakaļ tēmu laukos, lai var papildināt. */
export function parseListingPeekCustomerComment(raw: string): {
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
} {
  const lines = emptyPeekLines();
  const t = raw.replace(/\r/g, "").trim();
  if (!t) return { closer: false, lines };

  const closer = t.includes(LISTING_PEEK_COMMENT_CLOSER);
  const withoutCloser = closer ? t.replace(LISTING_PEEK_COMMENT_CLOSER, "").trim() : t;
  const numbered = [...withoutCloser.matchAll(/^\s*\d+\.\s+(.+?)\s*$/gm)].map((m) => (m[1] ?? "").trim());

  const unused = new Set(LISTING_PEEK_TOPIC_IDS);
  for (const text of numbered) {
    const hit = LISTING_PEEK_TOPICS.find(
      (topic) => unused.has(topic.id) && topic.phrases.some((p) => p.text === text || text.includes(p.text)),
    );
    if (hit) {
      lines[hit.id] = text;
      unused.delete(hit.id);
    }
  }
  for (const text of numbered) {
    if (LISTING_PEEK_TOPIC_IDS.some((id) => lines[id] === text)) continue;
    const nextId = LISTING_PEEK_TOPIC_IDS.find((id) => unused.has(id));
    if (!nextId) break;
    lines[nextId] = text;
    unused.delete(nextId);
  }

  if (numbered.length === 0) {
    const leftover = withoutCloser
      .replace(new RegExp(`^${LISTING_PEEK_COMMENT_GREETING}\\s*`, "i"), "")
      .trim();
    for (const topic of LISTING_PEEK_TOPICS) {
      if (!unused.has(topic.id)) continue;
      const hits = topic.phrases.filter((p) => leftover.includes(p.text)).map((p) => p.text);
      if (hits.length > 0) {
        lines[topic.id] = hits.join(" ");
        // Re-join properly with periods
        lines[topic.id] = hits.reduce((acc, phrase) => joinListingPeekSentences(acc, phrase), "");
        unused.delete(topic.id);
      }
    }
    if (!LISTING_PEEK_TOPIC_IDS.some((id) => lines[id]) && leftover) {
      lines.odometer = leftover;
    }
  }

  return { closer, lines };
}

function coerceJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return null;
  const t = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const p: unknown = JSON.parse(s);
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return tryParse(t) ?? (() => {
    const m = t.match(/\{[\s\S]*\}/);
    return m ? tryParse(m[0]) : null;
  })();
}

/** Flash / Gemini izejas JSON → tēmu lauki + pilnā vēstule. */
export function parseListingPeekAiPayload(raw: unknown): {
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
  letter?: string;
} | null {
  const obj = coerceJsonObject(raw);
  if (!obj) return null;
  const lines = emptyPeekLines();
  let any = false;
  for (const id of LISTING_PEEK_TOPIC_IDS) {
    const v = obj[id];
    if (typeof v === "string" && v.trim()) {
      lines[id] = stripListingPeekMarkdown(v.trim()).slice(0, 1200);
      any = true;
    }
  }
  const letterRaw =
    (typeof obj.letter === "string" && obj.letter.trim()) ||
    (typeof obj.text === "string" && obj.text.trim()) ||
    "";
  const letter = letterRaw ? stripListingPeekMarkdown(letterRaw) : "";
  if (!any && !letter && !("closer" in obj)) return null;
  return {
    closer: obj.closer === true || obj.closer === "true" || letter.includes(LISTING_PEEK_COMMENT_CLOSER),
    lines,
    ...(letter ? { letter } : {}),
  };
}
