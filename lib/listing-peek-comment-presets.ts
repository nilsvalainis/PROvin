/**
 * Ātrie vērtējumi — sagataves klientam. Operatora frāzes: īss vērtējums,
 * vieta PROVIN AUDITS. Bez panikas un bez remonta EUR.
 */

export const LISTING_PEEK_COMMENT_GREETING = "Sveiki!";

export const LISTING_PEEK_COMMENT_CLOSER =
  "Šis ir virspusējs vērtējums bez detalizētas nobraukuma, negadījumu vēstures un tehnisko risku analīzes. Pilnu pārbaudi nodrošina PROVIN AUDITS.";

export type ListingPeekTopicId = "odometer" | "incidents" | "technical" | "seller" | "photos";

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
        text: "Ticamība odometra rādījumiem pēc esošajiem datiem ir diezgan augsta, tomēr padziļināta pārbaude papildu avotos ir vēlama jebkurā gadījumā. Vienlaikus tas ļaus mums iegūt datus arī par iespējamo negadījumu vēsturi un oficiāli pieteiktajām zaudējumu atlīdzībām.",
      },
      {
        id: "odometer-japeta",
        tone: "caution",
        label: "Jāpēta",
        text: "Odometra rādījumu ticamību nav iespējams pilnvērtīgi izvērtēt bez padziļinātas pārbaudes. Vienlaikus tā ļaus mums iegūt datus arī par iespējamo negadījumu vēsturi un oficiāli pieteiktajām zaudējumu atlīdzībām.",
      },
      {
        id: "odometer-neskaidrs",
        tone: "concern",
        label: "Neskaidrs",
        text: "Pieejamie dati nevar garantēt nobraukuma atbilstību, tāpēc padziļināta pārbaude maksas datubāzēs vērtējama kā obligāta. Vienlaikus tā ļaus mums iegūt datus arī par iespējamo negadījumu vēsturi un oficiāli pieteiktajām zaudējumu atlīdzībām.",
      },
      {
        id: "odometer-kritisks",
        tone: "critical",
        label: "Kritisks",
        text: "Dati norāda uz iespējamu odometra rādījumu manipulāciju vai būtiskām nesakritībām vēsturē. Nepieciešama detalizēta analīze. Vienlaikus tā ļaus mums iegūt datus arī par iespējamo negadījumu vēsturi un oficiāli pieteiktajām zaudējumu atlīdzībām.",
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
        text: "Negadījumu pazīmes netika konstatētas, taču to var apstiprināt, tikai veicot padziļinātu pārbaudi dažādās datubāzēs.",
      },
      {
        id: "incidents-japeta",
        tone: "caution",
        label: "Jāpēta",
        text: "Negadījumu vēsture padziļināti jāpēta maksas datubāzēs.",
      },
      {
        id: "incidents-pazimes",
        tone: "concern",
        label: "Pazīmes",
        text: "Sākotnējie dati liecina par iespējamu dalību negadījumā; negadījumu raksturs un sekas jāanalizē padziļināti.",
      },
      {
        id: "incidents-butiski",
        tone: "critical",
        label: "Būtiski bojājumi",
        text: "Pieejamā informācija liecina par nopietnu negadījumu vēsturē. Nepieciešams noskaidrot remonta kvalitāti un skartos mezglus.",
      },
      {
        id: "incidents-octa",
        tone: "info",
        label: "OCTA",
        text: "OCTA atlīdzību pieteikumi Latvijā nav fiksēti (KASKO un ārvalstīs fiksētajiem negadījumu datiem bez padziļinātas pārbaudes piekļūt nav iespējams).",
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
        text: "Tehniski šim modelim ir nianses, kuras noteikti būs jāņem vērā gan apskatē klātienē, gan turpmākās ekspluatācijas laikā.",
      },
      {
        id: "technical-jaskata",
        tone: "concern",
        label: "Jāskata",
        text: "Šim modelim ir agregāti, pret kuriem jāizturas ar īpašu piesardzību. Svarīga būs ne tikai auto vēstures izpēte, bet arī rūpīga pārbaude klātienē un pareiza turpmākā ekspluatācija auto iegādes gadījumā.",
      },
      {
        id: "technical-problematisks",
        tone: "critical",
        label: "Problemātisks",
        text: "Nopietni izskatot šādu auto, jārēķinās ar zināmiem riskiem, jo konkrētajam modelim ir raksturīgas dārgi novēršamas problēmas. Rūpīga diagnostika un datu pārbaude ir obligāta.",
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
        text: "Pārdevējs ar salīdzinoši labu reputāciju un caurspīdīgu profilu, tomēr tas šajā sfērā neko negarantē un pilnībā neatbrīvo no paša auto pārbaudes.",
      },
      {
        id: "seller-neitrals",
        tone: "caution",
        label: "Neitrāls",
        text: "Informācija par pārdevēju ir ierobežota, tāpēc riski jāvērtē kopsakarā ar konkrētā auto vēsturi.",
      },
      {
        id: "seller-jautajumi",
        tone: "concern",
        label: "Jautājumi",
        text: "Pārdevēja reputācija un darbības stils rada jautājumus, tāpēc auto stāvoklis un vēsture jāvērtē piesardzīgi.",
      },
      {
        id: "seller-risks",
        tone: "critical",
        label: "Paaugstināts risks",
        text: "Pārdevējs, iespējams, ir ar paaugstināta riska profilu, tāpēc auto stāvoklis un vēsture jāvērtē īpaši piesardzīgi.",
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
        text: "Virspusēji apskatot sludinājuma fotogrāfijas, būtiski vizuāli trūkumi netika konstatēti — novērojamas tikai deklarētajam nobraukumam un vecumam atbilstošas lietošanas pazīmes.",
      },
      {
        id: "photos-maz",
        tone: "caution",
        label: "Maz",
        text: "Pēc sludinājumā pievienotajām fotogrāfijām pilnvērtīgu vizuālo analīzi veikt nebija iespējams.",
      },
      {
        id: "photos-tuvplani",
        tone: "concern",
        label: "Tuvplāni",
        text: "Sludinājuma attēlos tika konstatētas vietas, kuras noteikti būs padziļināti jāvērtē klātienē.",
      },
      {
        id: "photos-aizdomigas",
        tone: "critical",
        label: "Aizdomīgas",
        text: "Sludinājuma attēli, iespējams, ir uzņemti tā, lai apzināti slēptu defektus (rakursi, kvalitāte utt.).",
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

export function assembleListingPeekCustomerComment(input: {
  greeting?: boolean;
  closer?: boolean;
  lines: Partial<Record<ListingPeekTopicId, string>>;
}): string {
  const points = LISTING_PEEK_TOPIC_IDS.map((id) => input.lines[id]?.trim() ?? "").filter(Boolean);
  const blocks: string[] = [];
  if (input.greeting !== false) blocks.push(LISTING_PEEK_COMMENT_GREETING);
  if (points.length) {
    blocks.push(points.map((text, i) => `${i + 1}. ${text}`).join("\n"));
  }
  if (input.closer) blocks.push(LISTING_PEEK_COMMENT_CLOSER);
  return blocks.join("\n\n").trim();
}

/** Ieliek teikumu vēstulē pirms AUDITS closer — sagatave + operatora papildinājumi. */
export function insertListingPeekLetterSentence(letter: string, sentence: string): string {
  const add = sentence.trim();
  const current = letter.replace(/\r/g, "").trim();
  if (!add) return current;
  if (current.includes(add)) return current;
  if (current.includes(LISTING_PEEK_COMMENT_CLOSER)) {
    return current.replace(LISTING_PEEK_COMMENT_CLOSER, `${add}\n\n${LISTING_PEEK_COMMENT_CLOSER}`).trim();
  }
  return current ? `${current}\n\n${add}` : add;
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
});

/** Atver jau nosūtīto vēstuli atpakaļ piecu tēmu laukos, lai var papildināt. */
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
      (topic) => unused.has(topic.id) && topic.phrases.some((p) => p.text === text),
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
    if (leftover) lines.odometer = leftover;
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

/** Flash / Gemini izejas JSON → piecu tēmu lauki + pilnā vēstule. */
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
      lines[id] = stripListingPeekMarkdown(v.trim()).slice(0, 700);
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
