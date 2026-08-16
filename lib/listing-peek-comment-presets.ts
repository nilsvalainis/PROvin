/**
 * Ātrie vērtējumi — sagataves klientam. Palīdz ar īsu sludinājuma komentāru
 * un atstāj vietu PROVIN AUDITS, bez panikas un bez solījumiem par maksas avotiem.
 */

export const LISTING_PEEK_COMMENT_GREETING = "Sveiki!";

export const LISTING_PEEK_COMMENT_CLOSER =
  "Šis ir virspusējs vērtējums bez detalizētas nobraukuma, negadījumu vēstures un tehnisko risku analīzes. Pilnu pārbaudi nodrošina PROVIN AUDITS.";

export type ListingPeekTopicId = "odometer" | "incidents" | "technical" | "seller" | "photos";

export type ListingPeekTone = "positive" | "caution" | "concern";

export type ListingPeekPhrase = {
  tone: ListingPeekTone;
  label: string;
  text: string;
};

export type ListingPeekTopic = {
  id: ListingPeekTopicId;
  title: string;
  phrases: readonly [ListingPeekPhrase, ListingPeekPhrase, ListingPeekPhrase];
};

export const LISTING_PEEK_TOPICS: readonly ListingPeekTopic[] = [
  {
    id: "odometer",
    title: "Nobraukums",
    phrases: [
      {
        tone: "positive",
        label: "Labs",
        text: "Pēc sākotnējo datu apstrādes odometra rādījumi izskatās ticami, tomēr bez padziļinātas izpētes to nevaram droši apgalvot.",
      },
      {
        tone: "caution",
        label: "Jāpēta",
        text: "Odometra rādījumu ticamību šajā gadījumā nav iespējams izvērtēt bez padziļinātas pārbaudes.",
      },
      {
        tone: "concern",
        label: "Neskaidrs",
        text: "Sludinājuma dati nesniedz skaidru priekšstatu par nobraukumu. Lai redzētu pilnu vēsturi, nepieciešama pārbaude maksas reģistros un pie dīlera.",
      },
    ],
  },
  {
    id: "incidents",
    title: "Negadījumi",
    phrases: [
      {
        tone: "positive",
        label: "Nav redzams",
        text: "Pēc sākotnējo datu apstrādes negadījuma pazīmes netika konstatētas, tomēr bez pārbaudes maksas datubāzēs to nevaram droši apgalvot.",
      },
      {
        tone: "caution",
        label: "Jāpēta",
        text: "Negadījumu vēsturi šajā gadījumā nav iespējams izvērtēt bez padziļinātas pārbaudes maksas reģistros.",
      },
      {
        tone: "concern",
        label: "Pazīmes",
        text: "Sākotnējie dati liecina par iespējamu dalību negadījumā. Lai to apstiprinātu vai izslēgtu, nepieciešama padziļināta pārbaude.",
      },
    ],
  },
  {
    id: "technical",
    title: "Tehnika",
    phrases: [
      {
        tone: "positive",
        label: "Mērens",
        text: "Pēc sākotnējo datu apstrādes tehniskie riski izskatās mēreni, tomēr ir nianses, kuras noteikti būs jāņem vērā, apskatot auto klātienē.",
      },
      {
        tone: "caution",
        label: "Nianses",
        text: "Tehniskās nianses šajā gadījumā nav iespējams pilnībā izvērtēt bez klātienes pārbaudes.",
      },
      {
        tone: "concern",
        label: "Jāskata",
        text: "Šajā auto ir agregāti, no kuriem ieteicams izvairīties vai pret kuriem jāizturas ar īpašu piesardzību.",
      },
    ],
  },
  {
    id: "seller",
    title: "Pārdevējs",
    phrases: [
      {
        tone: "positive",
        label: "Labs",
        text: "Pēc sākotnējo datu apstrādes pārdevēja profils izskatās labs, tomēr bez vēstures pārbaudes nevaram droši apgalvot, ka sludinājums pilnībā atbilst datiem.",
      },
      {
        tone: "caution",
        label: "Neitrāls",
        text: "Pārdevēja profilu šajā gadījumā nav iespējams izvērtēt bez padziļinātas pārbaudes — izšķiroši būs tas, vai sludinājums saskan ar auto vēsturi.",
      },
      {
        tone: "concern",
        label: "Jautājumi",
        text: "Sākotnējie dati par pārdevēju rada jautājumus. Lai gūtu skaidrību, nepieciešama pārbaude kopsakarā ar auto vēsturi.",
      },
    ],
  },
  {
    id: "photos",
    title: "Bildes",
    phrases: [
      {
        tone: "positive",
        label: "Tīras",
        text: "Virspusēji apskatot, bildēs būtiski trūkumi netika konstatēti.",
      },
      {
        tone: "caution",
        label: "Maz",
        text: "Pēc sludinājumā pieejamajām bildēm pilnvērtīgu vizuālo analīzi veikt nebija iespējams.",
      },
      {
        tone: "concern",
        label: "Tuvplāni",
        text: "Sludinājuma bildēs tika pamanītas vietas, kuras noteikti būs padziļināti jāvērtē klātienē.",
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
      lines[id] = v.trim().slice(0, 400);
      any = true;
    }
  }
  const letterRaw =
    (typeof obj.letter === "string" && obj.letter.trim()) ||
    (typeof obj.text === "string" && obj.text.trim()) ||
    "";
  if (!any && !letterRaw && !("closer" in obj)) return null;
  return {
    closer: obj.closer === true || obj.closer === "true" || letterRaw.includes(LISTING_PEEK_COMMENT_CLOSER),
    lines,
    ...(letterRaw ? { letter: letterRaw } : {}),
  };
}
