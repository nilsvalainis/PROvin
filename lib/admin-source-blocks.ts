/**
 * Strukturēti avotu bloki admin portfelī → sintēze uz PDF / km / VIN heuristiku.
 */

export const SOURCE_BLOCK_KEYS = [
  "csdd",
  "tirgus",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
] as const;

export type SourceBlockKey = (typeof SOURCE_BLOCK_KEYS)[number];

export const SOURCE_BLOCK_LABELS: Record<SourceBlockKey, string> = {
  csdd: "CSDD",
  tirgus: "Tirgus dati",
  autodna: "AutoDNA",
  carvertical: "CarVertical",
  auto_records: "Auto-Records",
  ltab: "LTAB",
};

export type SourceDataRow = {
  date: string;
  km: string;
  amount: string;
};

export type SourceBlockState = {
  rows: SourceDataRow[];
  comments: string;
};

export type WorkspaceSourceBlocks = Record<SourceBlockKey, SourceBlockState>;

export function emptyDataRow(): SourceDataRow {
  return { date: "", km: "", amount: "" };
}

export function emptyBlock(): SourceBlockState {
  return { rows: [emptyDataRow()], comments: "" };
}

export function createDefaultSourceBlocks(): WorkspaceSourceBlocks {
  return {
    csdd: emptyBlock(),
    tirgus: emptyBlock(),
    autodna: emptyBlock(),
    carvertical: emptyBlock(),
    auto_records: emptyBlock(),
    ltab: emptyBlock(),
  };
}

export function rowHasData(r: SourceDataRow): boolean {
  return Boolean(r.date.trim() || r.km.trim() || r.amount.trim());
}

export function blockHasContent(b: SourceBlockState): boolean {
  return b.rows.some(rowHasData) || b.comments.trim().length > 0;
}

/** Viena bloka teksts: datu rindas (TAB) + komentāri. */
export function blockToPlainText(b: SourceBlockState): string {
  const lines = b.rows.filter(rowHasData).map((r) => `${r.date.trim()}\t${r.km.trim()}\t${r.amount.trim()}`);
  const c = b.comments.trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

const VENDOR_KEYS: SourceBlockKey[] = ["autodna", "carvertical", "auto_records"];

/** Saglabājamais `citi` lauks PDF / parseriem — apvieno trešo pušu blokus ar virsrakstiem. */
export function mergeVendorBlocksPlain(blocks: WorkspaceSourceBlocks): string {
  const parts: string[] = [];
  for (const k of VENDOR_KEYS) {
    const t = blockToPlainText(blocks[k]);
    if (!t) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[k]}】\n${t}`);
  }
  return parts.join("\n\n");
}

/** Plakanais teksts atpakaļsavienojamībai ar esošo PDF kodu. */
export function blocksToLegacyFlatFields(blocks: WorkspaceSourceBlocks): {
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
} {
  return {
    csdd: blockToPlainText(blocks.csdd),
    ltab: blockToPlainText(blocks.ltab),
    tirgus: blockToPlainText(blocks.tirgus),
    citi: mergeVendorBlocksPlain(blocks),
  };
}

export type ClientManualVendorBlockPdf = {
  title: string;
  rows: SourceDataRow[];
  comments: string;
};

export function toPdfManualVendorBlocks(blocks: WorkspaceSourceBlocks): ClientManualVendorBlockPdf[] {
  const out: ClientManualVendorBlockPdf[] = [];
  for (const k of VENDOR_KEYS) {
    const b = blocks[k];
    if (!blockHasContent(b)) continue;
    out.push({
      title: SOURCE_BLOCK_LABELS[k],
      rows: b.rows.filter(rowHasData),
      comments: b.comments.trim(),
    });
  }
  return out;
}

/** Aizpilda trūkstošās atslēgas pēc ielādes. */
export function mergeSourceBlocksWithDefaults(partial: unknown): WorkspaceSourceBlocks {
  const base = createDefaultSourceBlocks();
  if (!partial || typeof partial !== "object") return base;
  const o = partial as Record<string, unknown>;
  for (const key of SOURCE_BLOCK_KEYS) {
    const raw = o[key];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { rows?: unknown; comments?: unknown };
    const rowsIn = Array.isArray(r.rows) ? r.rows : [];
    const rows: SourceDataRow[] = rowsIn
      .map((row) => {
        if (!row || typeof row !== "object") return emptyDataRow();
        const x = row as Record<string, unknown>;
        return {
          date: String(x.date ?? "").slice(0, 120),
          km: String(x.km ?? "").slice(0, 120),
          amount: String(x.amount ?? "").slice(0, 120),
        };
      })
      .filter((row) => row.date || row.km || row.amount);
    const comments = typeof r.comments === "string" ? r.comments : "";
    base[key] = {
      rows: rows.length > 0 ? rows : [emptyDataRow()],
      comments,
    };
  }
  return base;
}

/** Migrācija no vecā localStorage (4 textarea lauki). */
export function migrateFlatWorkspaceToBlocks(flat: {
  csdd?: string;
  ltab?: string;
  tirgus?: string;
  citi?: string;
}): WorkspaceSourceBlocks {
  const b = createDefaultSourceBlocks();
  if (flat.csdd?.trim()) b.csdd = { rows: [emptyDataRow()], comments: flat.csdd.trim() };
  if (flat.ltab?.trim()) b.ltab = { rows: [emptyDataRow()], comments: flat.ltab.trim() };
  if (flat.tirgus?.trim()) b.tirgus = { rows: [emptyDataRow()], comments: flat.tirgus.trim() };
  if (flat.citi?.trim()) {
    b.autodna = {
      rows: [emptyDataRow()],
      comments: `Iepriekš „Citi avoti”:\n${flat.citi.trim()}`,
    };
  }
  return b;
}

export function hydrateWorkspaceFromStorage(raw: string | null): {
  sourceBlocks: WorkspaceSourceBlocks;
  iriss: string;
  apskatesPlāns: string;
  previewConfirmed: boolean;
} | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    let sourceBlocks: WorkspaceSourceBlocks;
    if (p.sourceBlocks && typeof p.sourceBlocks === "object") {
      sourceBlocks = mergeSourceBlocksWithDefaults(p.sourceBlocks);
    } else if ("csdd" in p || "ltab" in p || "tirgus" in p || "citi" in p) {
      sourceBlocks = migrateFlatWorkspaceToBlocks({
        csdd: typeof p.csdd === "string" ? p.csdd : "",
        ltab: typeof p.ltab === "string" ? p.ltab : "",
        tirgus: typeof p.tirgus === "string" ? p.tirgus : "",
        citi: typeof p.citi === "string" ? p.citi : "",
      });
    } else {
      return null;
    }
    return {
      sourceBlocks,
      iriss: typeof p.iriss === "string" ? p.iriss : "",
      apskatesPlāns: typeof p.apskatesPlāns === "string" ? p.apskatesPlāns : "",
      previewConfirmed: Boolean(p.previewConfirmed),
    };
  } catch {
    return null;
  }
}
