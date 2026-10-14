import marksJson from "@/lib/__fixtures__/iriss-ecarstrade/marks.json";
import modelsJson from "@/lib/__fixtures__/iriss-ecarstrade/models.json";

export type EcarstradeMark = { id: number; name: string };
export type EcarstradeModel = { id: number; name: string };
export type EcarstradeMakeCatalog = { id: number; name: string; models: EcarstradeModel[] };

type ModelsFile = Record<string, { id: number; name: string; models: EcarstradeModel[] }>;

const MARKS = marksJson as EcarstradeMark[];
const MODELS = modelsJson as ModelsFile;

const MAKE_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  volkswagen: "volkswagen",
  "mercedes-benz": "mercedes",
  "mercedes benz": "mercedes",
  mercedesbenz: "mercedes",
  mb: "mercedes",
  mercedes: "mercedes",
  skoda: "skoda",
  škoda: "skoda",
  citroen: "citroen",
  citroën: "citroen",
  "land rover": "land rover",
  landrover: "land rover",
  "alfa romeo": "alfa romeo",
  alfa: "alfa romeo",
  "ds automobiles": "ds automobiles",
  ds: "ds automobiles",
  "rolls royce": "rolls-royce",
  "rolls-royce": "rolls-royce",
  mini: "mini",
  bmw: "bmw",
  audi: "audi",
  volvo: "volvo",
  toyota: "toyota",
  kia: "kia",
  hyundai: "hyundai",
  ford: "ford",
  opel: "opel",
  vauxhall: "opel",
  peugeot: "peugeot",
  renault: "renault",
  seat: "seat",
  cupra: "cupra",
  porsche: "porsche",
  tesla: "tesla",
  mazda: "mazda",
  honda: "honda",
  nissan: "nissan",
  mitsubishi: "mitsubishi",
  lexus: "lexus",
  jaguar: "jaguar",
  jeep: "jeep",
  dacia: "dacia",
  fiat: "fiat",
  polestar: "polestar",
  smart: "smart",
  subaru: "subaru",
  suzuki: "suzuki",
  ssangyong: "ssangyong",
  "ssang yong": "ssangyong",
};

/** Autobid `brandId-brand` → markas nosaukums. Volvo=49 ir pārbaudīts IRISS testos. */
export const AUTOBID_BRAND_ID_TO_NAME: Record<string, string> = {
  "49": "Volvo",
};

export function normalizeCatalogKey(raw: string): string {
  return String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[_./,+]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactCatalogKey(raw: string): string {
  return normalizeCatalogKey(raw).replace(/\s+/g, "");
}

const MARKS_BY_KEY = new Map<string, EcarstradeMark>();
for (const mark of MARKS) {
  const key = normalizeCatalogKey(mark.name);
  if (key && !MARKS_BY_KEY.has(key)) MARKS_BY_KEY.set(key, mark);
  const compact = compactCatalogKey(mark.name);
  if (compact && !MARKS_BY_KEY.has(compact)) MARKS_BY_KEY.set(compact, mark);
}
for (const [alias, target] of Object.entries(MAKE_ALIASES)) {
  const mark = MARKS_BY_KEY.get(target) ?? MARKS_BY_KEY.get(normalizeCatalogKey(target));
  if (mark) {
    MARKS_BY_KEY.set(normalizeCatalogKey(alias), mark);
    MARKS_BY_KEY.set(compactCatalogKey(alias), mark);
  }
}

export function ecarstradeMarks(): readonly EcarstradeMark[] {
  return MARKS;
}

export function ecarstradeModelsForMake(makeId: number): readonly EcarstradeModel[] {
  return MODELS[String(makeId)]?.models ?? [];
}

export function resolveEcarstradeMake(raw: string): EcarstradeMark | null {
  const key = normalizeCatalogKey(raw);
  if (!key) return null;
  return MARKS_BY_KEY.get(key) ?? MARKS_BY_KEY.get(compactCatalogKey(raw)) ?? null;
}

export function resolveEcarstradeMakeFromBrandId(brandId: string): EcarstradeMark | null {
  const name = AUTOBID_BRAND_ID_TO_NAME[String(brandId).trim()];
  return name ? resolveEcarstradeMake(name) : null;
}

function modelScore(query: string, catalogName: string): number {
  const qn = normalizeCatalogKey(query);
  const cn = normalizeCatalogKey(catalogName);
  const qc = compactCatalogKey(query);
  const cc = compactCatalogKey(catalogName);
  if (!qn || !cn) return 0;
  if (qn === cn || qc === cc) return 100 + cc.length;
  if (qc.startsWith(cc) && cc.length >= 3) return 80 + cc.length;
  if (cc.startsWith(qc) && qc.length >= 3) return 70 + qc.length;
  if (/^\d+$/.test(cc) && (qc === cc || (qc.startsWith(cc) && qc.length > cc.length && !/\d/.test(qc.slice(cc.length, cc.length + 1))))) {
    return 60 + cc.length;
  }
  const qHead = qn.split(" ")[0] ?? "";
  const cHead = cn.split(" ")[0] ?? "";
  if (qHead && cHead && qHead === cHead && cHead.length >= 3) return 40 + cHead.length;
  return 0;
}

export function resolveEcarstradeModel(makeId: number, raw: string): EcarstradeModel | null {
  const query = String(raw ?? "").trim();
  if (!query) return null;
  let best: EcarstradeModel | null = null;
  let bestScore = 0;
  for (const model of ecarstradeModelsForMake(makeId)) {
    const score = modelScore(query, model.name);
    if (score > bestScore) {
      best = model;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

const TWO_WORD_MAKES = ["land rover", "alfa romeo", "ds automobiles", "rolls royce", "rolls-royce"];

export function splitBrandModel(brandModel: string): { make: string; model: string } {
  const raw = String(brandModel ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { make: "", model: "" };
  const lower = normalizeCatalogKey(raw);
  for (const two of TWO_WORD_MAKES) {
    if (lower === two || lower.startsWith(`${two} `)) {
      const make = raw.split(/\s+/).slice(0, 2).join(" ");
      return { make, model: raw.slice(make.length).trim() };
    }
  }
  const tokens = raw.split(/\s+/);
  return { make: tokens[0] ?? "", model: tokens.slice(1).join(" ") };
}

/** `100-130kw` / `176 kW` no nosaukuma. Pārējo tekstu atstāj. */
export function extractPowerKwFromBrand(brandModel: string): { from: number; to: number; rest: string } | null {
  const raw = String(brandModel ?? "").replace(/[\u2013\u2014]/g, "-");
  const range = raw.match(/(\d{2,4})\s*-\s*(\d{2,4})\s*k\s*w\b/i);
  if (range && range.index != null) {
    const a = Number.parseInt(range[1] ?? "", 10);
    const b = Number.parseInt(range[2] ?? "", 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const rest = `${raw.slice(0, range.index)} ${raw.slice(range.index + range[0].length)}`.replace(/\s+/g, " ").trim();
    return { from: Math.min(a, b), to: Math.max(a, b), rest };
  }
  const one = raw.match(/(\d{2,4})\s*k\s*w\b/i);
  if (one && one.index != null) {
    const n = Number.parseInt(one[1] ?? "", 10);
    if (!Number.isFinite(n)) return null;
    const rest = `${raw.slice(0, one.index)} ${raw.slice(one.index + one[0].length)}`.replace(/\s+/g, " ").trim();
    return { from: n, to: n, rest };
  }
  return null;
}

function splitMakeCandidates(raw: string): string[] {
  return raw
    .split(/\s*(?:[/|,+]|&| un | and )\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveMakesFromBrand(brandModel: string): {
  makes: EcarstradeMark[];
  model: EcarstradeModel | null;
  modelText: string;
} {
  const power = extractPowerKwFromBrand(brandModel);
  const text = power?.rest || String(brandModel ?? "").trim();
  const parts = splitMakeCandidates(text);
  const makes: EcarstradeMark[] = [];
  const seen = new Set<number>();
  let modelText = "";
  const push = (mark: EcarstradeMark | null) => {
    if (!mark || seen.has(mark.id)) return;
    seen.add(mark.id);
    makes.push(mark);
  };
  for (const part of parts) {
    const whole = resolveEcarstradeMake(part);
    if (whole) {
      push(whole);
      continue;
    }
    const split = splitBrandModel(part);
    const make = resolveEcarstradeMake(split.make);
    if (make) {
      push(make);
      if (!modelText && split.model) modelText = stripKnownSuffixes(split.model);
    }
  }
  if (makes.length === 0) {
    const split = splitBrandModel(text);
    push(resolveEcarstradeMake(split.make));
    modelText = stripKnownSuffixes(split.model);
  }
  const model = makes.length === 1 ? resolveEcarstradeModel(makes[0]!.id, modelText) : null;
  return { makes, model, modelText };
}

export function resolveMakeModelFromBrand(brandModel: string): { make: EcarstradeMark | null; model: EcarstradeModel | null; modelText: string } {
  const r = resolveMakesFromBrand(brandModel);
  return { make: r.makes[0] ?? null, model: r.model, modelText: r.modelText };
}

const TRAILING_TOKENS = new Set([
  "diesel",
  "dizelis",
  "dizeļdegviela",
  "petrol",
  "benzins",
  "benzīns",
  "hybrid",
  "hibrids",
  "electric",
  "elektro",
  "automatic",
  "auto",
  "manual",
  "man",
  "avant",
  "variant",
  "estate",
  "kombi",
  "sw",
  "touring",
  "suv",
  "4x4",
  "awd",
  "quattro",
  "xdrive",
]);

export function stripKnownSuffixes(model: string): string {
  const tokens = model.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && TRAILING_TOKENS.has(normalizeCatalogKey(tokens[tokens.length - 1] ?? ""))) {
    tokens.pop();
  }
  return tokens.join(" ");
}
