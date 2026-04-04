/**
 * Vēstures PDF kopsavilkums klienta atskaitei — salīdzinājums starp portfeļa analīzes rezultātiem.
 */

import {
  type HistoryPdfKind,
  type PdfPortfolioFileInsight,
  detectHistoryPdfKind,
  HISTORY_PDF_KIND_LABEL_LV,
} from "@/lib/admin-portfolio-pdf-analysis";

export type HistoryCompareRow = {
  historyKind: HistoryPdfKind;
  kindLabel: string;
  /** Klienta atskaitē: „Datu avots N”. */
  sourceLabel: string;
  sourceOrdinal: number;
  minKm: number | null;
  maxKm: number | null;
  nSamples: number;
  highlights: string[];
  charCount: number;
  textOk: boolean;
};

/** Kad kurš tips ir noderīgs — neitrāli, bez trešo pušu zīmolu nosaukumiem. */
export const HISTORY_COMPARE_USAGE_LV: Record<HistoryPdfKind, string> = {
  euro_network:
    "Parasti sniedz plašāko vairāku valstu pārklājumu — noderīgs krustojumiem starp tirgiem un kopējam nobraukuma ainakam.",
  regional_alt:
    "Bieži papildina ar papildu reģionālām vai komerciālām datu kopām — salīdziniet ar citiem pārskatiem, lai līdzsvarotu „platumu” un „dziļumu”.",
  registry_focus:
    "Mēdz labāk atspoguļot fiksētus ierakstus konkrētā tirgū — noderīgs, ja auto ilgi ekspluatēts viena reģiona ietvaros.",
  generic:
    "Tips nav automātiski atpazīts — salīdziniet ar citiem avotiem un reģistra datiem; saturs joprojām var saturēt noderīgas norādes.",
};

function kindOf(ins: PdfPortfolioFileInsight): HistoryPdfKind {
  return ins.historyKind ?? detectHistoryPdfKind(ins.fileName, "");
}

export function buildHistoryCompareRows(insights: PdfPortfolioFileInsight[]): HistoryCompareRow[] {
  return insights.map((ins) => {
    const kms = ins.kmSamples.map((s) => s.km);
    const minKm = kms.length ? Math.min(...kms) : null;
    const maxKm = kms.length ? Math.max(...kms) : null;
    const hk = kindOf(ins);
    const textOk =
      ins.charCount > 0 && !ins.highlights.some((h) => /neizdevās izvilkt/i.test(h));
    return {
      historyKind: hk,
      kindLabel: HISTORY_PDF_KIND_LABEL_LV[hk],
      sourceLabel: `Datu avots ${ins.sourceOrdinal}`,
      sourceOrdinal: ins.sourceOrdinal,
      minKm,
      maxKm,
      nSamples: ins.kmSamples.length,
      highlights: [...ins.highlights],
      charCount: ins.charCount,
      textOk,
    };
  });
}

export function buildHistoryCompareBullets(rows: HistoryCompareRow[]): string[] {
  const bullets: string[] = [];
  if (rows.length === 0) return bullets;

  if (rows.length < 2) {
    bullets.push(
      "Lai redzētu starpavotu salīdzinājumu, importējiet vismaz divas vēstures datnes un atkārtoti ģenerējiet atskaiti.",
    );
  }

  const withKm = rows.filter((r) => r.minKm != null && r.maxKm != null);
  if (withKm.length >= 2) {
    const maxes = withKm.map((r) => r.maxKm!);
    const mins = withKm.map((r) => r.minKm!);
    const spreadMax = Math.max(...maxes) - Math.min(...maxes);
    const spreadMin = Math.max(...mins) - Math.min(...mins);
    if (spreadMax > 450) {
      bullets.push(
        `Maksimālais izceltais nobraukums starp pārskatiem atšķiras par apmēram ${spreadMax.toLocaleString("lv-LV")} km — odometra grafikā izmantojiet visus punktus un novērtējiet, kurš ieraksts ir jaunākais un uzticamākais.`,
      );
    }
    if (spreadMin > 300) {
      bullets.push(
        `Arī minimālais izceltais nobraukums starp pārskatiem atšķiras vairāk nekā ~300 km — iespējams atšķirīgs ierakstu atlases moments vai datu kvalitāte.`,
      );
    }
  }

  const labelCounts = new Map<string, number>();
  for (const r of rows) {
    for (const h of r.highlights) {
      labelCounts.set(h, (labelCounts.get(h) ?? 0) + 1);
    }
  }
  let uniqAdded = 0;
  for (const [label, c] of labelCounts) {
    if (c === 1 && rows.length > 1 && uniqAdded < 4) {
      bullets.push(`Signāls „${label}” parādās tikai vienā avotā — pārbaudiet arī pārējos salīdzinājuma blokus.`);
      uniqAdded++;
    }
  }

  const kinds = new Set(rows.map((r) => r.historyKind));
  if (rows.length >= 2 && kinds.size === 1 && kinds.has("generic")) {
    bullets.push(
      "Visi importētie avoti ir klasificēti kā vispārīgi — ja struktūra atšķiras no gaidītās, salīdziniet ar reģistru un citiem avotiem.",
    );
  }

  const broken = rows.filter((r) => !r.textOk);
  if (broken.length > 0 && rows.length > 1) {
    bullets.push(
      "Dažos avotos tekstu neizdevās pilnībā izvilkt — salīdzinājums balstās uz pieejamo fragmentu; vajadzības gadījumā skatiet oriģinālu materiālu.",
    );
  }

  return bullets;
}
