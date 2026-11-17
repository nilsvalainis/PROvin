import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_COMMENT_CLOSER,
  LISTING_PEEK_COMMENT_GREETING,
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  insertListingPeekLetterSentence,
  stripListingPeekCommentLeadingGreeting,
  joinListingPeekSentences,
  listingPeekPhraseById,
  listingPeekPhraseByTone,
  listingPeekSelectedPhraseIds,
  parseListingPeekAiPayload,
  parseListingPeekCustomerComment,
  removeListingPeekSentence,
  stripListingPeekMarkdown,
  toggleListingPeekSentence,
} from "@/lib/listing-peek-comment-presets";

describe("joinListingPeekSentences", () => {
  it("continues the same paragraph after a period and one space", () => {
    expect(joinListingPeekSentences("Pirmais teikums.", "Otrais teikums.")).toBe(
      "Pirmais teikums. Otrais teikums.",
    );
    expect(joinListingPeekSentences("Sveiki!", "Ticamība ir augsta.")).toBe(
      "Sveiki! Ticamība ir augsta.",
    );
    expect(joinListingPeekSentences("Bez punkta", "Nākamais.")).toBe("Bez punkta. Nākamais.");
  });
});

describe("toggleListingPeekSentence", () => {
  it("allows multiple phrases from the same topic in order", () => {
    const labs = listingPeekPhraseByTone("odometer", "positive");
    const kritisks = listingPeekPhraseByTone("odometer", "critical");
    const once = toggleListingPeekSentence("", labs);
    const twice = toggleListingPeekSentence(once, kritisks);
    expect(twice).toBe(`${labs} ${kritisks}`);
    expect(listingPeekSelectedPhraseIds("odometer", twice)).toEqual([
      "odometer-labs",
      "odometer-kritisks",
    ]);
    const off = toggleListingPeekSentence(twice, labs);
    expect(off).toBe(kritisks);
  });

  it("removeListingPeekSentence cleans leftover spaces", () => {
    const a = listingPeekPhraseById("photos-tiras");
    const b = listingPeekPhraseById("photos-lietosanas");
    const joined = joinListingPeekSentences(a, b);
    expect(removeListingPeekSentence(joined, a)).toBe(b);
  });
});

describe("assembleListingPeekCustomerComment", () => {
  it("joins templates in one paragraph without default greeting", () => {
    const comment = assembleListingPeekCustomerComment({
      lines: {
        odometer: listingPeekPhraseByTone("odometer", "positive"),
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        technical: listingPeekPhraseByTone("technical", "caution"),
        seller: listingPeekPhraseByTone("seller", "positive"),
        photos: listingPeekPhraseByTone("photos", "positive"),
        dealer: listingPeekPhraseByTone("dealer", "positive"),
      },
    });
    expect(comment.startsWith("Sākotnējie dati norāda")).toBe(true);
    expect(comment).not.toMatch(/^Sveiki|^Labdien/i);
    expect(comment).not.toMatch(/\n(?!\n)/);
    expect(comment).not.toContain("1. ");
    expect(comment).toContain("Sākotnējie dati norāda uz augstu odometra rādījumu ticamību");
    expect(comment).toContain(". Automašīnas negadījumu vēsturi nepieciešams padziļināti pārbaudīt");
    expect(comment).toContain(". Šim modeļim ir zināmas nianses");
    expect(comment).toContain(". Pārdevējam ir salīdzinoši laba reputācija");
    expect(comment).toContain(". Virspusēji izvērtējot sludinājuma fotogrāfijas, būtiski vizuālie defekti netika novēroti.");
    expect(comment).toContain(". Ja auto ir apkopts pie oficiālā dīlera");
    expect(comment).not.toContain(LISTING_PEEK_COMMENT_CLOSER);
  });

  it("skips empty topics and still stays in one paragraph", () => {
    const comment = assembleListingPeekCustomerComment({
      greeting: false,
      lines: {
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        photos: listingPeekPhraseByTone("photos", "concern"),
      },
    });
    expect(comment).toBe(
      `${listingPeekPhraseByTone("incidents", "caution")} ${listingPeekPhraseByTone("photos", "concern")}`,
    );
  });

  it("appends the optional closer after the points", () => {
    const comment = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    const [body, closerBlock] = comment.split("\n\n");
    expect(body).toBe(listingPeekPhraseByTone("technical", "caution"));
    expect(body).not.toContain("\n");
    expect(closerBlock).toBe(LISTING_PEEK_COMMENT_CLOSER);
  });

  it("optional greeting:true prepends Sveiki for legacy flows", () => {
    const comment = assembleListingPeekCustomerComment({
      greeting: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    expect(comment.startsWith(`${LISTING_PEEK_COMMENT_GREETING} `)).toBe(true);
  });

  it("still reads an older numbered letter back into topic fields", () => {
    const incidents = listingPeekPhraseByTone("incidents", "caution");
    const photos = listingPeekPhraseByTone("photos", "concern");
    const parsed = parseListingPeekCustomerComment(
      `${LISTING_PEEK_COMMENT_GREETING}\n\n1. ${incidents}\n2. ${photos}\n\n${LISTING_PEEK_COMMENT_CLOSER}`,
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines.incidents).toBe(incidents);
    expect(parsed.lines.photos).toBe(photos);
  });

  it("maps known phrases even when some topics were skipped", () => {
    const parsed = parseListingPeekCustomerComment(
      assembleListingPeekCustomerComment({
        lines: {
          incidents: listingPeekPhraseByTone("incidents", "caution"),
          photos: listingPeekPhraseByTone("photos", "concern"),
        },
      }),
    );
    expect(parsed.lines.incidents).toBe(listingPeekPhraseByTone("incidents", "caution"));
    expect(parsed.lines.photos).toBe(listingPeekPhraseByTone("photos", "concern"));
    expect(parsed.lines.odometer).toBe("");
  });

  it("round-trips a sent letter back into topic fields including dealer", () => {
    const lines = {
      odometer: listingPeekPhraseByTone("odometer", "positive"),
      incidents: listingPeekPhraseByTone("incidents", "caution"),
      technical: listingPeekPhraseByTone("technical", "caution"),
      seller: listingPeekPhraseByTone("seller", "positive"),
      photos: listingPeekPhraseByTone("photos", "positive"),
      dealer: listingPeekPhraseByTone("dealer", "caution"),
      recommendation: "",
    };
    const parsed = parseListingPeekCustomerComment(
      assembleListingPeekCustomerComment({ closer: true, lines }),
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines).toEqual(lines);
  });
});

describe("parseListingPeekAiPayload", () => {
  it("reads Flash/Gemini JSON including a fenced block", () => {
    const parsed = parseListingPeekAiPayload(
      "```json\n" +
        JSON.stringify({
          odometer: listingPeekPhraseByTone("odometer", "caution"),
          incidents: "",
          technical: listingPeekPhraseByTone("technical", "positive"),
          seller: "",
          photos: listingPeekPhraseByTone("photos", "caution"),
          dealer: listingPeekPhraseByTone("dealer", "concern"),
          closer: true,
        }) +
        "\n```",
    );
    expect(parsed?.closer).toBe(true);
    expect(parsed?.lines.odometer).toBe(listingPeekPhraseByTone("odometer", "caution"));
    expect(parsed?.lines.technical).toBe(listingPeekPhraseByTone("technical", "positive"));
    expect(parsed?.lines.photos).toBe(listingPeekPhraseByTone("photos", "caution"));
    expect(parsed?.lines.dealer).toBe(listingPeekPhraseByTone("dealer", "concern"));
    expect(parsed?.lines.incidents).toBe("");
  });

  it("strips Gemini markdown bold from letter and topic lines", () => {
    const parsed = parseListingPeekAiPayload({
      technical: "**Tehniskais salikums.** Šai automašīnai ir nianses.",
      closer: true,
      letter: [
        LISTING_PEEK_COMMENT_GREETING,
        "",
        "1. **Tehniskais salikums.** Šai automašīnai ir nianses.",
        "2. **Vēsture un pārdevējs.** Jāpēta, kā auto nonācis tirgū.",
        "",
        LISTING_PEEK_COMMENT_CLOSER,
      ].join("\n"),
    });
    expect(parsed?.lines.technical).toBe("Tehniskais salikums. Šai automašīnai ir nianses.");
    expect(parsed?.letter).toContain("1. Tehniskais salikums. Šai automašīnai ir nianses.");
    expect(parsed?.letter).toContain("2. Vēsture un pārdevējs. Jāpēta, kā auto nonācis tirgū.");
    expect(parsed?.letter).not.toContain("**");
  });

  it("keeps the full letter field so Gemini can process operator extras", () => {
    const letter = [
      LISTING_PEEK_COMMENT_GREETING,
      "",
      listingPeekPhraseByTone("odometer", "positive"),
      "",
      "VIN no Vācijas, 2018. gads, 189 000 km.",
      "",
      LISTING_PEEK_COMMENT_CLOSER,
    ].join("\n");
    const parsed = parseListingPeekAiPayload({
      odometer: listingPeekPhraseByTone("odometer", "positive"),
      closer: true,
      letter,
    });
    expect(parsed?.letter).toBe(letter);
    expect(parsed?.closer).toBe(true);
  });
});

describe("insertListingPeekLetterSentence", () => {
  it("inserts a specific sentence before the closer in the same paragraph", () => {
    const base = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    const next = insertListingPeekLetterSentence(base, "VIN no Vācijas, 2018. gads.");
    expect(next).toContain(". VIN no Vācijas, 2018. gads.\n\n");
    expect(next.endsWith(LISTING_PEEK_COMMENT_CLOSER)).toBe(true);
    expect(next.indexOf("VIN no Vācijas")).toBeLessThan(next.indexOf(LISTING_PEEK_COMMENT_CLOSER));
    expect(next.split("\n\n")).toHaveLength(2);
  });
});

describe("stripListingPeekMarkdown", () => {
  it("removes paired and leftover bold markers", () => {
    expect(stripListingPeekMarkdown("1. **Tehniskais salikums.** Teksts.")).toBe(
      "1. Tehniskais salikums. Teksts.",
    );
    expect(stripListingPeekMarkdown("Atlikušas ** zvaigznes")).toBe("Atlikušas  zvaigznes");
  });
});

describe("LISTING_PEEK_TOPICS", () => {
  it("keeps operator phrases without repair EUR, panic, or em dashes", () => {
    const all = LISTING_PEEK_TOPICS.flatMap((t) => t.phrases.map((p) => p.text)).join("\n");
    expect(all).not.toMatch(/€|EUR|anomālij|nepērc|katastrof/i);
    expect(all).not.toContain("\u2014");
    expect(all).not.toContain("\u2013");
    expect(LISTING_PEEK_COMMENT_CLOSER).not.toContain("\u2014");
    expect(LISTING_PEEK_COMMENT_CLOSER).not.toContain("\u2013");
    expect(LISTING_PEEK_TOPICS).toHaveLength(7);
    expect(LISTING_PEEK_TOPICS.map((t) => t.phrases.length)).toEqual([7, 5, 3, 4, 4, 5, 5]);
    for (const topic of LISTING_PEEK_TOPICS) {
      const ids = topic.phrases.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(topic.phrases[0]?.tone).toBe("positive");
    }
    expect(listingPeekPhraseById("photos-lenki")).toBe("");
    expect(listingPeekPhraseById("dealer-nav")).toBe("");
    expect(listingPeekPhraseByTone("photos", "info")).toBe("");
    expect(listingPeekPhraseByTone("dealer", "critical")).toBe("");
    expect(listingPeekPhraseByTone("incidents", "info")).toContain("Latvijas OCTA datubāzē");
    expect(listingPeekPhraseById("recommendation-neiesakam")).toContain("neiesakām");
  });

  it("uses the approved Latvian preset texts", () => {
    expect(listingPeekPhraseById("odometer-ncsdd")).toBe(
      "Latvijā šim auto vēl nav veikta agregātu numuru salīdzināšana, tāpēc CSDD sistēmā pagaidām nav redzami nobraukuma rādījumi no ārvalstu tehniskajām apskatēm (tie glabājas Eiropas EUCARIS datubāzē). Tie parādīsies pēc numuru salīdzināšanas, un citos avotos tie nav pieejami. Ja pārdevējs nav gatavs numurus salīdzināt pirms auto iegādes, pārbaude starptautiskajos reģistros var būt vienīgais veids, kā pārliecināties par nobraukuma patiesumu.",
    );
    expect(listingPeekPhraseById("odometer-kritisks")).toBe(
      "Pieejamie dati liecina par iespējamām nobraukuma pretrunām auto vēsturē, taču droši to var apstiprināt tikai ar padziļinātu pārbaudi.",
    );
    expect(listingPeekPhraseById("odometer-ierobezoti")).toBe(
      "Jāņem vērā, ka šim auto pilnu nobraukuma hronoloģiju no publiskajiem ārvalstu reģistriem iegūt var būt grūti: izcelsmes valsts un auto vecums var neļaut iegūt pietiekami daudz informācijas, lai izsekotu visam nobraukumam.",
    );
    expect(listingPeekPhraseById("odometer-tehniska-pase")).toBe(
      "Šim auto datus no ārvalstu reģistriem iegūt var būt grūti. Pirms pasūtījuma palūdziet pārdevējam ārvalsts reģistrācijas apliecības (tehniskās pases) foto, kurā redzams reģistrācijas numurs. Tas var palīdzēt iegūt vairāk vēstures datu.",
    );
    expect(LISTING_PEEK_TOPICS.find((t) => t.id === "odometer")?.phrases.find((p) => p.id === "odometer-japeta")?.label).toBe(
      "Jāpēta",
    );
    expect(LISTING_PEEK_TOPICS.find((t) => t.id === "incidents")?.phrases.find((p) => p.id === "incidents-pazimes")?.label).toBe(
      "Pazīmes",
    );
    expect(LISTING_PEEK_TOPICS.find((t) => t.id === "technical")?.phrases.find((p) => p.id === "technical-nianses")?.label).toBe(
      "Nianses",
    );
    expect(LISTING_PEEK_TOPICS.find((t) => t.id === "seller")?.phrases.find((p) => p.id === "seller-jautajumi")?.label).toBe(
      "Jautājumi",
    );
    expect(listingPeekPhraseById("odometer-japeta")).toBe(
      "Latvijā fiksētie nobraukuma rādījumi ir secīgi un loģiski, taču auto uz Latviju ievests jau ar ievērojamu nobraukumu, un tā pirmo dzīves posmu ārvalstīs mūsu sākotnējā pārbaude neaptver. Odometra atbilstību šobrīd nav iespējams pilnvērtīgi apstiprināt, tāpēc pilnīgai pārliecībai nobraukuma hronoloģija jāsalīdzina ar starptautiskajiem un dīleru reģistriem.",
    );
    expect(listingPeekPhraseById("incidents-nav-redzams")).toBe(
      "Sākotnēji bojājumu pazīmes negadījumu vēsturē nav redzamas.",
    );
    expect(listingPeekPhraseById("incidents-pazimes")).toBe(
      "Pieejamā informācija liecina par iespējamu dalību negadījumā, tāpēc būtiski noskaidrot fiksēto bojājumu raksturu un aprēķināto zaudējumu apmēru. Jāņem vērā arī, ka par auto laiku ārvalstīs negadījumu datus atklāj tikai padziļināta pārbaude.",
    );
    expect(listingPeekPhraseById("technical-merens")).toBe(
      "Konceptuāli šis modelis ir uzticams, taču daudz ko noteiks konkrētā auto stāvoklis, vēsture un objektīvs novērtējums klātienē, jo, kā jau visiem auto, arī šim ir savas vājās vietas.",
    );
    expect(listingPeekPhraseById("technical-nianses")).toBe(
      "Šim modeļim ir zināmas nianses, kurām jāpievērš uzmanība gan apskatot auto klātienē, gan turpmākajā ekspluatācijā. Tehniskās apskates vēsturē ir pazīmes, kas norāda uz vietām, kuras klātienē vērts apskatīt rūpīgāk.",
    );
    expect(listingPeekPhraseById("seller-jautajumi")).toBe(
      "Auto pārdošanā ir jau ilgstoši, un cena ir būtiski samazināta. Uzmanību pievērš arī pārdevēja darbības stils, kas rada papildu jautājumus.",
    );
    expect(listingPeekPhraseById("technical-problematisks")).toBe(
      "Šim modelim ir zināmi riski, kas noteikti jāņem vērā gan pirms pirkuma, gan pēc tā.",
    );
    expect(LISTING_PEEK_COMMENT_CLOSER).toBe(
      "Šis ir sākotnējs, virspusējs vērtējums. PROVIN AUDITS dod pilnu ainu: nobraukuma hronoloģiju, negadījumu datus, dīleru vēsturi un šī modeļa tehniskos riskus. Tas palīdz pieņemt pārdomātu lēmumu un iegūt argumentus cenas sarunām.",
    );
  });

  it("keeps previously sent letters with the old chip texts in their topic fields", () => {
    const oldOdometer =
      "Odometra rādījuma atbilstību šobrīd nav iespējams pilnvērtīgi apstiprināt, tāpēc pilnīgai pārliecībai nobraukuma hronoloģija ir jāsalīdzina ar starptautiskajiem un dīleru reģistriem.";
    const oldIncidents =
      "Pieejamā informācija liecina par iespējamu dalību negadījumā, tāpēc būtiski noskaidrot fiksēto bojājumu raksturu un aprēķināto zaudējumu apmēru.";
    const oldTechnical =
      "Šim modelim ir zināmas nianses, kurām jāpievērš uzmanība gan apskatot auto klātienē, gan turpmākajā ekspluatācijā.";
    const oldSeller = "Uzmanību pievērš arī pārdevēja darbības stils, kas rada papildu jautājumus.";
    const parsed = parseListingPeekCustomerComment(
      `${oldOdometer} ${oldIncidents} ${oldTechnical} ${oldSeller}\n\n${LISTING_PEEK_COMMENT_CLOSER}`,
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines.odometer).toBe(oldOdometer);
    expect(parsed.lines.incidents).toBe(oldIncidents);
    expect(parsed.lines.technical).toBe(oldTechnical);
    expect(parsed.lines.seller).toBe(oldSeller);
    expect(parsed.lines.odometer).not.toBe(listingPeekPhraseById("odometer-japeta"));
    expect(parsed.lines.incidents).not.toBe(listingPeekPhraseById("incidents-pazimes"));
    expect(parsed.lines.technical).not.toBe(listingPeekPhraseById("technical-nianses"));
    expect(parsed.lines.seller).not.toBe(listingPeekPhraseById("seller-jautajumi"));
  });

  it("still recognizes a previously sent letter with the legacy closer", () => {
    const legacyCloser =
      "Šis ir virspusējs sākotnējais vērtējums. Pilnu auto analīzi ar nobraukuma hronoloģiju, negadījumu datiem, dīleru vēsturi un specifisko tehnisko risku analīzi nodrošina PROVIN AUDITS. Tas ir drošākais veids, kā pilnvērtīgi noskaidrot digitālo auto vēsturi, izvairīties no dārgiem remontiem un iegūt argumentus cenas apspriešanai.";
    const body = listingPeekPhraseByTone("technical", "caution");
    const parsed = parseListingPeekCustomerComment(`${body}\n\n${legacyCloser}`);
    expect(parsed.closer).toBe(true);
    expect(parsed.lines.technical).toBe(body);
    expect(insertListingPeekLetterSentence(`${body}\n\n${legacyCloser}`, "VIN no Vācijas, 2018. gads.")).toContain(
      `${legacyCloser}`,
    );
    expect(insertListingPeekLetterSentence(`${body}\n\n${legacyCloser}`, "VIN no Vācijas, 2018. gads.")).not.toContain(
      LISTING_PEEK_COMMENT_CLOSER,
    );
  });
});
