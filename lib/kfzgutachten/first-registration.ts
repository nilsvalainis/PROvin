/**
 * kfzgutachten.at meklēšanai vajag PRECĪZU pirmās reģistrācijas datumu (Erstzulassungsdatum, TT.MM.GGGG).
 *
 * Ķēde (stiprākais vispirms):
 * 1. Jau ielasīts kfzgutachten.at atzinums («Erstzulassung» - Austrijas dokumentu B lauks).
 * 2. «Pirmā reģistrācija» no vēstures kopsavilkuma (agrākā jebkurā valstī; CSDD/CarVertical/AutoDNA/Traficom u.c.,
 *    tā pati loģika kā PDF un AI faktu lapai, #1109).
 * 3. Oficiālā dīlera dati «Pirmā reģistrācija».
 * 4. CSDD «Pirmā reģistrācija» / CSDD API. Ja tas sakrīt ar «Pirmā reģistrācija Latvijā» un auto ir ievests
 *    (iepriekšējā valsts nav LV), tas visticamāk ir LV datums, ne pasaules pirmā - rādām, bet kā vājāko.
 * Ja ir tikai mēnesis/gads - dienu neizdomājam: rezultāts «vajag precīzu datumu».
 */

import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { firstRegFromBlocks } from "@/lib/canonical-facts-sheet";
import { resolveCsddFirstRegistrationLatvia } from "@/lib/csdd-first-registration-guard";
import { findKfzAtSectionIndex, readKfzAtStore } from "@/lib/kfzgutachten/apply-citi";
import { kfzDateIsPartial, kfzExactDateDdMmYyyy } from "@/lib/kfzgutachten/kfzgutachten";

export type KfzFirstRegCandidate = {
  /** DD.MM.YYYY */
  date: string;
  source: string;
  /** true: datums var būt Latvijas reģistrācija, ne pasaules pirmā. */
  maybeNational?: boolean;
};

export type KfzFirstRegResolution = {
  /** Ticamākais precīzais datums DD.MM.YYYY vai "". */
  date: string;
  source: string;
  /** Visi atšķirīgie precīzie datumi (ticamākais pirmais) - adminā var izmēģināt nākamo. */
  candidates: KfzFirstRegCandidate[];
  /** Ir tikai mēnesis/gads (piem. «08.2004») - jāievada ar roku. */
  partial: string;
  needsExactDate: boolean;
};

export function resolveKfzFirstRegistration(
  blocks: WorkspaceSourceBlocks,
  opts: { listingUrl?: string | null } = {},
): KfzFirstRegResolution {
  const raw: { date: string; source: string; maybeNational?: boolean }[] = [];
  let partial = "";
  const note = (value: string | null | undefined, source: string, maybeNational = false) => {
    const t = (value ?? "").trim();
    if (!t) return;
    const exact = kfzExactDateDdMmYyyy(t);
    if (exact) raw.push({ date: exact, source, ...(maybeNational ? { maybeNational } : {}) });
    else if (!partial && kfzDateIsPartial(t)) partial = t;
  };

  // 1. Nopirktais atzinums.
  const citi = blocks.citi_avoti;
  const idx = findKfzAtSectionIndex(citi);
  if (idx >= 0) {
    for (const r of readKfzAtStore(citi.sections[idx]).reports) note(r.firstRegistration, "kfzgutachten.at atzinums");
  }

  // 2. Vēstures kopsavilkums (agrākā jebkurā valstī).
  const csdd = blocks.csdd;
  const lv = kfzExactDateDdMmYyyy(resolveCsddFirstRegistrationLatvia(csdd));
  const prevCountry = (csdd.previousRegistrationCountry ?? "").trim();
  const imported = Boolean(prevCountry) && !/^(lv|latvija|latvia)$/i.test(prevCountry);
  let world = "";
  try {
    world = firstRegFromBlocks(blocks, opts.listingUrl ?? null).date;
  } catch {
    world = "";
  }
  const worldExact = kfzExactDateDdMmYyyy(world);
  note(world, "Pirmā reģistrācija (vēstures kopsavilkums)", Boolean(worldExact && imported && worldExact === lv));

  // 3. Dīlera dati.
  note(blocks.auto_records?.outvinReport?.vehicleInfo?.firstRegistration, "Oficiālā dīlera dati");

  // 4. CSDD.
  const csddFirst = csdd.firstRegistration || csdd.registry?.data.firstRegistrationIso || "";
  const csddExact = kfzExactDateDdMmYyyy(csddFirst);
  note(csddFirst, "CSDD «Pirmā reģistrācija»", Boolean(csddExact && imported && csddExact === lv));

  const seen = new Map<string, KfzFirstRegCandidate>();
  for (const c of raw) {
    const prev = seen.get(c.date);
    if (!prev) seen.set(c.date, c);
    else if (prev.maybeNational && !c.maybeNational) seen.set(c.date, { ...prev, maybeNational: false });
  }
  const candidates = [...seen.values()].sort((a, b) => Number(Boolean(a.maybeNational)) - Number(Boolean(b.maybeNational)));
  const best = candidates[0];
  return {
    date: best?.date ?? "",
    source: best?.source ?? "",
    candidates,
    partial: best ? "" : partial,
    needsExactDate: !best,
  };
}
