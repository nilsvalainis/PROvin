/**
 * Finnik / RDW (Nīderlande) PDF un ielīmēta teksta parseris.
 * Viens ceļš PDF augšupielādei un Copilot. Oficiālajā nobraukumā tikai
 * „Kilometerstand gerapporteerd”. Punktu tūkstošu atdalītājs nav decimāldaļa.
 */
import {
  emptyVinRegistryBlock,
  sortVinRegistryMileage,
  sortVinRegistryTimeline,
  type VinRegistryBlockState,
  type VinRegistryMileageRow,
  type VinRegistryTimelineRow,
} from "@/lib/admin-source-blocks";
import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";

const NL = "Nīderlande";
const DATE_ONLY = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const HISTORY_TITLE =
  /^(Geëxporteerd|Nieuwe eigenaar type:.*|Kilometerstand gerapporteerd|Vermoedelijke kilometerstand|APK gekeurd.*|Auto te koop aangeboden.*)$/i;
const OWNER_TYPE =
  /^(Importeur|Autobedrijf|Lease|Overig zakelijk|Rechtspersoon)(?:\([A-Z]\))?$/i;
const OWNER_ONE_LINE =
  /^((?:Importeur|Autobedrijf|Lease|Overig zakelijk|Rechtspersoon)(?:\([A-Z]\))?)(\d{1,2}-\d{1,2}-\d{4})\s*-\s*(\d{1,2}-\d{1,2}-\d{4}|Heden|present)$/i;
const OPTION_STOP =
  /^(Fabrieksopties|Totale kosten|Waarde-informatie|Waarde-indicatie|Marktwaardering|Concurrentie|Statistieken|Basisgegevens|Milieu|Milieuzones|Stickers|Fun Facts|Diefstal|Diefstalcheck|Technische gegevens|Technical Information|Elektrische informatie)$/i;

export type FinnikTaxi = "ja" | "nee";

export type FinnikParsedReport = {
  plate: string;
  taxi: FinnikTaxi | null;
  fuel: string;
  firstRegistration: string;
  exportStatus: FinnikTaxi | null;
  exportDate: string;
  parallelImport: FinnikTaxi | null;
  recalls: string;
  apkValidUntil: string;
  apkValidUnknown: boolean;
  plateInvalid: boolean;
  ownersSummary: string;
  statusRecords: string;
  mileage: VinRegistryMileageRow[];
  timeline: VinRegistryTimelineRow[];
  aiContextRaw: string;
};

function linesOf(text: string): string[] {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0 && !/^Page \d+ of \d+$/i.test(line));
}

export function looksLikeFinnikReport(text: string): boolean {
  return /finnik\.nl|kilometerstand gerapporteerd|apk gekeurd/i.test(text);
}

/** Nīderlandes km: „101.303”, „8.686”, „2 2 2 . 9 4 8”, „3 0”. Punkts nav decimāldaļa. */
export function parseDutchOdometer(raw: string): string | null {
  let s = raw.replace(/\u00a0/g, " ").replace(/\bkm\b/gi, "").trim();
  s = s.replace(/[()]/g, "").trim();
  if (!s || !/^[\d.\s]+$/.test(s)) return null;
  const tokens = s.split(/\s+/).filter(Boolean);
  const spacedDigits = tokens.length > 1 && tokens.every((token) => token === "." || /^\d$/.test(token));
  const digits = (spacedDigits ? tokens.join("") : s).replace(/\D/g, "");
  if (!digits || digits.length > 7) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

export function formatFinnikDateLv(raw: string): string {
  const m = DATE_ONLY.exec(raw.trim());
  if (!m) return raw.trim();
  return `${m[1]!.padStart(2, "0")}.${m[2]!.padStart(2, "0")}.${m[3]}`;
}

function nextValue(lines: string[], index: number): string {
  return lines[index + 1] ?? "";
}

function yn(raw: string): FinnikTaxi | null {
  if (/^(ja|yes)$/i.test(raw.trim())) return "ja";
  if (/^(nee|no)$/i.test(raw.trim())) return "nee";
  return null;
}

function ownerLabelLv(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("import")) return "Importētājs";
  if (s.includes("lease") || s.includes("verhuur")) return "Līzinga uzņēmums";
  if (s.includes("rechtspersoon") || s.includes("zakelijk")) return "Juridiska persona";
  if (s.includes("bedrijf")) return "Autosalons";
  return "Īpašnieks";
}

function endLabel(raw: string): string {
  return /^(heden|present)$/i.test(raw.trim()) ? "šobrīd" : formatFinnikDateLv(raw.trim());
}

type OwnerSpan = { label: string; from: string; to: string };

function parseOwnerChain(lines: string[]): OwnerSpan[] {
  const start = lines.findIndex((line) => /^Eigenarenoverzicht/i.test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, i) => i > start && /^Voertuigstatus/i.test(line));
  const slice = lines.slice(start + 1, end < 0 ? lines.length : end);
  const out: OwnerSpan[] = [];
  for (let i = 0; i < slice.length; i++) {
    const one = OWNER_ONE_LINE.exec(slice[i]!.replace(/\s+/g, ""));
    if (one) {
      out.push({
        label: ownerLabelLv(one[1]!),
        from: formatFinnikDateLv(one[2]!),
        to: endLabel(one[3]!),
      });
      continue;
    }
    if (!OWNER_TYPE.test(slice[i]!)) continue;
    const fromRaw = (slice[i + 1] ?? "").replace(/-$/, "").trim();
    const toRaw = (slice[i + 2] ?? "").trim();
    if (!DATE_ONLY.test(fromRaw)) continue;
    if (!DATE_ONLY.test(toRaw) && !/^(heden|present)$/i.test(toRaw)) continue;
    out.push({
      label: ownerLabelLv(slice[i]!),
      from: formatFinnikDateLv(fromRaw),
      to: endLabel(toRaw),
    });
    i += 2;
  }
  return out;
}

type HistoryEvent = { date: string; title: string; body: string[] };

function parseHistory(lines: string[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!DATE_ONLY.test(lines[i]!)) continue;
    const title = lines[i + 1] ?? "";
    if (!HISTORY_TITLE.test(title)) continue;
    const body: string[] = [];
    let j = i + 2;
    for (; j < lines.length; j++) {
      if (/^Eigenarenoverzicht/i.test(lines[j]!)) break;
      if (DATE_ONLY.test(lines[j]!) && HISTORY_TITLE.test(lines[j + 1] ?? "")) break;
      body.push(lines[j]!);
    }
    events.push({ date: formatFinnikDateLv(lines[i]!), title: title.trim(), body });
    i = j - 1;
  }
  return events;
}

function apkFindings(body: string[]): string[] {
  const out: string[] = [];
  let code = "";
  for (const line of body) {
    const codeMatch = /^Code\s*-\s*(\d+)\s*:?\s*$/i.exec(line) ?? /^Code\s*-\s*(\d+)\s*:\s*(.+)$/i.exec(line);
    if (codeMatch) {
      code = codeMatch[1]!;
      if (codeMatch[2]?.trim()) out.push(`kods ${code}: ${codeMatch[2].trim()}`);
      continue;
    }
    const bullet = line.replace(/^[•·*-]\s*/, "").trim();
    if (!bullet || /^er zijn geen problemen/i.test(bullet)) continue;
    if (code && !/^apk/i.test(bullet)) {
      out.push(`kods ${code}: ${bullet}`);
      code = "";
    }
  }
  return out;
}

function findPlate(lines: string[], raw: string): string {
  const compact = raw.replace(/\s+/g, "");
  const fromUrl = /vehicle-id-number=([a-z0-9]{6})/i.exec(compact);
  if (fromUrl) return fromUrl[1]!.toLowerCase();
  for (const line of lines.slice(0, 40)) {
    if (/^[A-Z]{1,3}-\d{2,3}-[A-Z]{1,3}$/.test(line)) return line;
    if (/^[a-z]{1,2}\d{2,3}[a-z]{1,2}$/i.test(line)) return line.toLowerCase();
  }
  return "";
}

function labeledDate(lines: string[], label: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    const same = label.exec(lines[i]!);
    if (same?.[1] && DATE_ONLY.test(same[1])) return formatFinnikDateLv(same[1]);
    if (label.test(lines[i]!) && DATE_ONLY.test(nextValue(lines, i))) {
      return formatFinnikDateLv(nextValue(lines, i));
    }
  }
  return "";
}

function fuelOf(lines: string[], raw: string): string {
  for (let i = 0; i < lines.length; i++) {
    if (/^BRANDSTOF$/i.test(lines[i]!)) {
      const v = nextValue(lines, i).toLowerCase();
      if (v.includes("elektr")) return "elektrība";
      if (v.includes("diesel")) return "dīzelis";
      if (v.includes("benz")) return "benzīns";
    }
  }
  if (/volledig elektrisch\s*ja|electric motor|stroomverbruik/i.test(raw.replace(/\s+/g, " "))) return "elektrība";
  return "";
}

function consumptionOf(raw: string): string {
  const compact = raw.replace(/\s+/g, " ");
  const match =
    /Stroomverbruik Gemiddeld\s*([0-9]+[.,][0-9]+)\s*kWh/i.exec(compact) ??
    /Gemiddeld stroomverbruik\s*([0-9]+[.,][0-9]+)\s*kWh/i.exec(compact);
  if (!match) return "";
  if (/^248[.,]9$/.test(match[1]!)) return "";
  return `${match[1]} kWh/100 km`;
}

function optionsOf(lines: string[]): string[] {
  const start = lines.findIndex((line) => /^Opties en accessoires/i.test(line));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (OPTION_STOP.test(line) || /^Page \d+ of \d+$/i.test(line)) break;
    if (/^(Niet standaard|soms handig|Facebook|Instagram|TikTok)/i.test(line)) continue;
    if (/€|euro|bpm|bijtelling|nieuwprijs|wegenbelasting/i.test(line)) continue;
    if (line.length < 2 || line.length > 80) continue;
    out.push(line);
    if (out.length >= 80) break;
  }
  return out;
}

function pushUniqueKm(rows: VinRegistryMileageRow[], row: VinRegistryMileageRow) {
  const key = `${row.date}|${row.odometer}`;
  if (rows.some((item) => `${item.date}|${item.odometer}` === key)) return;
  rows.push(row);
}

export function parseFinnikReport(text: string): FinnikParsedReport | null {
  if (!looksLikeFinnikReport(text)) return null;
  const lines = linesOf(text);
  const plate = findPlate(lines, text);
  let taxi: FinnikTaxi | null = null;
  let exportStatus: FinnikTaxi | null = null;
  let parallelImport: FinnikTaxi | null = null;
  let recalls = "";
  let apkValidUntil = "";
  let apkValidUnknown = false;
  let plateInvalid = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = nextValue(lines, i);
    if (/^TAXI$/i.test(line) && taxi == null) taxi = yn(next);
    const taxiSame = /^TAXI\s+(Ja|Nee|Yes|No)$/i.exec(line);
    if (taxiSame && taxi == null) taxi = yn(taxiSame[1]!);

    if (/^Geëxporteerd$/i.test(line)) {
      const flag = yn(next);
      if (flag) exportStatus = flag;
    }
    const exportSame = /^Geëxporteerd(Ja|Nee)$/i.exec(line);
    if (exportSame) exportStatus = yn(exportSame[1]!);

    if (/^Parallel geïmporteerd$/i.test(line) && parallelImport == null) parallelImport = yn(next);
    const parallelSame = /^Parallel geïmporteerd(Ja|Nee)$/i.exec(line);
    if (parallelSame) parallelImport = yn(parallelSame[1]!);

    if (/^Terugroepacties$/i.test(line) && !recalls) {
      if (/^(geen|nee)$/i.test(next)) recalls = "nav";
      else if (/^\d+$/.test(next)) recalls = next;
    }
    const recallSame = /^Terugroepacties(Geen|Nee|\d+)$/i.exec(line);
    if (recallSame && !recalls) {
      recalls = /^(geen|nee)$/i.test(recallSame[1]!) ? "nav" : recallSame[1]!;
    }

    if (/^(APK GELDIG TOT|Vervaldatum APK)$/i.test(line)) {
      if (/^onbekend$/i.test(next)) apkValidUnknown = true;
      else if (DATE_ONLY.test(next)) apkValidUntil = formatFinnikDateLv(next);
    }
    const apkSame = /^Vervaldatum APK(\d{1,2}-\d{1,2}-\d{4}|Onbekend)$/i.exec(line);
    if (apkSame) {
      if (/^onbekend$/i.test(apkSame[1]!)) apkValidUnknown = true;
      else apkValidUntil = formatFinnikDateLv(apkSame[1]!);
    }
    if (/^Status kenteken$/i.test(line) && /^ongeldig$/i.test(next)) plateInvalid = true;
    if (/^Status kentekenGeëxporteerd$/i.test(line)) plateInvalid = true;
    if (/^Ongeldig$/i.test(line) && /^ja$/i.test(next)) plateInvalid = true;
    if (/^OngeldigJa$/i.test(line)) plateInvalid = true;
  }

  const firstRegistration =
    labeledDate(lines, /^Eerste toelating nationaal(\d{1,2}-\d{1,2}-\d{4})?$/i) ||
    labeledDate(lines, /^NEDERLANDSE TENAAMSTELLING$/i);
  const fuel = fuelOf(lines, text);
  const history = parseHistory(lines);
  const owners = parseOwnerChain(lines);

  const mileage: VinRegistryMileageRow[] = [];
  const presumed: { date: string; km: string }[] = [];
  const listings: { date: string; km: string }[] = [];
  const apk: { date: string; findings: string[]; clean: boolean }[] = [];
  let exportDate = "";
  const historyOwners: { date: string; label: string }[] = [];

  for (const event of history) {
    if (/^Kilometerstand gerapporteerd/i.test(event.title)) {
      const km = parseDutchOdometer(event.body[0] ?? "") ?? parseDutchOdometer(event.title);
      if (km) {
        pushUniqueKm(mileage, { date: event.date, odometer: km, country: NL, origin: "RDW" });
      }
      continue;
    }
    if (/^Vermoedelijke kilometerstand/i.test(event.title)) {
      const km = parseDutchOdometer(event.body[0] ?? "");
      if (km) presumed.push({ date: event.date, km });
      continue;
    }
    if (/^Auto te koop/i.test(event.title)) {
      const kmLine = event.body.find((line) => /km/i.test(line)) ?? "";
      const km = parseDutchOdometer(kmLine);
      listings.push({ date: event.date, km: km ?? "" });
      continue;
    }
    if (/^APK gekeurd/i.test(event.title)) {
      const findings = apkFindings(event.body);
      const clean = findings.length === 0 || event.body.some((line) => /geen problemen/i.test(line));
      if (!apk.some((item) => item.date === event.date)) {
        apk.push({ date: event.date, findings: clean ? [] : findings, clean });
      }
      continue;
    }
    if (/^Geëxporteerd$/i.test(event.title)) {
      exportDate = event.date;
      if (exportStatus == null) exportStatus = "ja";
      continue;
    }
    if (/^Nieuwe eigenaar/i.test(event.title)) {
      const blob = `${event.title} ${event.body.join(" ")}`;
      historyOwners.push({ date: event.date, label: ownerLabelLv(blob) });
    }
  }

  const ownerSpans =
    owners.length > 0
      ? owners
      : historyOwners.map((row) => ({ label: row.label, from: row.date, to: "" }));
  const ownersSummary = ownerSpans
    .map((row) => (row.to ? `${row.from}-${row.to} ${row.label}` : `${row.from} ${row.label}`))
    .join("\n");

  const kmByDate = new Map<string, string>();
  for (const row of mileage) {
    if (!kmByDate.has(row.date)) kmByDate.set(row.date, row.odometer);
  }

  type Day = { first?: true; owner?: string; apk?: true; exported?: true; km?: string };
  const days = new Map<string, Day>();
  const day = (date: string): Day => {
    const cur = days.get(date) ?? {};
    days.set(date, cur);
    return cur;
  };
  if (firstRegistration) day(firstRegistration).first = true;
  for (const row of ownerSpans) day(row.from).owner = row.label;
  for (const row of apk) day(row.date).apk = true;
  if (exportDate) day(exportDate).exported = true;
  for (const [date, km] of kmByDate) day(date).km = km;

  const timeline: VinRegistryTimelineRow[] = [];
  const dates = [...days.keys()].sort((a, b) => a.split(".").reverse().join("").localeCompare(b.split(".").reverse().join("")));
  for (const date of dates) {
    const item = days.get(date)!;
    const cards: { event: string; odometer: string }[] = [];
    if (item.first) cards.push({ event: "Pirmā reģistrācija", odometer: "" });
    if (item.owner) cards.push({ event: `Īpašnieks: ${item.owner}`, odometer: "" });
    if (item.apk) cards.push({ event: "Tehniskā apskate", odometer: "" });
    if (item.exported) cards.push({ event: "Eksportēts", odometer: "" });
    const host =
      cards.find((card) => card.event === "Tehniskā apskate") ??
      cards.find((card) => card.event.startsWith("Īpašnieks")) ??
      cards.find((card) => card.event === "Eksportēts") ??
      cards.find((card) => card.event === "Pirmā reģistrācija");
    if (item.km && host) host.odometer = item.km;
    else if (item.km) cards.push({ event: "Nobraukums reģistrā", odometer: item.km });
    for (const card of cards) {
      timeline.push({ date, odometer: card.odometer, country: NL, event: card.event });
    }
  }

  const statusLines: string[] = [];
  if (plate) statusLines.push(`Numurs: ${plate}`);
  if (fuel) statusLines.push(`Degviela: ${fuel}`);
  if (taxi === "ja") statusLines.push("TAXI: Jā");
  if (taxi === "nee") statusLines.push("TAXI: Nē");
  if (exportDate) statusLines.push(`Eksports: ${exportDate}`);
  else if (exportStatus === "ja") statusLines.push("Eksports: Jā");
  else if (exportStatus === "nee") statusLines.push("Eksports: Nē");
  if (parallelImport === "ja") statusLines.push("Paralēlais imports: Jā");
  if (parallelImport === "nee") statusLines.push("Paralēlais imports: Nē");
  if (recalls === "nav") statusLines.push("Atsaukumi: nav");
  else if (recalls) statusLines.push(`Atsaukumi: ${recalls} (bez apraksta)`);
  if (apkValidUntil) statusLines.push(`APK derīga līdz: ${apkValidUntil}`);
  else if (apkValidUnknown) statusLines.push("APK derīga līdz: nav datu");
  if (plateInvalid) statusLines.push("Numura statuss: nederīgs");
  const statusRecords = statusLines.join("\n");

  const context: string[] = ["Nīderlandes oficiālie reģistri", ...statusLines];
  if (firstRegistration) context.push(`Pirmā reģistrācija Nīderlandē: ${firstRegistration}`);
  if (ownersSummary) context.push(`Īpašnieki:\n${ownersSummary}`);
  if (mileage.length > 0) {
    context.push(
      "Oficiālie kilometri (Kilometerstand gerapporteerd):\n" +
        mileage.map((row) => `${row.date} ${row.odometer}`).join("\n"),
    );
  }
  if (presumed.length > 0) {
    context.push(
      "Vermoedelijke kilometerstand (nav oficiālais nobraukums):\n" +
        presumed.map((row) => `${row.date} ${row.km}`).join("\n"),
    );
  }
  const apkLines = apk.map((row) => {
    if (row.clean || row.findings.length === 0) return `${row.date} bez aizrādījumiem`;
    return `${row.date} ${row.findings.join("; ")}`;
  });
  if (apkLines.length > 0) context.push(`APK aizrādījumi:\n${apkLines.join("\n")}`);
  if (listings.length > 0) {
    context.push(
      "Sludinājumi (nav oficiālais nobraukums):\n" +
        listings.map((row) => (row.km ? `${row.date} ${row.km} km` : row.date)).join("\n"),
    );
  }
  const options = optionsOf(lines);
  if (options.length > 0) context.push(`Opcijas: ${options.join(", ")}`);
  const consumption = consumptionOf(text);
  if (consumption) context.push(`Vidējais patēriņš: ${consumption}`);

  return {
    plate,
    taxi,
    fuel,
    firstRegistration,
    exportStatus,
    exportDate,
    parallelImport,
    recalls,
    apkValidUntil,
    apkValidUnknown,
    plateInvalid,
    ownersSummary,
    statusRecords,
    mileage,
    timeline,
    aiContextRaw: context.join("\n").slice(0, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
  };
}

export function finnikParseSummary(parsed: FinnikParsedReport): string {
  const plate = parsed.plate ? ` ${parsed.plate}` : "";
  return `Nīderlandes reģistrs${plate}: ${parsed.mileage.length} oficiālie km, ${parsed.timeline.length} laikposma notikumi.`;
}

/** Strukturētos laukus atjauno. AI kontekstu aizpilda tikai ja tas ir tukšs. */
export function applyFinnikReportToBlock(
  existing: VinRegistryBlockState | null | undefined,
  text: string,
): { block: VinRegistryBlockState; summary: string } | null {
  const parsed = parseFinnikReport(text);
  if (!parsed) return null;
  const base = existing ?? emptyVinRegistryBlock();
  const block: VinRegistryBlockState = {
    ...base,
    ...(parsed.mileage.length > 0 ? { mileage: sortVinRegistryMileage(parsed.mileage) } : {}),
    ...(parsed.timeline.length > 0 ? { timeline: sortVinRegistryTimeline(parsed.timeline) } : {}),
    ...(parsed.ownersSummary ? { ownersSummary: parsed.ownersSummary } : {}),
    ...(parsed.statusRecords ? { statusRecords: parsed.statusRecords } : {}),
    ...((base.aiContextRaw ?? "").trim() ? {} : { aiContextRaw: parsed.aiContextRaw }),
  };
  return { block, summary: finnikParseSummary(parsed) };
}
