/**
 * Telefona sākuma režģis (IRISS un PRO): ikonas un logrīki, ko lietotājs pats kārto un izmēro.
 * Tikai tīra loģika, bez React un bez glabāšanas.
 *
 * Izmēri: app = 1×1, S = 2×2, M = 4×2, L = 4×4 (4 kolonnas).
 * Logrīka saturs skaita rindas pēc izmēra (S 2, M 4, L 6), jo pavadzīmju termiņi parasti ir 2–4 numuri.
 */

export const MENU_GRID_COLS = 4;

export type MenuSize = "app" | "S" | "M" | "L";

export type MenuCatalogItem = {
  id: string;
  kind: "app" | "widget";
  title: string;
  href: string;
  /** Atļautie izmēri. Ikonai vienmēr ["app"]. */
  sizes: readonly MenuSize[];
  defaultSize: MenuSize;
  /** Cik rindas logrīkā rādīt katrā izmērā (ja loģrīkam ir saraksts). */
  rowsBySize?: Partial<Record<MenuSize, number>>;
  /** Kura sadaļa to atver (IRISS: `IrissSection`; PRO: nav). */
  section?: string;
  /** Ikonas atslēga (sk. components/admin/mobile/MenuIcons.tsx). */
  icon: string;
  /** Krāsa (CSS), no kuras veido ikonas fonu. */
  tone: string;
  /** Skaits, ko rāda nozīmītē uz ikonas. */
  badge?: string;
};

export type MenuLayoutEntry = { id: string; size: MenuSize };
export type MenuLayout = MenuLayoutEntry[];

const SPAN: Record<MenuSize, { cols: number; rows: number }> = {
  app: { cols: 1, rows: 1 },
  S: { cols: 2, rows: 2 },
  M: { cols: 4, rows: 2 },
  L: { cols: 4, rows: 4 },
};

export function menuSpan(size: MenuSize): { cols: number; rows: number } {
  return SPAN[size];
}

export function menuRowsFor(item: MenuCatalogItem, size: MenuSize): number {
  return item.rowsBySize?.[size] ?? 0;
}

/** Nākamais atļautais izmērs pēc cikla (app → S → M → L → S…). Ikonai nav ko mainīt. */
export function nextMenuSize(item: MenuCatalogItem, current: MenuSize): MenuSize {
  const opts = item.sizes;
  if (opts.length <= 1) return current;
  const i = opts.indexOf(current);
  return opts[(i + 1) % opts.length] ?? item.defaultSize;
}

export function defaultMenuLayout(catalog: readonly MenuCatalogItem[], ids: readonly string[]): MenuLayout {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out: MenuLayout = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) out.push({ id, size: item.defaultSize });
  }
  return out;
}

/**
 * Sagatavo saglabāto izkārtojumu: nezināmi ID, nederīgi izmēri un dublikāti tiek izmesti.
 * Ja nekas nepaliek, atgriež noklusējumu.
 */
export function normalizeMenuLayout(raw: unknown, catalog: readonly MenuCatalogItem[], fallback: MenuLayout): MenuLayout {
  if (!Array.isArray(raw)) return fallback;
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: MenuLayout = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    const size = (entry as { size?: unknown }).size;
    if (typeof id !== "string" || seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    const ok = typeof size === "string" && (item.sizes as readonly string[]).includes(size);
    out.push({ id, size: ok ? (size as MenuSize) : item.defaultSize });
  }
  return out.length > 0 ? out : fallback;
}

export function moveMenuEntry(layout: MenuLayout, from: number, to: number): MenuLayout {
  if (from === to || from < 0 || from >= layout.length) return layout;
  const target = Math.max(0, Math.min(layout.length - 1, to));
  const next = [...layout];
  const [moved] = next.splice(from, 1);
  if (!moved) return layout;
  next.splice(target, 0, moved);
  return next;
}

export function setMenuEntrySize(
  layout: MenuLayout,
  catalog: readonly MenuCatalogItem[],
  id: string,
  size: MenuSize,
): MenuLayout {
  const item = catalog.find((c) => c.id === id);
  if (!item || !item.sizes.includes(size)) return layout;
  return layout.map((e) => (e.id === id ? { ...e, size } : e));
}

export function addMenuEntry(layout: MenuLayout, item: MenuCatalogItem, size?: MenuSize): MenuLayout {
  if (layout.some((e) => e.id === item.id)) return layout;
  const s = size && item.sizes.includes(size) ? size : item.defaultSize;
  return [...layout, { id: item.id, size: s }];
}

export function removeMenuEntry(layout: MenuLayout, id: string): MenuLayout {
  return layout.filter((e) => e.id !== id);
}

/** Katalogs, ko vēl nav režģī (lai pievienotu). */
export function missingMenuItems(layout: MenuLayout, catalog: readonly MenuCatalogItem[]): MenuCatalogItem[] {
  const present = new Set(layout.map((e) => e.id));
  return catalog.filter((c) => !present.has(c.id));
}

export function menuLayoutStorageKey(workspace: "iriss" | "pro"): string {
  return `provin-menu-v3-${workspace}`;
}

export function parseMenuLayout(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
