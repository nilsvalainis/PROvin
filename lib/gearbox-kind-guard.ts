/**
 * Kanoniskā ātrumkārba AI komentāriem (S-AI1, 27.11.2026).
 *
 * Avoti: dīlera / Outvin / OE kārbas lauks (piem. «MANU»), izsoļu arhīvs («Manuālā»),
 * AutoDNA («Ātrumkārbas veids MANUĀLS»), pārējie konteksta lauki ar kārbas etiķeti.
 * Ja visi avoti saka vienu un to pašu - tā ir patiesība, un tekstam nedrīkst runāt pretī:
 * manuālajai kārbai nav DSG / divsajūga / S tronic / automāta tēmu; hidrotransformatora
 * automātam nav sajūga diska / pedāļa tēmu. Pretrunīgiem avotiem sargs neko neaiztiek.
 */
import { auctionArchiveVehicleRows } from "@/lib/auction-archive-facts";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { splitIntoSentences } from "@/lib/lv-sentences";

/** manual = mehāniskā; dct = divsajūgs; torque_converter = klasiskais automāts / CVT; automatic = automāts bez apakštipa. */
export type GearboxKind = "manual" | "dct" | "torque_converter" | "automatic" | "unknown";
export type GearboxFamily = "manual" | "automatic" | "unknown";

export type GearboxEvidence = { source: string; raw: string; kind: GearboxKind };

export type CanonicalGearbox = {
  kind: GearboxKind;
  family: GearboxFamily;
  /** Latvisks nosaukums promptam / risku kartei. */
  labelLv: string;
  evidence: GearboxEvidence[];
  /** Avoti runā pretī viens otram (manuālā pret automātu) - sargs neaktīvs. */
  conflict: boolean;
};

/** Vārda robežas latviešu burtiem (\b JS strādā tikai ar ASCII). */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
const L = String.raw`\p{L}*`;
const words = (parts: string[]) => new RegExp(`${B}(?:${parts.join("|")})${E}`, "iu");

const DCT_RE = words([
  "dsg", "dct", String.raw`s[\s-]?tronic`, "pdk", String.raw`dq\d{3}${L}`, String.raw`dl\d{3}${L}`, "0am", "0cw", "02e", "0d9",
  "0b5", "0ct", "powershift", "edc", String.raw`dual[\s-]?clutch`, "doppelkupplung", `divsajūg${L}`, `dubultsajūg${L}`,
]);
const TORQUE_CONVERTER_RE = words([
  "tiptronic", "steptronic", "multitronic", "cvt", String.raw`\d?hp\d{2}${L}`, String.raw`zf\s?\d?hp${L}`,
  String.raw`[79]g[\s-]?tronic${L}`, "aisin", String.raw`torque\s*converter`, `hidrotransformator${L}`, `wandler${L}`,
  String.raw`aq\d{3}${L}`, `09g${L}`, `09m${L}`, `0bk${L}`,
]);
const AUTOMATIC_RE = words([
  "auto", "aut", `automat${L}`, `automāt${L}`, "automatique", "automatico", `automatyczn${L}`, "automaattinen", "at", "a/t",
]);
const MANUAL_RE = words([
  "manu", "man", `manu[aā]l${L}`, `manuell${L}`, `manual${L}`, `manuel${L}`, `mehānisk${L}`, `mechani${L}`, `schalt${L}`,
  "handgeschaltet", "mt", "m/t", String.raw`\d\s?-?\s?mt`, "stick", `ręczn${L}`, `käsivalinta${L}`, "manuaalinen",
]);

/** Viena avota vērtība → kārbas tips. Nezināmu vērtību neklasificē. */
export function classifyGearboxRaw(raw: string | null | undefined): GearboxKind {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t || /^[-–—]$/.test(t)) return "unknown";
  const manual = MANUAL_RE.test(t);
  const dct = DCT_RE.test(t);
  const tc = TORQUE_CONVERTER_RE.test(t);
  const auto = AUTOMATIC_RE.test(t);
  if (manual && !dct && !tc && !auto) return "manual";
  if (dct && !manual) return "dct";
  if (tc && !manual) return "torque_converter";
  if (auto && !manual) return "automatic";
  return "unknown";
}

export function gearboxFamily(kind: GearboxKind): GearboxFamily {
  if (kind === "manual") return "manual";
  if (kind === "unknown") return "unknown";
  return "automatic";
}

const KIND_LABEL_LV: Record<GearboxKind, string> = {
  manual: "manuālā (mehāniskā)",
  dct: "automātiskā (divsajūgu)",
  torque_converter: "automātiskā (hidrotransformatora)",
  automatic: "automātiskā",
  unknown: "",
};

const KIND_SHORT_LV: Record<GearboxKind, string> = {
  manual: "manuālā",
  dct: "automātiskā divsajūgu",
  torque_converter: "automātiskā",
  automatic: "automātiskā",
  unknown: "",
};

/**
 * Īss dīlera / OE kods kā «MANU» vai «AUTO» → «manuālā (MANU)». Garus aprakstus atstāj, tikai pieliek tipu,
 * ja tas nav redzams. Nezināmu vērtību atgriež kā ir.
 */
export function decodeGearboxLabelLv(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const kind = classifyGearboxRaw(t);
  if (kind === "unknown") return t;
  const label = KIND_SHORT_LV[kind];
  const looksLikeCode = /^[A-Z0-9/\s-]{1,8}$/.test(t);
  if (looksLikeCode) return `${label} (${t})`;
  if (/manuāl|mehānisk|automātisk/i.test(t)) return t;
  return `${label} (${t})`;
}

/** Etiķete + vērtība brīvā tekstā: «Ātrumkārba: Manuālā», «Ātrumkārbas veids\nMANUĀLS», «Transmission: MANU». */
const CONTEXT_LABEL_RE =
  /(?<![\p{L}\p{N}])(?:ātrumkārb\p{L}*|atrumkarb\p{L}*|pārnesumkārb\p{L}*|transmission|gearbox|gear\s*type|getriebe(?:art)?|växellåda)["']?(?:\s+veids)?[ \t]*(?:[:=\t]|\n|\s-\s)[ \t]*([^\n;|]{2,60})/giu;

function contextEvidence(text: string, source: string): GearboxEvidence[] {
  const out: GearboxEvidence[] = [];
  for (const m of text.matchAll(CONTEXT_LABEL_RE)) {
    const raw = (m[1] ?? "").trim();
    // «Kārba: value=MANU confidence=A» (identifikācijas bloks) - vērtība aiz value=.
    const val = raw.match(/value=([^\s]+)/i)?.[1] ?? raw;
    if (/^value=-?$/i.test(raw)) continue;
    const kind = classifyGearboxRaw(val);
    if (kind !== "unknown") out.push({ source, raw: val, kind });
  }
  return out;
}

export function resolveCanonicalGearbox(input: {
  sourceBlocks?: WorkspaceSourceBlocks | null;
  vin?: string | null;
  /** AI konteksta teksts (avotu bloki, AutoDNA, izsoles) - papildu pierādījumi. */
  contextText?: string | null;
}): CanonicalGearbox {
  const evidence: GearboxEvidence[] = [];
  const add = (source: string, raw: string | null | undefined) => {
    const kind = classifyGearboxRaw(raw);
    if (kind !== "unknown") evidence.push({ source, raw: (raw ?? "").trim(), kind });
  };
  if (input.sourceBlocks) {
    const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
    const ar = blocks.auto_records;
    add("dīleris (labots)", ar.outvinReport?.vehicleInfo?.transmission);
    add("dīleris", getAutoRecordsOutvinBundle(ar, input.vin ?? "").vehicleInfo.transmission);
    const records = blocks.cc_vin?.thecarapiRecords;
    if (records && records.length > 0) {
      try {
        const row = auctionArchiveVehicleRows(records).find((r) => r.k === "Ātrumkārba" && !r.missing);
        add("izsole", row?.v);
      } catch {
        /* bojāts izsoles ieraksts - kārbu ņem no citiem avotiem */
      }
    }
  }
  if (input.contextText) evidence.push(...contextEvidence(input.contextText, "konteksts"));

  const families = new Set(evidence.map((e) => gearboxFamily(e.kind)));
  families.delete("unknown");
  if (families.size === 0) {
    return { kind: "unknown", family: "unknown", labelLv: "", evidence, conflict: false };
  }
  if (families.size > 1) {
    return { kind: "unknown", family: "unknown", labelLv: "", evidence, conflict: true };
  }
  const family = [...families][0] as GearboxFamily;
  let kind: GearboxKind = family === "manual" ? "manual" : "automatic";
  if (family === "automatic") {
    const sub = new Set(evidence.map((e) => e.kind).filter((k) => k === "dct" || k === "torque_converter"));
    if (sub.size === 1) kind = [...sub][0]!;
  }
  return { kind, family, labelLv: KIND_LABEL_LV[kind], evidence, conflict: false };
}

/** Promptam: kārbas patiesība + ko nedrīkst rakstīt. Tukšs, ja kārba nav viennozīmīga. */
export function gearboxPromptBlock(gb: CanonicalGearbox): string {
  if (gb.kind === "unknown") return "";
  const src = [...new Set(gb.evidence.map((e) => `${e.source}: ${e.raw}`))].slice(0, 4).join("; ");
  const lines = ["IELĀDĒTĀ ĀTRUMKĀRBA (nerunā pretī):", `- Kārba: ${gb.labelLv}${src ? ` (${src})` : ""}`];
  if (gb.kind === "manual") {
    lines.push(
      "- Šim auto ir MANUĀLĀ kārba. AIZLIEGTS rakstīt par DSG, S tronic, divsajūgu / dubultsajūgu, mehatroniku, DQ/DL kārbām, Tiptronic, hidrotransformatoru, ATF vai automāta pārslēgšanos - arī ne lai to noliegtu.",
      "- Drīkst: sajūgs (pedālis, ķeršanas punkts, slīdēšana), pārnesumu ieslēgšana, sinhronizatori, divmasu spararats (ja tāds ir).",
    );
  } else if (gb.kind === "torque_converter") {
    lines.push(
      "- Šim auto ir klasiskais (hidrotransformatora) automāts. AIZLIEGTS rakstīt par sajūga disku, sajūga pedāli, DSG / S tronic / divsajūgu vai manuālo kārbu.",
    );
  } else {
    lines.push("- Šim auto ir automātiskā kārba. AIZLIEGTS rakstīt par sajūga pedāli vai manuālo / mehānisko kārbu.");
  }
  return lines.join("\n");
}

/** Manuālajai kārbai aizliegtās tēmas. */
const MANUAL_BANNED_RE = new RegExp(
  [
    String.raw`${B}dsg${L}`,
    String.raw`${B}dct${E}`,
    String.raw`${B}s[\s-]?tronic${L}`,
    String.raw`${B}pdk${E}`,
    String.raw`${B}dq\d{3}${L}`,
    String.raw`${B}dl\d{3}${L}`,
    `divsajūg${L}`,
    `dubultsajūg${L}`,
    String.raw`dual[\s-]?clutch`,
    `mehatronik${L}`,
    String.raw`${B}tiptronic${L}`,
    String.raw`${B}steptronic${L}`,
    `hidrotransformator${L}`,
    String.raw`${B}atf${E}`,
    String.raw`automāt${L}\s+(?:ātrum|pārnesum)?kārb${L}`,
    String.raw`(?:ātrum|pārnesum)?kārb${L}\s+automāt${L}`,
    String.raw`automātisk${L}\s+pārnesumu\s+pārslēg${L}`,
  ].join("|"),
  "iu",
);

/** Hidrotransformatora automātam aizliegtās tēmas. */
const TORQUE_CONVERTER_BANNED_RE = new RegExp(
  [
    String.raw`sajūga\s+(?:disk${L}|pedāl${L}|komplekt${L}|ķeršan${L})`,
    String.raw`${B}dsg${L}`,
    String.raw`${B}s[\s-]?tronic${L}`,
    `divsajūg${L}`,
    `dubultsajūg${L}`,
    String.raw`(?:manuāl|mehānisk)${L}\s+(?:ātrum|pārnesum)?kārb${L}`,
  ].join("|"),
  "iu",
);

/** Jebkuram automātam (arī DSG) aizliegtās tēmas. */
const AUTOMATIC_BANNED_RE = new RegExp(
  String.raw`sajūga\s+pedāl${L}|(?:manuāl|mehānisk)${L}\s+(?:ātrum|pārnesum)?kārb${L}`,
  "iu",
);

function bannedReFor(gb: CanonicalGearbox): RegExp | null {
  if (gb.kind === "manual") return MANUAL_BANNED_RE;
  if (gb.kind === "torque_converter") return TORQUE_CONVERTER_BANNED_RE;
  if (gb.kind === "dct" || gb.kind === "automatic") return AUTOMATIC_BANNED_RE;
  return null;
}

export type GearboxContradiction = { sentence: string; match: string };

/** Teikumi, kas runā pretī ielādētajai kārbai. */
export function findGearboxContradictions(text: string, gb: CanonicalGearbox): GearboxContradiction[] {
  const re = bannedReFor(gb);
  if (!re || !text) return [];
  const out: GearboxContradiction[] = [];
  for (const line of text.split("\n")) {
    for (const s of splitIntoSentences(line)) {
      const m = s.match(re);
      if (m) out.push({ sentence: s.trim(), match: m[0] });
    }
  }
  return out;
}

/** Īss teksts (piem. riska kartes «component») runā pretī kārbai. */
export function textContradictsGearbox(text: string, gb: CanonicalGearbox): boolean {
  const re = bannedReFor(gb);
  return Boolean(re && text && re.test(text));
}

/**
 * Deterministisks pēcfiltrs: izmet teikumus, kas runā pretī kārbai. Virsrakstu bez satura
 * zem tā izmet kopā ar rindkopu (kā EUR filtrs).
 */
export function stripGearboxContradictions(text: string, gb: CanonicalGearbox): string {
  const re = bannedReFor(gb);
  if (!re || !text) return text;
  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split("\n");
      const kept = lines.map((line) =>
        splitIntoSentences(line)
          .filter((s) => !re.test(s))
          .join("")
          .trim(),
      );
      if (lines.length > 1 && kept[0] && !kept.slice(1).some(Boolean)) return "";
      return kept.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
