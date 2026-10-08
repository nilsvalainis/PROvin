export const LISTING_TECH_CATS = [
  "Motors",
  "Ātrumkārba",
  "Sajūgs/DSG",
  "Turbo",
  "Piedziņa",
  "Stūre",
  "Bremzes",
  "Balstiekārta",
  "Elektronika/kļūdu lampiņas",
  "DPF/AdBlue",
  "Dzesēšana/noplūdes",
  "Kondicionieris",
  "Nav braucams",
] as const;

export type ListingTechCat = (typeof LISTING_TECH_CATS)[number];

const TECH: Array<[ListingTechCat, string[]]> = [
  ["Motors", ["motor", "motorschaden*", "motorgeräusch*", "motorstoring*", "engine", "moteur", "motore", "klopf*", "knocking", "cliquetis", "zylinderkopf*", "kopfdichtung*", "cylinder head*", "head gasket*", "culasse"]],
  ["Ātrumkārba", ["getriebe*", "automatikgetriebe*", "schaltgetriebe*", "schaltruckeln*", "gearbox*", "transmission*", "boîte de vitesse*", "boite de vitesse*", "versnellingsbak*", "cambio"]],
  ["Sajūgs/DSG", ["kupplung*", "doppelkupplung*", "clutch*", "embrayage*", "koppeling*", "frizione", "dsg", "mechatronik*", "mechatronic*"]],
  ["Turbo", ["turbo*", "turbocompresseur*", "turbina"]],
  ["Piedziņa", ["antriebswelle*", "gelenkwelle*", "differential*", "differenzial*", "driveshaft*", "drive shaft*", "cardan*", "aandrijving*", "cardano"]],
  ["Stūre", ["lenkung*", "servolenkung*", "steering", "direction assistée", "stuurinrichting*", "sterzo"]],
  ["Bremzes", ["bremse*", "brake*", "frein*", "remmen", "freni", "abs"]],
  ["Balstiekārta", ["fahrwerk*", "stoßdämpfer*", "stossdämpfer*", "federung*", "suspension*", "shock absorber*", "amortisseur*", "ophanging*", "sospensione*", "air suspension"]],
  ["Elektronika/kļūdu lampiņas", ["motorkontrollleuchte*", "kontrollleuchte*", "warnleuchte*", "fehlerspeicher*", "check engine", "warning light*", "error code*", "fault code*", "voyant*", "storingslampje*", "spia", "elektronik*", "airbag*"]],
  ["DPF/AdBlue", ["dpf", "partikelfilter*", "fap", "filtre à particules", "roetfilter*", "adblue", "egr"]],
  ["Dzesēšana/noplūdes", ["ölverlust*", "ölleck*", "undicht*", "kühlmittel*", "oil leak*", "coolant", "overheat*", "fuite*", "olielek*", "perdita*"]],
  ["Kondicionieris", ["klimaanlage*", "air conditioning", "a/c", "climatisation", "airco", "aria condizionata"]],
  ["Nav braucams", ["nicht fahrbereit", "nicht fahrbar", "not driveable", "not drivable", "non-runner", "non roulant*", "niet rijdbaar", "startet nicht", "does not start", "won't start"]],
];

export const HARD_TECH_CATS: readonly ListingTechCat[] = ["Motors", "Ātrumkārba", "Sajūgs/DSG"];

const NEG = /(?:^|[\s,(])(kein\w*|ohne|no|not|sans|pas de|geen|nessun\w*|senza)\s+(?:\S+\s+){0,2}$/i;

/**
 * Bez lookbehind: Safari `(?<!\p{L})` ar Unicode īpašībām čunka ielādē met
 * "Invalid regular expression" un Next rāda Application error.
 * `(^|\P{L})` ir viena kodpunkta atoms ar `u`, strādā Safari 11.1+.
 */
function compileTerm(t: string): RegExp {
  const prefix = t.endsWith("*");
  const w = t.replace(/\*$/, "").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const body = prefix ? `${w}\\p{L}*` : `${w}(?!\\p{L})`;
  try {
    return new RegExp(`(^|\\P{L})(${body})`, "giu");
  } catch {
    const latin = prefix ? `${w}[A-Za-zÀ-ž]*` : `${w}(?![A-Za-zÀ-ž])`;
    return new RegExp(`(^|[^A-Za-zÀ-ž])(${latin})`, "gi");
  }
}

const TECH_RE: Array<[ListingTechCat, RegExp[]]> = TECH.map(([cat, terms]) => [cat, terms.map(compileTerm)]);

export type ListingDamageHit = { name: ListingTechCat; words: string[] };

export type ListingDamageClass = {
  status: "nodata" | "none" | "hit";
  cats: ListingDamageHit[];
  spans: Array<{ s: number; e: number; cat: ListingTechCat }>;
};

export function classifyListingDamage(text: string | null | undefined): ListingDamageClass {
  if (text == null || !String(text).trim()) return { status: "nodata", cats: [], spans: [] };
  const spans: ListingDamageClass["spans"] = [];
  const cats = new Map<ListingTechCat, Set<string>>();
  for (const [cat, res] of TECH_RE) {
    for (const re of res) {
      re.lastIndex = 0;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        const lead = m[1] ?? "";
        const word = m[2] ?? m[0].slice(lead.length);
        const s = m.index + lead.length;
        const e = s + word.length;
        const sentence = text.slice(0, s).split(/[.;!?\n]/).pop() ?? "";
        if (NEG.test(sentence)) continue;
        spans.push({ s, e, cat });
        if (!cats.has(cat)) cats.set(cat, new Set());
        cats.get(cat)!.add(word);
      }
    }
  }
  const order = LISTING_TECH_CATS as readonly string[];
  const list = [...cats.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([name, w]) => ({ name, words: [...w] }));
  return { status: list.length ? "hit" : "none", cats: list, spans };
}

export function listingHasHardTechDamage(text: string | null | undefined): boolean {
  return classifyListingDamage(text).cats.some((x) => HARD_TECH_CATS.includes(x.name));
}

export function highlightListingDamage(text: string, spans: ListingDamageClass["spans"]): string {
  const s = [...spans].sort((a, b) => a.s - b.s || b.e - a.e);
  let out = "";
  let pos = 0;
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (const x of s) {
    if (x.s < pos) continue;
    out += esc(text.slice(pos, x.s)) + `<mark data-cat="${x.cat}">${esc(text.slice(x.s, x.e))}</mark>`;
    pos = x.e;
  }
  return out + esc(text.slice(pos));
}
