/**
 * Deterministiski „Labot” šabloni faktu pārbaudei. Nav maksas modeļa.
 * Ievieto teikumu vai labo skaitli; virsrakstus un treknrakstu neņem ārā.
 */
import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export type FactCheckSuggestedFix = {
  preview: string;
  mode: "append" | "replace";
  find?: string;
  replace?: string;
};

function escapeHtmlPlain(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dash(s: string): string {
  return applyProvinHumanDashes(s.replace(/\u2013|\u2014/g, "-"));
}

function rollbackMentionFromMessage(message: string): string {
  const drop = message.match(/\((\d[\d\s]*)\s*km\)/)?.[1]?.trim();
  const cv = /carvertical/i.test(message);
  const dropBit = drop ? ` odometra kritums (${drop} km)` : " odometra kritums";
  const cvBit = cv ? " CarVertical brīdina par nobraukuma neatbilstību." : "";
  return dash(`Nobraukuma datos fiksēts${dropBit}.${cvBit}`.replace(/\.\s*$/, "."));
}

export function suggestFactCheckFix(flag: FactCheckFlag): FactCheckSuggestedFix | null {
  if (flag.kind === "rollback_omitted") {
    return { preview: rollbackMentionFromMessage(flag.message), mode: "append" };
  }
  if (flag.kind === "rollback_minimised") {
    return {
      preview: dash("Kritums datos nav neliela nobīde - tas ir odometra kritums, kas jāpārbauda."),
      mode: "append",
    };
  }
  if (flag.kind === "owner_count") {
    const m = flag.message.match(/Teksts saka (\d+) īpašniekus, kanoniskā lapa:\s*(\d+)/);
    if (m) {
      return {
        preview: dash(`${m[2]} īpašnieki (pēc lapas).`),
        mode: "replace",
        find: `${m[1]} īpašniek`,
        replace: `${m[2]} īpašniek`,
      };
    }
  }
  if (flag.kind === "owner_changes") {
    const eq = flag.message.match(/^(\d+) īpašnieki nevar būt \1 maiņas \(jābūt (\d+)\)/);
    if (eq) {
      return {
        preview: dash(`${eq[2]} īpašnieku maiņas (N īpašnieki = N-1 maiņas).`),
        mode: "replace",
        find: `${eq[1]} īpašnieku maiņ`,
        replace: `${eq[2]} īpašnieku maiņ`,
      };
    }
    const m = flag.message.match(/Teksts saka (\d+) īpašnieku maiņas;.*lapā maiņas:\s*(\d+)/);
    if (m) {
      return {
        preview: dash(`${m[2]} īpašnieku maiņas (pēc lapas).`),
        mode: "replace",
        find: `${m[1]} īpašnieku maiņ`,
        replace: `${m[2]} īpašnieku maiņ`,
      };
    }
  }
  if (flag.kind === "first_reg_country") {
    const de = /ir (?:DE|Vācij)/i.test(flag.message) && /saka Latviju/i.test(flag.message);
    const lv = /ir (?:LV|Latvij)/i.test(flag.message);
    if (de) {
      return {
        preview: "Pirmā reģistrācija / izcelsme: Vācija.",
        mode: "replace",
        find: "Latvijā",
        replace: "Vācijā",
      };
    }
    if (lv) {
      return {
        preview: "Pirmā reģistrācija / izcelsme: Latvija.",
        mode: "replace",
        find: "Vācijā",
        replace: "Latvijā",
      };
    }
  }
  if (flag.kind === "no_accidents_claim") {
    const n = flag.message.match(/lapā ir (\d+)/)?.[1];
    return {
      preview: dash(
        n
          ? `Lapā fiksētas ${n} negadījumu / zaudējumu rindas - jāpārbauda klātienē.`
          : "Lapā ir negadījumu / zaudējumu rindas - jāpārbauda klātienē.",
      ),
      mode: "append",
    };
  }
  if (flag.kind === "no_recalls_claim" || flag.kind === "recall_denied") {
    const codes = flag.message.match(/datos ir:\s*(.+?)\.?\s*$/)?.[1];
    return {
      preview: dash(
        codes
          ? `Datos ir atsaukuma / kampaņas kodi: ${codes}.`
          : "Datos ir atsaukuma / kampaņas kodi - jāpārbauda, vai izpildīti.",
      ),
      mode: "append",
    };
  }
  if (flag.id === "km_mismatch") {
    const latest = flag.message.match(/jaunākā \((\d[\d\s]*)\s*km\)/)?.[1];
    return {
      preview: dash(
        latest
          ? `Lapas jaunākais odometra rādījums ir ${latest} km.`
          : "Šis skaitlis jāsaskaņo ar lapas jaunāko odometra rādījumu.",
      ),
      mode: "append",
    };
  }
  if (flag.kind === "leak_phrase") {
    return {
      preview: dash("Noņem iekšējo frāzi no klienta teksta."),
      mode: "append",
    };
  }
  return null;
}

export function appendFactCheckSentence(html: string, sentence: string): string {
  const piece = escapeHtmlPlain(dash(sentence.trim()));
  const trimmed = (html ?? "").trim();
  if (!trimmed) return `<p>${piece}</p>`;
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return `${trimmed}<p>${piece}</p>`;
  }
  return `${trimmed} ${dash(sentence.trim())}`;
}

/** Ievieto labojumu. Virsrakstu / <strong> nenoņem; tukšs lauks paliek tukšs, ja nav šablona. */
export function applyFactCheckFixToField(html: string, flag: FactCheckFlag): string {
  const fix = suggestFactCheckFix(flag);
  if (!fix) return html ?? "";
  const raw = html ?? "";
  if (fix.mode === "replace" && fix.find && fix.replace && raw.includes(fix.find)) {
    return raw.replace(fix.find, fix.replace);
  }
  return appendFactCheckSentence(raw, fix.preview);
}

export function factCheckLevelLabel(level: FactCheckFlag["level"]): "Kļūda" | "Jāpārbauda" {
  return level === "E" ? "Kļūda" : "Jāpārbauda";
}

export function factCheckActionLine(flag: FactCheckFlag): string {
  switch (flag.kind) {
    case "rollback_omitted":
      return "Pievieno teikumu par odometra kritumu.";
    case "rollback_minimised":
      return "Precizē, ka kritums nav neliela nobīde.";
    case "owner_count":
    case "owner_changes":
      return "Labo skaitli pēc kanoniskās lapas.";
    case "first_reg_country":
      return "Labo pirmās reģistrācijas valsti pēc lapas.";
    case "no_accidents_claim":
      return "Pievieno, ka lapā ir negadījumu rindas.";
    case "no_damage_claim":
      return "Min bojājumus no lapas (avots, datums), arī bez summas.";
    case "negated_fact":
      return "Labo pēc dīlera darbu skaitiem lapā.";
    case "no_recalls_claim":
    case "recall_denied":
      return "Pievieno atsaukuma kodus no datiem.";
    case "leak_phrase":
    case "atsavinasanai":
      return "Noņem iekšējo frāzi vai pārbaudi avotu.";
    case "unsourced_date":
    case "unsourced":
      return "Pārbaudi avotu vai ignorē, ja frāze nav apgalvojums.";
    default:
      return flag.level === "E" ? "Labo tekstu pēc lapas faktiem." : "Pārbaudi avotu pirms publicēšanas.";
  }
}

export const FACT_CHECK_HELP_LV =
  "Salīdzina komentāra faktus ar šī pasūtījuma datiem. Kļūda: apgalvojums ir pretējs lapai. Jāpārbauda: vajag avotu vai operatora aci. Teksts nemainās, kamēr nespiež Labot un Apstiprināt.";
