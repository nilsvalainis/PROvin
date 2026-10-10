/**
 * Ātrā vērtējuma avotu kartītes: no avotu blokiem izvelk dažus galvenos faktus, statusa krāsu,
 * ielasīšanas datumu un saiti. Tīras funkcijas (testējamas), UI tikai attēlo.
 */
import type { CsddFormFields, TirgusFormFields, VinRegistryBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_EXTERNAL_URL } from "@/lib/admin-source-blocks";
import type { ListingPeekTopicId } from "@/lib/listing-peek-comment-presets";
import { vehicleKey } from "@/lib/quick-eval-match";

export type CardTone = "ok" | "warn" | "bad" | "none" | "pending";
export type CardFact = { label: string; value: string; tone?: Exclude<CardTone, "none" | "pending"> };

export type SourceCardModel = {
  id: string;
  title: string;
  tone: CardTone;
  fetchedAt: string | null;
  sourceLabel: string;
  link: string | null;
  facts: CardFact[];
  message: string | null;
  /** Seed daļa „Mēģināt vēlreiz” pogai. */
  retryPart: string | null;
};

export type QuickEvalCardInput = {
  blocks: WorkspaceSourceBlocks;
  parts: Record<string, string | undefined>;
  sourceAt: Record<string, string | undefined>;
  seedAt: string | null;
  peekVin: string;
  listingUrl: string;
  ltab?: { at: string; mark: "clean" | "claims" } | null;
  ccVinCount?: number | null;
  now?: number;
};

const DAY = 24 * 3600 * 1000;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** ISO vai LV datums → ms. */
export function parseDateLoose(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (lv) return Date.UTC(+lv[3]!, +lv[2]! - 1, +lv[1]!);
  const iso = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) return Date.UTC(+iso[1]!, +iso[2]! - 1, iso[3] ? +iso[3] : 1);
  return null;
}

export function formatDateLv(raw: string): string {
  const ms = parseDateLoose(raw);
  if (ms == null) return raw;
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

/** Termiņa krāsa: beidzies → sarkans, < 30 dienām → dzeltens, citādi zaļš. */
export function validityTone(raw: string, now = Date.now()): "ok" | "warn" | "bad" | undefined {
  const ms = parseDateLoose(raw);
  if (ms == null) return undefined;
  if (ms < now) return "bad";
  if (ms - now < 30 * DAY) return "warn";
  return "ok";
}

function validityFact(label: string, raw: string, now: number): CardFact | null {
  if (!raw) return null;
  const tone = validityTone(raw, now);
  const d = formatDateLv(raw);
  const value = tone === "bad" ? `beidzies ${d} ✕` : tone === "warn" ? `līdz ${d} (drīz)` : `līdz ${d} ✓`;
  return { label, value, ...(tone ? { tone } : {}) };
}

function partTone(part: string | undefined, hasData: boolean): CardTone {
  if (hasData) return "ok";
  if (!part) return "pending";
  if (part === "not_found" || part === "no_adify_data" || part === "no_listing_url" || part === "no_vin") return "none";
  if (part === "skip") return "none";
  return "bad";
}

function partMessage(part: string | undefined): string | null {
  switch (part) {
    case undefined:
      return "Vēl nav ielasīts.";
    case "not_found":
      return "Nav ierakstu par šo auto.";
    case "no_adify_data":
      return "Cenu vēsture nav atrasta.";
    case "no_listing_url":
      return "Nav sludinājuma saites.";
    case "no_vin":
      return "Nav VIN (vajag VIN vai numurzīmi).";
    case "no_solver":
      return "Nav captcha risinātāja atslēgas.";
    case "skip":
      return "Nav ierakstu.";
    case "error":
      return "Neizdevās ielasīt.";
    default:
      return part.length > 80 ? `${part.slice(0, 80)}…` : part;
  }
}

export function csddCardFacts(c: CsddFormFields, peekVin: string, now = Date.now()): CardFact[] {
  const r = c.registry?.data;
  const pick = (api: string | undefined, form: string) => s(api) || s(form);
  const facts: CardFact[] = [];
  const makeModel = r ? [s(r.make), s(r.model)].filter(Boolean).join(" ") : s(c.makeModel);
  if (makeModel) facts.push({ label: "Marka, modelis", value: makeModel });
  const plate = pick(r?.registrationNumber, c.registrationNumber);
  const vin = pick(r?.vin, c.vin).toUpperCase();
  if (plate || vin) {
    const peekKey = vehicleKey(peekVin);
    const mismatch =
      peekKey.length === 17 && vin.length === 17 && vehicleKey(vin) !== peekKey;
    facts.push({
      label: "Reģ. nr. · VIN",
      value: [plate, vin].filter(Boolean).join(" · ") + (mismatch ? " (VIN nesakrīt ar klienta!)" : ""),
      ...(mismatch ? { tone: "bad" as const } : {}),
    });
  }
  const first = pick(r?.firstRegistrationIso, c.firstRegistration);
  if (first) facts.push({ label: "Pirmā reģistrācija", value: formatDateLv(first) });
  const year = pick(r?.year, c.modelYear);
  if (year) facts.push({ label: "Izlaiduma gads", value: year });
  const fuel = pick(r?.fuel, c.fuelType);
  const cm3 = pick(r?.displacementCm3, c.engineDisplacementCm3);
  const kw = pick(r?.powerKw, c.enginePowerKw);
  const el = pick(r?.electricPowerKw, c.electricPowerKw);
  const engine = [fuel, cm3 ? `${cm3} cm³` : "", kw ? `${kw} kW` : "", el ? `el. ${el} kW` : ""].filter(Boolean).join(" · ");
  if (engine) facts.push({ label: "Dzinējs", value: engine });
  const color = pick(r?.color, c.color);
  if (color) facts.push({ label: "Krāsa", value: color });
  const cat = pick(r?.cocCategory, c.cocCategory);
  const kind = s(c.vehicleType) || s(r?.vehicleKind);
  const category = kind && cat && !kind.includes(cat) ? `${cat} · ${kind}` : kind || cat;
  if (category) facts.push({ label: "Kategorija", value: category });
  const ta = validityFact("Tehniskā apskate", pick(r?.inspectionValidUntilIso, c.nextInspectionDate), now);
  if (ta) facts.push(ta);
  const octa = validityFact("OCTA", pick(r?.insuranceEndIso, c.insuranceValidUntil), now);
  if (octa) facts.push(octa);
  if (/N1/i.test(category)) {
    const gross = pick(r?.grossMassKg, c.grossMassKg);
    if (gross) facts.push({ label: "Pilnā masa", value: `${gross} kg` });
  }
  return facts;
}

function priceFmt(n: number): string {
  return `${Math.round(n).toLocaleString("lv-LV").replace(/,/g, " ")} €`;
}

export function tirgusCardFacts(t: TirgusFormFields): CardFact[] {
  const facts: CardFact[] = [];
  const days = parseInt(s(t.listedForSale).replace(/\D+/g, ""), 10);
  if (Number.isFinite(days)) facts.push({ label: "Pārdošanā", value: `${days} dienas`, ...(days > 60 ? { tone: "warn" as const } : {}) });
  if (s(t.listingCreated)) facts.push({ label: "Izveidots", value: formatDateLv(s(t.listingCreated)) });
  const rows = (t.priceHistory ?? []).filter((r) => Number.isFinite(r.price) && r.price > 0);
  if (rows.length > 0) {
    const newest = rows[0]!.price;
    const oldest = rows[rows.length - 1]!.price;
    facts.push({ label: "Cena", value: rows.length > 1 ? `${priceFmt(oldest)} → ${priceFmt(newest)}` : priceFmt(newest) });
    const diff = newest - oldest;
    if (rows.length > 1 && diff !== 0) {
      facts.push({ label: "Izmaiņa", value: `${diff > 0 ? "+" : "−"}${priceFmt(Math.abs(diff))}`, tone: diff < 0 ? "warn" : "ok" });
    }
  } else if (s(t.priceDrop)) {
    facts.push({ label: "Cenas izmaiņas", value: `${s(t.priceDrop)} €` });
  }
  if (s(t.listingMileageOdometer)) facts.push({ label: "Odometrs sludinājumā", value: `${s(t.listingMileageOdometer)} km` });
  return facts;
}

function kmFmt(raw: string): string {
  const n = parseInt(raw.replace(/\D+/g, ""), 10);
  return Number.isFinite(n) ? `${n.toLocaleString("lv-LV").replace(/,/g, " ")} km` : raw;
}

export function registryCardFacts(b: VinRegistryBlockState): CardFact[] {
  const facts: CardFact[] = [];
  const mileage = (b.mileage ?? []).filter((r) => s(r.odometer));
  if (mileage.length > 0) {
    const sorted = [...mileage].sort((a, c) => (parseDateLoose(c.date) ?? 0) - (parseDateLoose(a.date) ?? 0));
    const last = sorted[0]!;
    facts.push({ label: "Pēdējais nobraukums", value: `${kmFmt(last.odometer)} (${formatDateLv(last.date)})` });
    facts.push({ label: "Nobraukuma ieraksti", value: String(mileage.length) });
  }
  const incidents = filled(b.incidents);
  facts.push(
    incidents.length > 0
      ? { label: "Negadījumi", value: `${incidents.length}${incidents[0]?.amount ? ` · ${incidents[0].amount}` : ""}`, tone: "bad" }
      : { label: "Negadījumi", value: "nav", tone: "ok" },
  );
  if (s(b.ownersSummary)) facts.push({ label: "Īpašnieki", value: s(b.ownersSummary).split("\n")[0]!.slice(0, 90) });
  if (s(b.statusRecords)) facts.push({ label: "Statusi", value: s(b.statusRecords).split("\n")[0]!.slice(0, 90), tone: "warn" });
  if (s(b.autoNotes)) facts.push({ label: "Piezīmes", value: s(b.autoNotes).split("\n")[0]!.slice(0, 90), tone: "warn" });
  return facts;
}

function filled<T extends object>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => Object.values(r).some((v) => s(v)));
}

function registryHasData(b: VinRegistryBlockState): boolean {
  return filled(b.mileage).length > 0 || filled(b.incidents).length > 0 || filled(b.timeline).length > 0 || Boolean(s(b.ownersSummary));
}

function worstTone(facts: CardFact[], base: CardTone): CardTone {
  if (base !== "ok") return base;
  if (facts.some((f) => f.tone === "bad")) return "bad";
  if (facts.some((f) => f.tone === "warn")) return "warn";
  return "ok";
}

const REGISTRY_CARDS = [
  { key: "tjekbil", title: "Dānija · tjekbil", sourceLabel: "tjekbil.dk" },
  { key: "mnt_ee", title: "Igaunija · MNT", sourceLabel: "mnt.ee" },
  { key: "lkf_ee", title: "Igaunija · LKF (OCTA)", sourceLabel: "lkf.ee" },
  { key: "carinfo", title: "Zviedrija · car.info", sourceLabel: "car.info" },
] as const;

export function buildSourceCards(input: QuickEvalCardInput): SourceCardModel[] {
  const now = input.now ?? Date.now();
  const at = (part: string) => input.sourceAt[part] ?? input.seedAt;
  const cards: SourceCardModel[] = [];

  const csddFacts = csddCardFacts(input.blocks.csdd, input.peekVin, now);
  const csddHas = Boolean(input.blocks.csdd.registry) || csddFacts.length > 0;
  cards.push({
    id: "csdd",
    title: "CSDD reģistrs",
    tone: worstTone(csddFacts, partTone(input.parts.csdd, csddHas)),
    fetchedAt: input.blocks.csdd.registry?.fetchedAt ?? at("csdd"),
    sourceLabel: "e.csdd.lv",
    link: SOURCE_BLOCK_EXTERNAL_URL.csdd,
    facts: csddFacts,
    message: csddHas ? null : partMessage(input.parts.csdd),
    retryPart: "csdd",
  });

  const tFacts = tirgusCardFacts(input.blocks.tirgus);
  const tHas = tFacts.length > 0;
  cards.push({
    id: "listing",
    title: "Sludinājuma vēsture",
    tone: worstTone(tFacts, partTone(input.parts.listing, tHas)),
    fetchedAt: at("listing"),
    sourceLabel: "adify.lv",
    link: input.listingUrl ? `https://adify.lv/history?url=${encodeURIComponent(input.listingUrl)}` : "https://adify.lv/history",
    facts: tFacts,
    message: tHas ? null : partMessage(input.parts.listing),
    retryPart: "listing",
  });

  for (const r of REGISTRY_CARDS) {
    const block = input.blocks[r.key];
    const has = registryHasData(block);
    const facts = has ? registryCardFacts(block) : [];
    cards.push({
      id: r.key,
      title: r.title,
      tone: worstTone(facts, partTone(input.parts[r.key], has)),
      fetchedAt: block.fetchedAt ?? at(r.key),
      sourceLabel: r.sourceLabel,
      link: SOURCE_BLOCK_EXTERNAL_URL[r.key],
      facts,
      message: has ? null : s(block.fetchMessage) || partMessage(input.parts[r.key]),
      retryPart: r.key,
    });
  }

  const ltab = input.ltab ?? null;
  cards.push({
    id: "ltab",
    title: "LTAB · OCTA un zaudējumi",
    tone: ltab ? (ltab.mark === "clean" ? "ok" : "bad") : "none",
    fetchedAt: ltab?.at ?? null,
    sourceLabel: "ltab.lv",
    link: SOURCE_BLOCK_EXTERNAL_URL.ltab,
    facts: ltab ? [{ label: "Rezultāts", value: ltab.mark === "clean" ? "Nav zaudējumu" : "Ir zaudējumi", tone: ltab.mark === "clean" ? "ok" : "bad" }] : [],
    message: ltab ? null : "Bezmaksas, bet jāpārbauda pašam. Atzīmē rezultātu.",
    retryPart: null,
  });

  return cards;
}

/** Fakti pie vēstules tēmām (rāda pelēkā tekstā blakus sagatavēm). */
export function buildLetterFacts(input: QuickEvalCardInput): Partial<Record<ListingPeekTopicId, string>> {
  const now = input.now ?? Date.now();
  const out: Partial<Record<ListingPeekTopicId, string>> = {};
  const odo: string[] = [];
  let incidents = 0;
  for (const r of REGISTRY_CARDS) {
    const b = input.blocks[r.key];
    const m = (b.mileage ?? []).filter((x) => s(x.odometer));
    if (m.length > 0) {
      const last = [...m].sort((a, c) => (parseDateLoose(c.date) ?? 0) - (parseDateLoose(a.date) ?? 0))[0]!;
      odo.push(`${r.sourceLabel}: ${kmFmt(last.odometer)} (${formatDateLv(last.date)})`);
    }
    incidents += filled(b.incidents).length;
  }
  const listingOdo = s(input.blocks.tirgus.listingMileageOdometer);
  if (listingOdo) odo.push(`sludinājumā: ${kmFmt(listingOdo)}`);
  if (odo.length) out.odometer = odo.join(" · ");
  const inc: string[] = [];
  if (incidents > 0) inc.push(`ārzemju reģistros ${incidents} negadījumi`);
  else if (odo.length) inc.push("ārzemju reģistros negadījumu nav");
  if (input.ltab) inc.push(`LTAB: ${input.ltab.mark === "clean" ? "nav zaudējumu" : "ir zaudējumi"}`);
  if (inc.length) out.incidents = inc.join(" · ");
  const csdd = csddCardFacts(input.blocks.csdd, input.peekVin, now).filter((f) => f.label === "Tehniskā apskate" || f.label === "OCTA");
  if (csdd.length) out.technical = csdd.map((f) => `${f.label}: ${f.value}`).join(" · ");
  const t = tirgusCardFacts(input.blocks.tirgus).filter((f) => f.label === "Pārdošanā" || f.label === "Izmaiņa");
  if (t.length) out.seller = t.map((f) => `${f.label}: ${f.value}`).join(" · ");
  if (typeof input.ccVinCount === "number") out.photos = `CC-VIN: ${input.ccVinCount} foto`;
  return out;
}

/** Saraksta rindas punkti (CSDD, sludinājums, DK, MNT, LKF, SE). */
export function listDots(input: QuickEvalCardInput): Array<{ id: string; title: string; tone: CardTone }> {
  return buildSourceCards(input)
    .filter((c) => c.id !== "ltab")
    .map((c) => ({ id: c.id, title: c.title, tone: c.tone }));
}

/** Variants A: gaišs, blīvs panelis. Krāsas = PROVIN admin (zils #0066ff, pelēkas virsmas). */
export const QE_TONE_BAR: Record<CardTone, string> = {
  ok: "border-t-emerald-500",
  warn: "border-t-amber-500",
  bad: "border-t-rose-500",
  none: "border-t-slate-300",
  pending: "border-t-slate-200",
};
export const QE_TONE_DOT: Record<CardTone, string> = {
  ok: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-rose-600",
  none: "bg-slate-300",
  pending: "bg-slate-200 ring-1 ring-slate-300",
};
