/**
 * Klienta atskaites (EN/RU/DE) teksti, ko statiskā vārdnīca nevar noķert: frāzes ar skaitļiem un valstu nosaukumi.
 * Darbojas tikai teksta mezglos (starp `>` un `<`), ne atribūtos / CSS / skriptā. FABLE 25.10: EN/RU/DE PDF palika
 * "3 ieraksti bez pretrunām", "Aptuveni 29 mēneši bez ierakstiem", "2. īpašnieks Latvijā", "Vācija/Dānija".
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { ISO2_TO_LV_NAME } from "@/lib/country-names-lv";

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
    re: /(?<![\p{L}\p{N}])Jaunākais:/gu,
    to: { en: () => "Latest:", ru: () => "Последний:", de: () => "Neuester:" },
  },
];

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
      block ? block : `>${translateTextNode(text ?? "", lang)}<`,
    );
  return head + body;
}
