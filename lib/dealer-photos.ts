/**
 * Dīlera datu atskaites fotogrāfijas (Nils 27.11.2026).
 *
 * Bildes netiek kopētas: dīlera sadaļā glabājas tikai atsauces (foto ID) uz bildēm, kas jau ir kādā
 * pasūtījuma galerijā (dīlera augšupielāde, sludinājums, izsoļu arhīvs / TheCarApi, ASV, negadījumi,
 * avotu bloki). Oriģināls galerijā paliek; noņemot no dīlera sadaļas, oriģināls netiek aiztikts.
 * Katrai atsaucei savi iestatījumi: «Blur», «Sūtīt klientam»; viena «Titulbilde».
 *
 * Noklusējums: nekas nav atlasīts -> dīlera PDF paliek kā līdz šim.
 * Glabājas `sourceBlocks.auto_records.dealerPhotos`.
 */

export const DEALER_PHOTOS_MAX = 60;

export type DealerPhotoSrc = "auto_records" | "listing_analysis" | "cc_vin" | "asv" | "incident" | "source_block";

export type DealerPhotoItem = {
  id: string;
  /** Izplūdināt PDF (numurzīmes, personas dati). */
  blur?: boolean;
  /** Iekļaut PDF galerijā klientam. */
  send?: boolean;
};

export type DealerPhotosState = {
  items: DealerPhotoItem[];
  /** Titulbildes foto ID (viena; jābūt `items` sarakstā). */
  coverId?: string | null;
};

const SRC_BY_PREFIX: [RegExp, DealerPhotoSrc][] = [
  [/^ar_ph_[a-f0-9]{24}$/, "auto_records"],
  [/^la_ph_[a-f0-9]{24}$/, "listing_analysis"],
  [/^ih_ph_[a-f0-9]{24}$/, "cc_vin"],
  [/^asv_ph_[a-f0-9]{24}$/, "asv"],
  [/^inc_ph_[a-f0-9]{24}$/, "incident"],
  [/^sbp_ph_[a-f0-9]{24}$/, "source_block"],
];

/** Galerija pēc foto ID prefiksa (katrai krātuvei savs prefikss). */
export function dealerPhotoSrc(id: string): DealerPhotoSrc | null {
  const t = id.trim();
  for (const [re, src] of SRC_BY_PREFIX) if (re.test(t)) return src;
  return null;
}

const API_BASE: Record<DealerPhotoSrc, string> = {
  auto_records: "/api/admin/auto-records-photo",
  listing_analysis: "/api/admin/listing-analysis-photo",
  cc_vin: "/api/admin/cc-vin-photo",
  asv: "/api/admin/asv-photo",
  incident: "/api/admin/incident-photo",
  source_block: "/api/admin/source-block-photo",
};

/** Sīktēla URL admin UI (tie paši GET maršruti, ko lieto galerijas). */
export function dealerPhotoThumbUrl(sessionId: string, id: string): string {
  const src = dealerPhotoSrc(id);
  if (!src) return "";
  return `${API_BASE[src]}?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(id)}&v=${encodeURIComponent(id.slice(-8))}`;
}

export function emptyDealerPhotos(): DealerPhotosState {
  return { items: [], coverId: null };
}

export function normalizeDealerPhotos(raw: unknown): DealerPhotosState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { items?: unknown; coverId?: unknown };
  const items: DealerPhotoItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      if (!it || typeof it !== "object") continue;
      const x = it as { id?: unknown; blur?: unknown; send?: unknown };
      const id = typeof x.id === "string" ? x.id.trim() : "";
      if (!dealerPhotoSrc(id) || seen.has(id)) continue;
      seen.add(id);
      items.push({ id, ...(x.blur === true ? { blur: true } : {}), ...(x.send === true ? { send: true } : {}) });
      if (items.length >= DEALER_PHOTOS_MAX) break;
    }
  }
  const cover = typeof o.coverId === "string" ? o.coverId.trim() : "";
  return { items, coverId: cover && seen.has(cover) ? cover : null };
}

/** Pievieno atsauces (bez dublikātiem, limita robežās). Jaunās - bez «Sūtīt klientam» un bez blur. */
export function addDealerPhotos(state: DealerPhotosState | null | undefined, ids: readonly string[]): DealerPhotosState {
  const cur = state ?? emptyDealerPhotos();
  const have = new Set(cur.items.map((i) => i.id));
  const items = [...cur.items];
  for (const raw of ids) {
    const id = raw.trim();
    if (!dealerPhotoSrc(id) || have.has(id)) continue;
    if (items.length >= DEALER_PHOTOS_MAX) break;
    have.add(id);
    items.push({ id });
  }
  return { items, coverId: cur.coverId ?? null };
}

/** Noņem atsauci (oriģināls galerijā paliek). */
export function removeDealerPhoto(state: DealerPhotosState, id: string): DealerPhotosState {
  return {
    items: state.items.filter((i) => i.id !== id),
    coverId: state.coverId === id ? null : (state.coverId ?? null),
  };
}

export function patchDealerPhoto(
  state: DealerPhotosState,
  id: string,
  patch: { blur?: boolean; send?: boolean },
): DealerPhotosState {
  return {
    ...state,
    items: state.items.map((i) => {
      if (i.id !== id) return i;
      const next: DealerPhotoItem = { id: i.id };
      const blur = patch.blur ?? i.blur;
      const send = patch.send ?? i.send;
      if (blur) next.blur = true;
      if (send) next.send = true;
      return next;
    }),
  };
}

/** Titulbilde: viena; atkārtots klikšķis uz tās pašas - noņem. */
export function toggleDealerCover(state: DealerPhotosState, id: string): DealerPhotosState {
  if (!state.items.some((i) => i.id === id)) return state;
  return { ...state, coverId: state.coverId === id ? null : id };
}

/** Visas «Sūtīt klientam» ieslēgt / izslēgt. */
export function setAllDealerPhotosSend(state: DealerPhotosState, send: boolean): DealerPhotosState {
  return {
    ...state,
    items: state.items.map((i) => ({ id: i.id, ...(i.blur ? { blur: true } : {}), ...(send ? { send: true } : {}) })),
  };
}

/** Ko lādēt PDF: titulbilde + galerija (secībā), ar blur atzīmēm. */
export type DealerPhotosPdfPlan = {
  coverId: string | null;
  galleryIds: string[];
  /** Visi lādējamie ID ar blur atzīmi (titulbilde pirmā). */
  load: { id: string; blur: boolean }[];
};

export function dealerPhotosPdfPlan(state: DealerPhotosState | null | undefined): DealerPhotosPdfPlan {
  const s = normalizeDealerPhotos(state) ?? emptyDealerPhotos();
  const byId = new Map(s.items.map((i) => [i.id, i]));
  const coverId = s.coverId && byId.has(s.coverId) ? s.coverId : null;
  const galleryIds = s.items.filter((i) => i.send).map((i) => i.id);
  const load: { id: string; blur: boolean }[] = [];
  if (coverId) load.push({ id: coverId, blur: byId.get(coverId)?.blur === true });
  for (const id of galleryIds) if (id !== coverId) load.push({ id, blur: byId.get(id)?.blur === true });
  return { coverId, galleryIds, load };
}

/** Payload lauks dīlera PDF: tikai tie ID, kuru bildes izdevās ielādēt. */
export type DealerPhotosPdfPayload = { coverId?: string | null; galleryIds: string[] };

export function dealerPhotosPdfPayload(plan: DealerPhotosPdfPlan, loaded: ReadonlyMap<string, string>): DealerPhotosPdfPayload | null {
  const coverId = plan.coverId && loaded.has(plan.coverId) ? plan.coverId : null;
  const galleryIds = plan.galleryIds.filter((id) => loaded.has(id));
  if (!coverId && galleryIds.length === 0) return null;
  return { coverId, galleryIds };
}

// ---------------------------------------------------------------------------------------------
// Galeriju saraksts atlases logam

export type DealerPhotoGallery = {
  key: string;
  /** Sadaļa (piem. «Izsoļu portālu arhīvs»). */
  section: string;
  /** Grupas virsraksts (piem. «Openlane · 2026-10-01»), var būt tukšs. */
  title: string;
  ids: string[];
};

type GroupLike = { id?: string; title?: string; photos?: { id: string }[] | null };
type BlockLike = { photoGroups?: GroupLike[] | null; photos?: { id: string }[] | null } | null | undefined;

function galleriesOf(section: string, keyBase: string, block: BlockLike): DealerPhotoGallery[] {
  if (!block) return [];
  const out: DealerPhotoGallery[] = [];
  const grouped = new Set<string>();
  (block.photoGroups ?? []).forEach((g, i) => {
    const ids = (g.photos ?? []).map((p) => p.id).filter((id) => dealerPhotoSrc(id));
    ids.forEach((id) => grouped.add(id));
    if (ids.length > 0) out.push({ key: `${keyBase}:${g.id ?? i}`, section, title: (g.title ?? "").trim(), ids });
  });
  const loose = (block.photos ?? []).map((p) => p.id).filter((id) => dealerPhotoSrc(id) && !grouped.has(id));
  if (loose.length > 0) out.push({ key: `${keyBase}:flat`, section, title: "", ids: loose });
  return out;
}

const SOURCE_BLOCK_SECTIONS: [string, string][] = [
  ["csdd", "CSDD"],
  ["tirgus", "Sludinājuma vēsture"],
  ["autodna", "AutoDNA"],
  ["carvertical", "CarVertical"],
  ["carfax", "CARFAX"],
  ["ltab", "LTAB"],
  ["tjekbil", "Tjekbil"],
  ["finnik", "Finnik"],
  ["mnt_ee", "MNT (EE)"],
  ["lkf_ee", "LKF (EE)"],
  ["carinfo", "car.info"],
  ["traficom_fi", "Traficom (FI)"],
];

/** Visas pasūtījuma galerijas ar bildēm (atlases logam «Pievienot no galerijām»). */
export function collectDealerPhotoGalleries(args: {
  sourceBlocks: Record<string, unknown> | null | undefined;
  incidentPhotoGroups?: GroupLike[] | null;
  incidentPhotos?: { id: string }[] | null;
}): DealerPhotoGallery[] {
  const b = (args.sourceBlocks ?? {}) as Record<string, BlockLike & { sections?: (BlockLike & { title?: string })[] }>;
  const out: DealerPhotoGallery[] = [
    ...galleriesOf("Dīlera foto", "auto_records", b.auto_records),
    ...galleriesOf("Izsoļu portālu arhīvs", "cc_vin", b.cc_vin),
    ...galleriesOf("Sludinājuma analīze", "listing_analysis", b.listing_analysis),
    ...galleriesOf("ASV", "asv", b.asv),
    ...galleriesOf("Negadījumi", "incident", { photoGroups: args.incidentPhotoGroups, photos: args.incidentPhotos }),
  ];
  for (const [key, label] of SOURCE_BLOCK_SECTIONS) out.push(...galleriesOf(label, key, b[key]));
  (b.citi_avoti?.sections ?? []).forEach((s, i) => {
    out.push(...galleriesOf((s?.title ?? "").trim() || "Citi avoti", `citi_avoti:${i}`, s));
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// PDF

const GALLERY_TITLE: Record<string, string> = {
  lv: "Fotogrāfijas",
  en: "Photos",
  ru: "Фотографии",
  de: "Fotos",
};

export function dealerPhotosGalleryTitle(lang: string): string {
  return GALLERY_TITLE[lang] ?? GALLERY_TITLE.lv!;
}

/** Aptuvenais PDF pieaugums no bildēm (base64 dataURL garums ~ 4/3 no baitiem). */
export function dealerPhotosApproxBytes(dataUrls: ReadonlyMap<string, string>, ids: readonly string[]): number {
  let n = 0;
  for (const id of new Set(ids)) n += Math.round(((dataUrls.get(id)?.length ?? 0) * 3) / 4);
  return n;
}
