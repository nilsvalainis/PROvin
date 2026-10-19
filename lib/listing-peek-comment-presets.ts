/**
 * Ātrie vērtējumi - sagataves klientam. Operatora frāzes: īss vērtējums,
 * vieta PROVIN AUDITS. Bez panikas un bez remonta EUR.
 * Vienā sadaļā drīkst atlasīt vairākas frāzes (secīgi, punkts + atstarpe).
 */

/** Mantots parsēšanai vecām vēstulēm; jaunajos melnrakstos netiek pievienots (e-pasta šablons jau sākas ar Labdien!). */
export const LISTING_PEEK_COMMENT_GREETING = "Sveiki!";

const LEADING_PEEK_GREETING_RE =
  /^(?:Labdien|Sveiki)(?:\s*[!,]|\s+)(?:\s*[!,])?\s*/i;

/** Noņem uzrunu no komentāra, ja e-pasta/WA šablons jau sākas ar Labdien/Sveiki. */
export function stripListingPeekCommentLeadingGreeting(text: string): string {
  let t = text.replace(/\r/g, "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    const withoutLegacy = t.replace(new RegExp(`^${LISTING_PEEK_COMMENT_GREETING}\\s*`, "i"), "").trimStart();
    if (withoutLegacy !== t) {
      t = withoutLegacy;
      changed = true;
    }
    const withoutGeneric = t.replace(LEADING_PEEK_GREETING_RE, "").trimStart();
    if (withoutGeneric !== t) {
      t = withoutGeneric;
      changed = true;
    }
    const withoutBlank = t.replace(/^\n+/, "").trimStart();
    if (withoutBlank !== t) {
      t = withoutBlank;
      changed = true;
    }
  }
  return t.trim();
}

export const LISTING_PEEK_COMMENT_CLOSER =
  "Šis ir sākotnējs, virspusējs vērtējums. PROVIN AUDITS dod pilnu ainu: nobraukuma hronoloģiju, negadījumu datus, dīleru vēsturi un šī modeļa tehniskos riskus. Tas palīdz pieņemt pārdomātu lēmumu un iegūt argumentus cenas sarunām.";

/** Veco nosūtīto vēstuļu closer - tikai parsēšanai, jaunos melnrakstos neliek. */
const LISTING_PEEK_COMMENT_CLOSER_LEGACY =
  "Šis ir virspusējs sākotnējais vērtējums. Pilnu auto analīzi ar nobraukuma hronoloģiju, negadījumu datiem, dīleru vēsturi un specifisko tehnisko risku analīzi nodrošina PROVIN AUDITS. Tas ir drošākais veids, kā pilnvērtīgi noskaidrot digitālo auto vēsturi, izvairīties no dārgiem remontiem un iegūt argumentus cenas apspriešanai.";

function listingPeekCloserInText(text: string): { index: number; closer: string } | null {
  const current = text.indexOf(LISTING_PEEK_COMMENT_CLOSER);
  if (current >= 0) return { index: current, closer: LISTING_PEEK_COMMENT_CLOSER };
  const legacy = text.indexOf(LISTING_PEEK_COMMENT_CLOSER_LEGACY);
  if (legacy >= 0) return { index: legacy, closer: LISTING_PEEK_COMMENT_CLOSER_LEGACY };
  return null;
}

export type ListingPeekTopicId =
  | "odometer"
  | "incidents"
  | "technical"
  | "seller"
  | "photos"
  | "dealer"
  | "recommendation";

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
        text: "Latvijā šim auto vēl nav veikta agregātu numuru salīdzināšana, tāpēc CSDD sistēmā pagaidām nav redzami nobraukuma rādījumi no ārvalstu tehniskajām apskatēm (tie glabājas Eiropas EUCARIS datubāzē). Tie parādīsies pēc numuru salīdzināšanas, un citos avotos tie nav pieejami. Ja pārdevējs nav gatavs numurus salīdzināt pirms auto iegādes, pārbaude starptautiskajos reģistros var būt vienīgais veids, kā pārliecināties par nobraukuma patiesumu.",
      },
      {
        id: "odometer-kritisks",
        tone: "critical",
        label: "Kritisks",
        text: "Pieejamie dati liecina par iespējamām nobraukuma pretrunām auto vēsturē, taču droši to var apstiprināt tikai ar padziļinātu pārbaudi.",
      },
      {
        id: "odometer-ierobezoti",
        tone: "concern",
        label: "Ierobežoti dati",
        text: "Jāņem vērā, ka šim auto pilnu nobraukuma hronoloģiju no publiskajiem ārvalstu reģistriem iegūt var būt grūti: izcelsmes valsts un auto vecums var neļaut iegūt pietiekami daudz informācijas, lai izsekotu visam nobraukumam.",
      },
      {
        id: "odometer-tehniska-pase",
        tone: "info",
        label: "Tehniskā pase",
        text: "Šim auto datus no ārvalstu reģistriem iegūt var būt grūti. Pirms pasūtījuma palūdziet pārdevējam ārvalsts reģistrācijas apliecības (tehniskās pases) foto, kurā redzams reģistrācijas numurs. Tas var palīdzēt iegūt vairāk vēstures datu.",
      },
      {
        id: "odometer-dilera-dati",
        tone: "info",
        label: "Dīlera dati",
        text: "Oficiālā dīlera datubāzē fiksētie servisa apmeklējumi bieži ļauj precīzi atjaunot nobraukuma hronoloģiju, reālo nobraukumu un servisa intervālus.",
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
        text: "Sākotnēji bojājumu pazīmes negadījumu vēsturē nav redzamas.",
      },
      {
        id: "incidents-japeta",
        tone: "caution",
        label: "Jāpēta",
        text: "Automašīnas negadījumu vēsturi nepieciešams padziļināti pārbaudīt, lai izslēgtu slēptos bojājumus un remontus.",
      },
      {
        id: "incidents-pazimes",
        tone: "concern",
        label: "Pazīmes",
        text: "Pieejamā informācija liecina par iespējamu dalību negadījumā, tāpēc būtiski noskaidrot fiksēto bojājumu raksturu un aprēķināto zaudējumu apmēru.",
      },
      {
        id: "incidents-butiski",
        tone: "critical",
        label: "Būtiski bojājumi",
        text: "Pieejamie dati norāda uz nopietnu negadījumu automašīnas vēsturē, tāpēc ir vērts pārbaudīt remonta apjomu un skartos mezglus.",
      },
      {
        id: "incidents-octa",
        tone: "info",
        label: "OCTA",
        text: "Jāņem vērā, ka Latvijas OCTA datubāzē atlīdzību pieteikumi nav fiksēti, taču KASKO un ārvalstu negadījumu datus atklāj tikai padziļināta pārbaude.",
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
        text: "Konceptuāli šis modelis ir uzticams, taču daudz ko noteiks konkrētā auto stāvoklis, vēsture un objektīvs novērtējums klātienē, jo, kā jau visiem auto, arī šim ir savas vājās vietas.",
      },
      {
        id: "technical-nianses",
        tone: "caution",
        label: "Nianses",
        text: "Šim modelim ir zināmas nianses, kurām jāpievērš uzmanība gan apskatot auto klātienē, gan turpmākajā ekspluatācijā.",
      },
      {
        id: "technical-problematisks",
        tone: "critical",
        label: "Problemātisks",
        text: "Šim modelim ir zināmi riski, kas noteikti jāņem vērā gan pirms pirkuma, gan pēc tā.",
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
        text: "Pārdevējam ir salīdzinoši laba reputācija, tomēr tas pilnībā neatbrīvo no paša auto un vēstures pārbaudes.",
      },
      {
        id: "seller-neitrals",
        tone: "caution",
        label: "Neitrāls",
        text: "Publiski pieejamā informācija par pārdevēju ir ierobežota, tāpēc riski jāvērtē kopā ar paša auto faktisko stāvokli un dokumentāciju.",
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
        text: "Virspusēji pieejamā informācija par pārdevēju rada jautājumus, ko var izvērtēt tikai padziļinātā pārbaudē.",
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
        text: "Redzamas tikai deklarētajam vecumam un nobraukumam pieļaujamas lietošanas pazīmes.",
      },
      {
        id: "photos-maz",
        tone: "caution",
        label: "Maz",
        text: "Pievienotie sludinājuma attēli neļauj veikt pilnvērtīgu virsbūves un salona vizuālo analīzi.",
      },
      {
        id: "photos-nianses",
        tone: "concern",
        label: "Nianses",
        text: "Sludinājuma fotogrāfijās pamanītas atsevišķas zonas, kuras klātienē būs jāpārbauda īpaši uzmanīgi.",
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
        text: "Ja auto ir apkopts pie oficiālā dīlera, no tā datubāzes bieži var iegūt detalizētus ierakstus par veiktajām apkopēm un remontiem.",
      },
      {
        id: "dealer-svarigi",
        tone: "caution",
        label: "Svarīgi dati",
        text: "Oficiālā dīlera datubāzē fiksētie servisa apmeklējumi atsevišķos gadījumos var sniegt izšķirošu pienesumu auditam, precīzi atklājot nobraukuma hronoloģiju un apkopju intervālus.",
      },
      {
        id: "dealer-nezinams",
        tone: "concern",
        label: "Nezināms",
        text: "Prognozēt datu pieejamību oficiālā dīlera datubāzēs iepriekš nav iespējams, tāpēc to var pārbaudīt tikai nosūtot konkrētu pieprasījumu.",
      },
      {
        id: "dealer-tikls-nezinams",
        tone: "info",
        label: "Dīleris nezināms",
        text: "Mums ir pieeja starptautiskajam dīleru tīklam, taču konkrētajai automašīnai datu pieejamība tajā var būt ierobežota vai tās var nebūt vispār.",
      },
      {
        id: "dealer-izsoles-foto",
        tone: "info",
        label: "Izsoļu foto",
        text: "Šim konkrētajam auto mums varētu būt pieejamas vēsturiskās ārvalsts izsoļu portālu fotogrāfijas, kuras var ļaut redzēt sākotnējo stāvokli pirms ievešanas Latvijā.",
      },
    ],
  },
  {
    id: "recommendation",
    title: "Ieteikums",
    phrases: [
      {
        id: "recommendation-mini",
        tone: "positive",
        label: "MINI",
        text: "Šajā gadījumā ieteicams sākt ar PROVIN MINI - sludinājuma, pārdevēja un tehnisko risku analīze ar konsultāciju.",
      },
      {
        id: "recommendation-audits",
        tone: "caution",
        label: "AUDITS",
        text: "Pilnīgai pārbaudei ieteicams PROVIN AUDITS - CarVertical, AutoDNA, izcelsmes valsts reģistri un oficiālo dīleru un izsoļu portālu arhīvs.",
      },
      {
        id: "recommendation-dilera-dati",
        tone: "info",
        label: "Dīlera dati",
        text: "Šajā gadījumā ieteicams sākt ar DĪLERA DATIEM - oficiālā dīlera servisa un apkopju vēsture un odometra rādījumi. Ja dati nebūs pieejami, saņemsiet pilnu naudas atmaksu.",
      },
      {
        id: "recommendation-neiesakam",
        tone: "concern",
        label: "Neiesakām",
        text: "Pamatojoties uz šobrīd pieejamo informāciju, konkrētās automašīnas iegādi neiesakām. Ieteicams turpināt meklēšanu un apsvērt citus, drošākus piedāvājumus.",
      },
      {
        id: "recommendation-neiesakam-ar-turpinajumu",
        tone: "critical",
        label: "Neiesakām, bet var turpināt",
        text: "Pamatojoties uz šobrīd pieejamo informāciju, konkrētās automašīnas iegādi neiesakām. Ja tomēr vēlaties turpināt, ieteicams to darīt tikai ar pilnu skaidrību par potenciālajiem riskiem.",
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

/** Klienta e-pasts ir parasts teksts - Gemini citādi atstāj field-agent `**bold**`. */
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
  let body = input.greeting === true ? LISTING_PEEK_COMMENT_GREETING : "";
  for (const text of points) {
    body = joinListingPeekSentences(body, text);
  }
  const blocks: string[] = [];
  if (body) blocks.push(body);
  if (input.closer) blocks.push(LISTING_PEEK_COMMENT_CLOSER);
  return blocks.join("\n\n").trim();
}

/** Ieliek teikumu vēstulē pirms AUDITS closer - tajā pašā rindkopā caur punktu un atstarpi. */
export function insertListingPeekLetterSentence(letter: string, sentence: string): string {
  const add = sentence.trim();
  const current = letter.replace(/\r/g, "").trim();
  if (!add) return current;
  if (current.includes(add)) return current;
  const found = listingPeekCloserInText(current);
  if (found) {
    const before = current.slice(0, found.index).trim();
    const joined = joinListingPeekSentences(before, add);
    return `${joined}\n\n${found.closer}`.trim();
  }
  return joinListingPeekSentences(current, add);
}

export function applyListingPeekLetterCloser(letter: string, closer: boolean): string {
  const current = letter.replace(/\r/g, "").trim();
  const found = listingPeekCloserInText(current);
  if (closer && !found) {
    return current ? `${current}\n\n${LISTING_PEEK_COMMENT_CLOSER}` : LISTING_PEEK_COMMENT_CLOSER;
  }
  if (!closer && found) {
    return current.replace(found.closer, "").trim();
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
  recommendation: "",
});

/** Atver jau nosūtīto vēstuli atpakaļ tēmu laukos, lai var papildināt. */
export function parseListingPeekCustomerComment(raw: string): {
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
} {
  const lines = emptyPeekLines();
  const t = raw.replace(/\r/g, "").trim();
  if (!t) return { closer: false, lines };

  const foundCloser = listingPeekCloserInText(t);
  const closer = Boolean(foundCloser);
  const withoutCloser = foundCloser ? t.replace(foundCloser.closer, "").trim() : t;
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
    const leftover = stripListingPeekCommentLeadingGreeting(withoutCloser);
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
    closer: obj.closer === true || obj.closer === "true" || Boolean(listingPeekCloserInText(letter)),
    lines,
    ...(letter ? { letter } : {}),
  };
}
