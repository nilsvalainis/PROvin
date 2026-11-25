/**
 * Īpašnieku apgalvojumi AI tekstā pret avotiem (24.11, Mercedes GLE WDC167…):
 * - CarVertical komentārs: „piecas īpašumtiesību maiņas ārvalstīs pirms reģistrācijas Latvijā”, bet visas
 *   5 CarVertical maiņas ir Latvijā 2023-2025 (CarVertical skaita arī reģistrācijas apliecības izmaiņas);
 * - CSDD komentārs: „kopējā vēsturē fiksēti 9 īpašnieki” - skaitlis nav nevienā avotā.
 * Bez LLM; rezultāts ir brīdinājums adminam, teksts netiek mainīts.
 */
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { mergeSourceBlocksWithDefaults, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  extractExplicitOwnerCount,
  ownerEventMonthKey,
  synthesizeOwnerCountsFromBlocks,
} from "@/lib/owner-count-synthesis";

const OWNER_CHANGE_EVENT_RE =
  /main[īi]tas?\s+[īi]pa[sš]umties|[īi]pa[sš]nieka\s+mai[nņ]|ownership\s+change|owner\s+change|new\s+owner|jauns\s+[īi]pa[sš]nieks/i;
const LATVIA_RE = /^\s*(?:latvij|latvia|lv\b|lettland|латви)/i;

const NUMBER_WORDS: Record<string, number> = {
  viens: 1, viena: 1, divi: 2, divas: 2, "trīs": 3, "četri": 4, "četras": 4, pieci: 5, piecas: 5,
  "seši": 6, "sešas": 6, "septiņi": 7, "septiņas": 7, "astoņi": 8, "astoņas": 8, "deviņi": 9, "deviņas": 9,
  desmit: 10, vienpadsmit: 11, divpadsmit: 12,
};
const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;
const OWNER_NUM_RE = new RegExp(`(?<![\\p{L}\\d.])${NUM}\\s+(?:\\p{L}+\\s+)?īpašniek(?!(?:u|a)\\s+maiņ)`, "giu");
const CHANGE_NUM_RE = new RegExp(`(?<![\\p{L}\\d.])${NUM}\\s+(?:\\p{L}+\\s+)?(?:īpašnieku|īpašumtiesību)\\s+maiņ`, "giu");
const FOREIGN_BEFORE_LV_RE = /(?:ārvalst|ārzem|citās\s+valstīs|abroad)[^.!?]*pirms[^.!?]*latvij|pirms[^.!?]*latvij[^.!?]*(?:ārvalst|ārzem|citās\s+valstīs)/iu;

function toNum(raw: string): number {
  const t = raw.toLowerCase();
  return /^\d+$/.test(t) ? Number(t) : (NUMBER_WORDS[t] ?? NaN);
}

export type VendorOwnerEvent = { source: string; date: string; country: string };

/** CarVertical / AutoDNA laika līnijas īpašumtiesību notikumi (datums + valsts). */
export function vendorOwnerChangeEvents(sourceBlocks: WorkspaceSourceBlocks): VendorOwnerEvent[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const out: VendorOwnerEvent[] = [];
  for (const key of ["carvertical", "autodna", "carfax"] as const) {
    for (const t of blocks[key].vehicleHistoryTimeline ?? []) {
      if (!OWNER_CHANGE_EVENT_RE.test(t.description ?? "")) continue;
      out.push({ source: SOURCE_BLOCK_LABELS[key], date: (t.date ?? "").trim(), country: (t.country ?? "").trim() });
    }
  }
  return out;
}

/** Faktu lapas rindas: notikumi ar valsti un datumu + piezīme, ka oficiālais skaits ir CSDD. */
export function formatVendorOwnerEventFactLines(sourceBlocks: WorkspaceSourceBlocks): string[] {
  const events = vendorOwnerChangeEvents(sourceBlocks);
  const lines: string[] = [];
  for (const source of [...new Set(events.map((e) => e.source))]) {
    const list = events
      .filter((e) => e.source === source)
      .map((e) => `${e.date || "datums nav"} ${e.country || "valsts nav"}`)
      .join("; ");
    lines.push(
      `${source} īpašumtiesību notikumi (datums, valsts): ${list}. ${source} skaita arī reģistrācijas apliecības izmaiņas - tas NAV īpašnieku skaits; oficiālais skaits Latvijā - CSDD. Valsti un laiku (pirms / pēc reģistrācijas Latvijā) raksti tikai pēc šīm rindām.`,
    );
  }
  return lines;
}

function latviaFirstRegMs(blocks: WorkspaceSourceBlocks): number {
  const csdd = blocks.csdd;
  const direct = parseDotOrIsoDateToMs(csdd.firstRegistrationLatvia ?? "");
  if (direct > 0) return direct;
  const ev = (csdd.ownerRegistrationEvents ?? []).find((e) => /pirm\p{L}*\s+reģistrācij\p{L}*\s+latvij/iu.test(e.label ?? ""));
  return ev ? parseDotOrIsoDateToMs(ev.date) : 0;
}

export type OwnerClaimIssue = { id: "owner_count_unsourced" | "owner_foreign_before_lv"; message: string; sentence: string };

/** Īpašnieku skaitļi un „ārvalstīs pirms Latvijas” apgalvojumi, kuriem nav pamata avotos. */
export function findOwnerClaimIssues(plainText: string, sourceBlocks: WorkspaceSourceBlocks): OwnerClaimIssue[] {
  const text = (plainText ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: OwnerClaimIssue[] = [];

  const synth = synthesizeOwnerCountsFromBlocks(blocks);
  const csddCount = extractExplicitOwnerCount(blocks.csdd.ownerCountLatvia ?? "");
  const events = vendorOwnerChangeEvents(blocks);
  const lvRegMs = latviaFirstRegMs(blocks);
  const csddEvents = (blocks.csdd.ownerRegistrationEvents ?? []).filter((e) => e.date.trim() || e.label.trim()).length;

  // Atļautie skaitļi: CSDD, katra avota kandidāti, kopsumma, ārvalstu daļa (kopā - LV).
  const owners = new Set<number>();
  if (csddCount != null) owners.add(csddCount);
  for (const c of synth.candidates) owners.add(c.count);
  if (synth.totalCount > 0) owners.add(synth.totalCount);
  const lv = synth.chosen.latvia?.count;
  if (lv != null && synth.totalCount > lv) owners.add(synth.totalCount - lv);
  const changes = new Set<number>([...owners].map((n) => Math.max(0, n - 1)));
  for (const n of owners) changes.add(n);
  if (csddEvents > 0) {
    changes.add(csddEvents);
    changes.add(csddEvents - 1);
  }
  for (const source of new Set(events.map((e) => e.source))) {
    const list = events.filter((e) => e.source === source);
    changes.add(list.length);
    changes.add(new Set(list.map((e) => ownerEventMonthKey(e.date) ?? e.date)).size);
  }

  if (owners.size > 0) {
    for (const s of sentences) {
      for (const m of s.matchAll(OWNER_NUM_RE)) {
        const n = toNum(m[1]!);
        if (Number.isFinite(n) && n > 0 && !owners.has(n)) {
          out.push({
            id: "owner_count_unsourced",
            message: `Teksts saka ${n} īpašniekus - šāda skaita nav nevienā avotā (${[...owners].sort((a, b) => a - b).join(" / ")}; oficiālais Latvijā - CSDD${csddCount != null ? ` ${csddCount}` : ""}).`,
            sentence: s,
          });
        }
      }
      for (const m of s.matchAll(CHANGE_NUM_RE)) {
        const n = toNum(m[1]!);
        if (Number.isFinite(n) && n > 0 && !changes.has(n)) {
          out.push({
            id: "owner_count_unsourced",
            message: `Teksts saka ${n} īpašnieku / īpašumtiesību maiņas - šāda skaita nav nevienā avotā.`,
            sentence: s,
          });
        }
      }
    }
  }

  // „… ārvalstīs pirms reģistrācijas Latvijā”: vai avotos ir ārvalstu maiņas pirms LV?
  const foreignEvents = events.filter((e) => {
    const ms = parseDotOrIsoDateToMs(e.date);
    if (e.country && !LATVIA_RE.test(e.country)) return true;
    return !e.country && lvRegMs > 0 && ms > 0 && ms < lvRegMs;
  });
  const foreignRegistryOwners = synth.candidates.filter((c) => c.country !== "latvia").reduce((m, c) => Math.max(m, c.count), 0);
  for (const s of sentences) {
    if (!FOREIGN_BEFORE_LV_RE.test(s) || !/īpašum|īpašniek/i.test(s)) continue;
    if (foreignEvents.length > 0 || foreignRegistryOwners > 0) continue;
    const lvEvents = events.filter((e) => LATVIA_RE.test(e.country));
    if (lvEvents.length === 0 && lvRegMs === 0) continue;
    out.push({
      id: "owner_foreign_before_lv",
      message:
        `Teksts saka „ārvalstīs pirms reģistrācijas Latvijā”, bet avotos ārvalstu īpašnieku maiņu nav` +
        (lvEvents.length
          ? `; ${lvEvents[0]!.source} maiņas ir Latvijā (${lvEvents.map((e) => e.date).join(", ")}) - tās var būt arī reģistrācijas apliecības izmaiņas.`
          : "."),
      sentence: s,
    });
  }
  return out;
}
