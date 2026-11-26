/**
 * Klienta atskaites (EN/RU/DE) teksti, ko statiskā vārdnīca nevar noķert: frāzes ar skaitļiem un valstu nosaukumi.
 * Darbojas tikai teksta mezglos (starp `>` un `<`), ne atribūtos / CSS / skriptā. FABLE 25.10: EN/RU/DE PDF palika
 * "3 ieraksti bez pretrunām", "Aptuveni 29 mēneši bez ierakstiem", "2. īpašnieks Latvijā", "Vācija/Dānija".
 */
import { applyClientReportStaticTranslations, type ClientReportLang } from "@/lib/client-report-i18n";
import { htmlTextStillLatvian } from "@/lib/client-report-html-residue";
import { countryIsoFromLvLocative, ISO2_TO_LV_NAME } from "@/lib/country-names-lv";
import { translateClientReportLvTerms } from "@/lib/client-report-lv-terms-i18n";

type Target = Exclude<ClientReportLang, "lv">;
type Rule = { re: RegExp; to: Record<Target, (m: RegExpExecArray) => string> };

const RULES: Rule[] = [
  {
    re: /(\d+) (?:ieraksts|ieraksti|ierakstu) bez pretrunām/g,
    to: {
      en: (m) => `${m[1]} ${m[1] === "1" ? "record" : "records"}, consistent`,
      ru: (m) => `${m[1]} зап. без противоречий`,
      de: (m) => `${m[1]} ${m[1] === "1" ? "Eintrag" : "Einträge"} ohne Widersprüche`,
    },
  },
  {
    // 24.11 (Nils A): nobraukuma tabulas piezīme ar abiem skaitļiem (sludinājums zem agrāk fiksētā).
    re: /Sludinājumā \((\d{2}\.\d{2}\.\d{4})\) norādīts ([\d\s]+?) km - par ([\d\s]+?) km mazāk nekā iepriekš fiksētais ([\d\s]+?) km \((\d{2}\.\d{2}\.\d{4})\)\./g,
    to: {
      en: (m) => `The listing (${m[1]}) states ${m[2]} km - ${m[3]} km less than the previously recorded ${m[4]} km (${m[5]}).`,
      ru: (m) => `В объявлении (${m[1]}) указано ${m[2]} км - на ${m[3]} км меньше, чем ранее зафиксированные ${m[4]} км (${m[5]}).`,
      de: (m) => `Im Inserat (${m[1]}) sind ${m[2]} km angegeben - ${m[3]} km weniger als die zuvor erfassten ${m[4]} km (${m[5]}).`,
    },
  },
  {
    // 24.11 (Nils A): kopsavilkuma kartīte.
    re: /sludinājumā(?: \((\d{2}\.\d{2}\.\d{4})\))? par ([\d\s]+?) km mazāk nekā fiksēts/g,
    to: {
      en: (m) => `listing${m[1] ? ` (${m[1]})` : ""} shows ${m[2]} km less than recorded`,
      ru: (m) => `в объявлении${m[1] ? ` (${m[1]})` : ""} на ${m[2]} км меньше, чем зафиксировано`,
      de: (m) => `im Inserat${m[1] ? ` (${m[1]})` : ""} ${m[2]} km weniger als erfasst`,
    },
  },
  {
    re: /Aptuveni (\d+) mēne(?:sis|ši|šu) bez ierakstiem/g,
    to: {
      en: (m) => `About ${m[1]} months without records`,
      ru: (m) => `Около ${m[1]} мес. без записей`,
      de: (m) => `Etwa ${m[1]} Monate ohne Einträge`,
    },
  },
  {
    re: /(\d+)\. īpašnieks Latvijā/g,
    to: {
      en: (m) => `Owner no. ${m[1]} in Latvia`,
      ru: (m) => `${m[1]}-й владелец в Латвии`,
      de: (m) => `${m[1]}. Halter in Lettland`,
    },
  },
  {
    // Ārvalstu īpašnieka maiņa: „3. īpašnieks Nīderlandē”, „2. un 3. īpašnieks Nīderlandē”.
    re: /((?:\d+\., )*\d+\.(?: un \d+\.)?) īpašnieks (ASV|Apvienotajā Karalistē|\p{L}+[āē])(?![\p{L}\p{N}])/gu,
    to: {
      en: (m) => `Owner no. ${ordinalList(m[1]!, "en")} (${regionName(m[2]!, "en")})`,
      ru: (m) => `Владелец № ${ordinalList(m[1]!, "ru")} (${regionName(m[2]!, "ru")})`,
      de: (m) => `${ordinalList(m[1]!, "de")} Halter (${regionName(m[2]!, "de")})`,
    },
  },
  {
    // carVertical kopkartīte: „6 īpašnieku maiņas Somijā”.
    re: /(\d+) īpašniek(?:a maiņa|u maiņas) (ASV|Apvienotajā Karalistē|\p{L}+[āē])(?![\p{L}\p{N}])/gu,
    to: {
      en: (m) => `${m[1]} ${m[1] === "1" ? "change" : "changes"} of ownership (${regionName(m[2]!, "en")})`,
      ru: (m) => `Смен владельца: ${m[1]} (${regionName(m[2]!, "ru")})`,
      de: (m) => `${m[1]} Halterwechsel (${regionName(m[2]!, "de")})`,
    },
  },
  {
    re: /1\. reģistrācija Latvijā/g,
    to: {
      en: () => "First registration in Latvia",
      ru: () => "Первая регистрация в Латвии",
      de: () => "Erstzulassung in Lettland",
    },
  },
  {
    re: /(?<![\p{L}\p{N}])Latvijā (\d+)/gu,
    to: { en: (m) => `Latvia ${m[1]}`, ru: (m) => `в Латвии ${m[1]}`, de: (m) => `Lettland ${m[1]}` },
  },
  {
    re: /(?<![\p{L}\p{N}])ārvalstīs (\d+)/gu,
    to: { en: (m) => `abroad ${m[1]}`, ru: (m) => `за рубежом ${m[1]}`, de: (m) => `Ausland ${m[1]}` },
  },
  {
    // Kartīte «Reģistrācija Latvijā» (Nils 25.11): viss teksta mezgls ir ilgums - «1 g. 3 mēn.», «5 mēn.», «2 g.».
    re: /^(\s*)(?:(\d+) g\.)?(?: ?(\d+) mēn\.)?(\s*)$/g,
    to: {
      en: (m) => tenure(m, "en"),
      ru: (m) => tenure(m, "ru"),
      de: (m) => tenure(m, "de"),
    },
  },
  {
    re: /^(\s*)(\d+) dien(?:a|as)(\s*)$/g,
    to: {
      en: (m) => `${m[1]}${m[2]} ${m[2] === "1" ? "day" : "days"}${m[3]}`,
      ru: (m) => `${m[1]}${m[2]} дн.${m[3]}`,
      de: (m) => `${m[1]}${m[2]} ${m[2] === "1" ? "Tag" : "Tage"}${m[3]}`,
    },
  },
  {
    re: /(?<![\p{L}\p{N}])Jaunākais:/gu,
    to: { en: () => "Latest:", ru: () => "Последний:", de: () => "Neuester:" },
  },
];

/** «1 g. 3 mēn.» → tās pašas vienības kā `pdfTopAgeLabel` («Vecums»). Tukšu mezglu atstāj, kā ir. */
function tenure(m: RegExpExecArray, lang: Target): string {
  const [all, lead = "", y, mo, trail = ""] = m;
  if (!y && !mo) return all ?? "";
  const U: Record<Target, [string, string]> = { en: ["yrs", "mos"], ru: ["г.", "мес."], de: ["J.", "Mon."] };
  const [yu, mu] = U[lang];
  const parts = [y ? `${y} ${yu}` : "", mo ? `${mo} ${mu}` : ""].filter(Boolean);
  return `${lead}${parts.join(" ")}${trail}`;
}

/** „2. un 3.” → EN/RU „2 and 3” / „2 и 3”, DE „2. und 3.”. */
function ordinalList(raw: string, lang: Target): string {
  const nums = raw.match(/\d+/g) ?? [];
  if (lang === "de") return nums.length > 1 ? `${nums.slice(0, -1).map((n) => `${n}.`).join(", ")} und ${nums[nums.length - 1]}.` : `${nums[0]}.`;
  const and = lang === "ru" ? " и " : " and ";
  return nums.length > 1 ? `${nums.slice(0, -1).join(", ")}${and}${nums[nums.length - 1]}` : (nums[0] ?? "");
}

/** Lokatīvs („Nīderlandē”) → valsts nosaukums mērķa valodā; ja neatpazīst, paliek kā ir. */
function regionName(locative: string, lang: Target): string {
  const iso = countryIsoFromLvLocative(locative);
  if (!iso) return locative;
  return new Intl.DisplayNames([lang], { type: "region" }).of(iso) ?? locative;
}

const COUNTRY_CACHE = new Map<Target, Array<{ re: RegExp; name: string }>>();

function countryRules(lang: Target): Array<{ re: RegExp; name: string }> {
  let rules = COUNTRY_CACHE.get(lang);
  if (rules) return rules;
  const names = new Intl.DisplayNames([lang], { type: "region" });
  rules = Object.entries(ISO2_TO_LV_NAME)
    .map(([iso2, lv]) => ({ lv, name: names.of(iso2) ?? "" }))
    .filter((r) => r.name && r.name !== r.lv)
    .sort((a, b) => b.lv.length - a.lv.length)
    .map((r) => ({
      re: new RegExp(`(?<![\\p{L}\\p{N}])${r.lv.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu"),
      name: r.name,
    }));
  COUNTRY_CACHE.set(lang, rules);
  return rules;
}

function translateTextNode(text: string, lang: Target): string {
  if (!/[^\s]/.test(text)) return text;
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      return rule.to[lang](m);
    });
  }
  for (const c of countryRules(lang)) out = out.replace(c.re, c.name);
  return out;
}

export function applyClientReportDynamicTranslations(html: string, lang: ClientReportLang): string {
  if (lang === "lv") return html;
  const bodyAt = html.indexOf("<body");
  if (bodyAt < 0) return html;
  const head = html.slice(0, bodyAt);
  const body = html
    .slice(bodyAt)
    // Skripti un stili netiek aiztikti.
    .replace(/(<(script|style)\b[\s\S]*?<\/\2>)|>([^<]+)</g, (all, block: string | undefined, _tag, text: string | undefined) =>
      block ? block : `>${translateClientReportLvTerms(translateTextNode(text ?? "", lang), lang)}<`,
    );
  return head + body;
}

const TEXT_NODE_OR_BLOCK = /(<(script|style)\b[\s\S]*?<\/\2>)|>([^<]+)</g;

function textNodesOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(TEXT_NODE_OR_BLOCK)) if (!m[1]) out.push(m[3] ?? "");
  return out;
}

function decodeText(raw: string): string {
  return raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/**
 * 26.11 regresija: vārdnīcas aizstāšana datu teikumos deva jauktus teikumus («Doors nav atveramas», «Record atspoguļo»,
 * «Grey, metālika»). Ja teksta mezgls pēc tulkojuma mainījies, bet vēl ir latviski, tas tiek atjaunots oriģinālā -
 * viss teikums paliek AI atlieku gājienam (`translateClientReportHtmlResidue`). Pilnībā iztulkoti mezgli paliek.
 */
export function revertMixedLanguageTextNodes(originalHtml: string, translatedHtml: string): string {
  const orig = textNodesOf(originalHtml);
  const next = textNodesOf(translatedHtml);
  if (orig.length !== next.length) return translatedHtml;
  let i = 0;
  return translatedHtml.replace(TEXT_NODE_OR_BLOCK, (all, block: string | undefined, _tag, text: string | undefined) => {
    if (block) return block;
    const before = orig[i++] ?? "";
    const after = text ?? "";
    if (after === before) return all;
    const decoded = decodeText(after.replace(/\s+/g, " ").trim());
    if (/\(oriģināls\)/i.test(decoded) || !htmlTextStillLatvian(decoded)) return all;
    return `>${before}<`;
  });
}

/** Pilns bez-AI tulkojums PDF HTML: statiskā vārdnīca + frāzes/termini; jaukti mezgli atjaunoti AI gājienam. */
export function applyClientReportSweepTranslations(html: string, lang: ClientReportLang): string {
  if (lang === "lv") return html;
  const swept = applyClientReportDynamicTranslations(applyClientReportStaticTranslations(html, lang), lang);
  return revertMixedLanguageTextNodes(html, swept);
}
