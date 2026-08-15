/**
 * Ātrie vērtējumi — sagataves klientam. Palīdz ar īsu sludinājuma komentāru
 * un atstāj vietu PROVIN AUDITS, bez panikas un bez solījumiem par maksas avotiem.
 */

export const LISTING_PEEK_COMMENT_GREETING = "Sveiki!";

export const LISTING_PEEK_COMMENT_CLOSER =
  "Šis ir īss skatījums tikai pēc sludinājuma. Pilnā aina — nobraukuma ķēde, negadījumi un dīlera vēsture — ir PROVIN AUDITS.";

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
        text: "Ticamība odometra rādījumiem sludinājuma datos izskatās ļoti augsta.",
      },
      {
        tone: "caution",
        label: "Jāpēta",
        text: "Pēc sludinājuma vien nobraukuma ticamību apstiprināt nevar — to var salīdzināt tikai vairākos avotos.",
      },
      {
        tone: "concern",
        label: "Neskaidrs",
        text: "Nobraukuma stāsts sludinājumā ir neskaidrs; precīzu ķēdi redz tikai maksas datubāzēs un dīlera vēsturē.",
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
        text: "Sludinājumā nav redzamu norāžu uz smagu negadījumu — tas vēl nav apstiprinājums.",
      },
      {
        tone: "caution",
        label: "Jāpēta",
        text: "Negadījumi padziļināti jāpēta maksas datubāzēs.",
      },
      {
        tone: "concern",
        label: "Pazīmes",
        text: "Ir pazīmes, ka auto varētu būt bijis remonta objekts; sludinājums to neizslēdz.",
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
        text: "Šajā sludinājumā tehniskie riski izskatās mēreni, taču klātiene paliek obligāta.",
      },
      {
        tone: "caution",
        label: "Nianses",
        text: "Tehniski ir nianses, kas būs jāpēta klātienē.",
      },
      {
        tone: "concern",
        label: "Jāskata",
        text: "Šim sludinājumam ir vietas, kuras bez klātienes un vēstures datiem nevar noslēgt.",
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
        text: "Pārdevējs ar salīdzinoši labu reputāciju, kas šodien nav mazsvarīgi.",
      },
      {
        tone: "caution",
        label: "Neitrāls",
        text: "Pārdevēja profils ir neitrāls — izšķirs, vai sludinājums saskan ar datiem.",
      },
      {
        tone: "concern",
        label: "Jautājumi",
        text: "Pārdevēja sludinājums atstāj jautājumus; tos labāk lasīt kopā ar auto vēsturi.",
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
        text: "Bildēs būtiski trūkumi netika konstatēti (virspusēji apskatot).",
      },
      {
        tone: "caution",
        label: "Maz",
        text: "Bildes ir par maz vai par vispārīgas, lai izslēgtu remonta pēdas.",
      },
      {
        tone: "concern",
        label: "Tuvplāni",
        text: "Bildēs ir vietas, kuras gribētos redzēt tuvāk — to var salīdzināt ar izsoļu arhīvu.",
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
