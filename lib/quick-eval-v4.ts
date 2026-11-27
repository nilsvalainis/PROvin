/**
 * Ātrie vērtējumi -> VIN SCAN v4 (27.11, Nils: «sakārto šo sadaļu!»).
 * Ātrā vērtējuma bezmaksas bloki (sludinājuma vēsture, DK/EE/SE reģistri, CSDD, izsoļu portālu arhīvs)
 * kļūst par parastām v4 rindām, lai kopsavilkums (odometrs, nobraukuma ieraksti, valstis, negadījumi)
 * ņemtu datus no VISIEM avotiem un kartītes būtu vienā sistēmā ar pasūtījumu.
 * Tīra loģika (testējama), UI tikai attēlo.
 */
import type { CsddTechData } from "@/lib/csdd-tech-data";
import type { VinRegistryBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_EXTERNAL_URL } from "@/lib/admin-source-blocks";
import { registryCardFacts, tirgusCardFacts } from "@/lib/quick-eval-cards";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

/** Minimālais v4 rindas veids (sakrīt ar `VinScanV4Row` laukiem, ko lieto kopsavilkums). */
export type QuickEvalV4Row = {
  id: string;
  label: string;
  country: string;
  status: string;
  summary: string;
  detail?: string;
  openUrl: string;
  scannedAt?: string;
  vehicle?: { make: string; model: string; year: string };
  mileage?: { date: string; odometer: string; source?: string; country?: string }[];
  media?: { photoUrl?: string; photoCount?: number };
  incidents?: { date?: string; summary: string }[];
  listings?: { date: string; price?: string; odometer?: string }[];
  flags?: VinScanIndicator["flags"];
  inspections?: VinScanIndicator["inspections"];
  recalls?: VinScanIndicator["recalls"];
  auctions?: VinScanIndicator["auctions"];
};

/** Ātrā vērtējuma kartītes, kurām v4 jau zīmē rindu (VIN SCAN rindu ar tādu pašu id nedublē). */
const OWN_BLOCK_IDS = ["csdd", "listing_history", "tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const;

const REGISTRY_ROWS = [
  { key: "tjekbil", label: "Dānija · tjekbil", country: "DK" },
  { key: "mnt_ee", label: "Igaunija · MNT", country: "EE" },
  { key: "lkf_ee", label: "Igaunija · LKF (OCTA)", country: "EE" },
  { key: "carinfo", label: "Zviedrija · car.info", country: "SE" },
] as const;

/** Seed daļas, kas nozīmē «CSDD šo auto nezina» (ārzemju auto), nevis kļūdu. */
const CSDD_NOT_LV_PARTS = new Set(["not_found", "skip", "no_vin"]);

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function titleCase(slug: string): string {
  const t = slug.replace(/[-_]+/g, " ").trim();
  if (!t) return "";
  // «bmw», «vw» - saīsinājumi lielajiem burtiem; pārējais «Renault», «Laguna».
  if (t.length <= 3) return t.toUpperCase();
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** ss.com / ss.lv sludinājuma saite -> marka un modelis no ceļa (…/transport/cars/renault/laguna/xxx.html). */
export function ssListingMakeModel(url: string | null | undefined): { make: string; model: string } | null {
  const m = /\/transport\/cars\/([a-z0-9-]+)\/([a-z0-9-]+)\/[^/]+\.html/i.exec(s(url));
  if (!m) return null;
  const make = titleCase(m[1]!);
  const model = /^(other|citi|citas)$/i.test(m[2]!) ? "" : titleCase(m[2]!);
  return make ? { make, model } : null;
}

function filled<T extends object>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => Object.values(r).some((v) => s(v)));
}

function registryHasData(b: VinRegistryBlockState): boolean {
  return filled(b.mileage).length > 0 || filled(b.incidents).length > 0 || filled(b.timeline).length > 0 || Boolean(s(b.ownersSummary));
}

function kmText(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
}

function listingRow(blocks: WorkspaceSourceBlocks, listingUrl: string, at: string | undefined): QuickEvalV4Row | null {
  const t = blocks.tirgus;
  const facts = tirgusCardFacts(t);
  if (!facts.length) return null;
  const mileage: NonNullable<QuickEvalV4Row["mileage"]> = [];
  const seen = new Set<string>();
  const push = (date: string, odometer: string) => {
    if (!date || !odometer) return;
    const key = `${date}|${odometer.replace(/\D+/g, "")}`;
    if (seen.has(key)) return;
    seen.add(key);
    mileage.push({ date, odometer, source: "Sludinājums" });
  };
  for (const r of t.priceHistory ?? []) push(s(r.date), kmText(r.mileage));
  push(s(t.listingMileageDate) || s(t.listingCreated), s(t.listingMileageOdometer));
  const newest = (t.priceHistory ?? []).find((r) => Number.isFinite(r.price) && r.price > 0);
  const year = (t.priceHistory ?? []).map((r) => r.year).find((y) => typeof y === "number" && y > 1950);
  const listingDate = s(t.listingMileageDate) || s(t.listingCreated) || s(newest?.date);
  return {
    id: "listing_history",
    label: "Sludinājuma vēsture",
    // Sludinājums LV portālā nenozīmē LV reģistrāciju - «Valstis» to neskaita.
    country: "",
    status: "found",
    summary: facts.map((f) => `${f.label} ${f.value}`).join(" · "),
    openUrl: listingUrl ? `https://adify.lv/history?url=${encodeURIComponent(listingUrl)}` : "https://adify.lv/history",
    ...(at ? { scannedAt: at } : {}),
    ...(year ? { vehicle: { make: "", model: "", year: String(year) } } : {}),
    mileage,
    listings: listingDate
      ? [
          {
            date: listingDate,
            ...(newest ? { price: `${Math.round(newest.price)} €` } : {}),
            ...(s(t.listingMileageOdometer) ? { odometer: s(t.listingMileageOdometer) } : {}),
          },
        ]
      : [],
  };
}

function registryRow(
  r: (typeof REGISTRY_ROWS)[number],
  block: VinRegistryBlockState,
  at: string | undefined,
): QuickEvalV4Row | null {
  if (!registryHasData(block)) return null;
  const facts = registryCardFacts(block);
  return {
    id: r.key,
    label: r.label,
    country: r.country,
    status: "found",
    summary: facts.map((f) => `${f.label}: ${f.value}`).join(" · "),
    openUrl: SOURCE_BLOCK_EXTERNAL_URL[r.key] ?? "",
    ...(block.fetchedAt || at ? { scannedAt: block.fetchedAt || at } : {}),
    mileage: filled(block.mileage)
      .filter((m) => s(m.odometer))
      .map((m) => ({ date: s(m.date), odometer: s(m.odometer), source: r.label, country: s(m.country).toUpperCase() || r.country })),
    incidents: filled(block.incidents).map((i) => ({
      date: s(i.date),
      summary: [s(i.note), s(i.amount)].filter(Boolean).join(" · ") || "Negadījums",
    })),
  };
}

export type QuickEvalV4Input = {
  blocks: WorkspaceSourceBlocks | null | undefined;
  parts: Record<string, string | undefined>;
  sourceAt: Record<string, string | undefined>;
  seedAt: string | null;
  listingUrl: string;
  vinScan: { at: string; indicators: readonly VinScanIndicator[] } | null;
  ccVin: { at: string; count: number | null } | null;
  ccVinUrl: string;
};

export type QuickEvalV4View = {
  rows: QuickEvalV4Row[];
  /** CSDD API dati (1. solis), ja CSDD auto zina. */
  csdd: CsddTechData | null;
  /** Ārzemju auto: CSDD to nezina - rāda pelēku «Nav LV reģistrā», nevis sarkanu «Nav datu». */
  csddNotLv: boolean;
  /** Ātrā vērtējuma kartītes (id), kuras jau zīmē v4 - režģī tās vairs nerāda. */
  absorbed: Set<string>;
  /** «Renault Laguna» no CSDD / avotiem / sludinājuma saites; tukšs, ja nekur nav. */
  title: string;
  year: string;
};

/** Ātrā vērtējuma bloki + kopīgais VIN SCAN -> v4 rindas, CSDD un virsraksts. */
export function buildQuickEvalV4View(input: QuickEvalV4Input): QuickEvalV4View {
  const blocks = input.blocks ?? null;
  const at = (part: string) => input.sourceAt[part] ?? input.seedAt ?? undefined;
  const scan = input.vinScan?.indicators ?? [];
  const absorbed = new Set<string>();
  const own = new Map<string, QuickEvalV4Row>();

  if (blocks) {
    const listing = listingRow(blocks, input.listingUrl, at("listing"));
    if (listing) {
      own.set("listing_history", listing);
      absorbed.add("listing");
    }
    for (const r of REGISTRY_ROWS) {
      const row = registryRow(r, blocks[r.key], at(r.key));
      if (row) {
        own.set(r.key, row);
        absorbed.add(r.key);
      }
    }
  }

  const rows: QuickEvalV4Row[] = [];
  for (const ind of scan) {
    const mine = own.get(ind.id);
    const isOwnBlock = (OWN_BLOCK_IDS as readonly string[]).includes(ind.id);
    if (mine) {
      // VIN SCAN rinda ar datiem uzvar; sludinājuma km no ātrā vērtējuma pieliek klāt (nobraukuma punkts).
      if (ind.status === "found") {
        const extra = ind.id === "listing_history" && !(ind.mileage ?? []).length ? { mileage: mine.mileage } : {};
        rows.push({ ...(ind as unknown as QuickEvalV4Row), openUrl: ind.openUrl ?? "", ...extra });
      } else rows.push(mine);
      own.delete(ind.id);
      continue;
    }
    // Ātrā vērtējuma bloki bez datiem paliek «Bez datiem» sarakstā ar «Mēģināt vēlreiz» - v4 tos nedublē.
    if (isOwnBlock && ind.status !== "found") continue;
    rows.push({ ...(ind as unknown as QuickEvalV4Row), openUrl: ind.openUrl ?? "" });
  }
  rows.push(...own.values());

  // Izsoļu portālu arhīvs (checkcar.vin foto skaits no PROVIN skripta) - v4 priekšskatījumu blokā.
  const cc = input.ccVin;
  const ccRow = rows.find((r) => r.id === "checkcar_vin");
  if (typeof cc?.count === "number" && (!ccRow || ccRow.status !== "found")) {
    const row: QuickEvalV4Row = {
      id: "checkcar_vin",
      label: "Izsoļu portālu arhīvs",
      country: "",
      status: cc.count > 0 ? "found" : "none",
      summary: cc.count > 0 ? `${cc.count} foto` : "Foto nav",
      openUrl: input.ccVinUrl,
      scannedAt: cc.at,
      ...(cc.count > 0 ? { media: { photoCount: cc.count } } : {}),
    };
    if (ccRow) rows[rows.indexOf(ccRow)] = row;
    else rows.push(row);
  }

  // CSDD 1. solis: API dati no ātrā vērtējuma; ārzemju auto - «Nav LV reģistrā».
  const reg = blocks?.csdd.registry?.data;
  const csdd: CsddTechData | null = reg && (s(reg.registrationNumber) || s(reg.vin) || s(reg.make)) ? ({ ...reg } as CsddTechData) : null;
  if (csdd) absorbed.add("csdd");
  const scanCsdd = scan.find((r) => r.id === "csdd");
  const part = input.parts.csdd;
  const csddNotLv =
    !csdd &&
    scanCsdd?.status !== "found" &&
    ((part != null && CSDD_NOT_LV_PARTS.has(part)) || scanCsdd?.status === "none" || scanCsdd?.status === "skipped");

  const vehicle = pickTitle(csdd, rows, input.listingUrl);
  return { rows, csdd, csddNotLv, absorbed, title: vehicle.title, year: vehicle.year };
}

const TITLE_RANK = ["csdd", "tjekbil", "rdw", "vegvesen", "carinfo", "cz_rsv", "dvsa_mot", "carfax_eu", "esyn", "biluppgifter", "plc_auction"];

function pickTitle(csdd: CsddTechData | null, rows: readonly QuickEvalV4Row[], listingUrl: string): { title: string; year: string } {
  const year =
    s(csdd?.year) ||
    rows.map((r) => (r.status === "found" ? s(r.vehicle?.year) : "")).find(Boolean) ||
    "";
  if (csdd && (s(csdd.make) || s(csdd.model))) return { title: [s(csdd.make), s(csdd.model)].filter(Boolean).join(" "), year };
  const found = rows.filter((r) => r.status === "found" && (s(r.vehicle?.make) || s(r.vehicle?.model)));
  const ranked = [...found].sort((a, b) => rank(a.id) - rank(b.id));
  const withModel = ranked.find((r) => r.id !== "vin_decode" && s(r.vehicle?.make) && s(r.vehicle?.model));
  if (withModel) return { title: `${s(withModel.vehicle!.make)} ${s(withModel.vehicle!.model)}`, year };
  const ss = ssListingMakeModel(listingUrl);
  if (ss) return { title: [ss.make, ss.model].filter(Boolean).join(" "), year };
  const any = ranked.find((r) => s(r.vehicle?.make));
  if (any) return { title: [s(any.vehicle!.make), s(any.vehicle!.model)].filter(Boolean).join(" "), year };
  const wmi = rows.find((r) => r.id === "vin_decode" && r.status === "found");
  const wmiMake = s(wmi?.summary.split("·")[0]);
  return { title: wmiMake && !/ražot|nav/i.test(wmiMake) ? wmiMake : "", year };
}

function rank(id: string): number {
  const i = TITLE_RANK.indexOf(id);
  return i < 0 ? TITLE_RANK.length + (id === "vin_decode" ? 1 : 0) : i;
}
