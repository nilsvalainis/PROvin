/**
 * Starptautiskās vēstures avots (admin: „Izsoļu portālu arhīvs”, internal id: cc_vin) -
 * strukturētie lauki, normalizācija un LV vārdnīcas.
 *
 * Klienta PDF šo avotu sauc tikai par „IZSOĻU PORTĀLU ARHĪVS”: ne sadaļā, ne tabulās, ne leģendā
 * nedrīkst parādīties ārējā pakalpojuma nosaukums. Akcents ir uz sarkanajiem karogiem (bojājumi, total loss,
 * īpašumtiesību atzīmes, īpašnieku maiņas); 28.11 klāt servisa ieraksti un «Citi dati» (specifikācija).
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import type { CcVinPhotoGroup, CcVinPhotoMeta } from "@/lib/cc-vin-photo-types";
import { normalizeThecarapiAdminRecords, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import { normalizeCcVinPhotoGroups, syncCcVinPhotoGroupsAndFlat } from "@/lib/cc-vin-photo-types";
import { convertAmountTextToEur, displayUsdAsEur } from "@/lib/currency-eur-convert";

/** Admin bloka nosaukums (tikai admin panelis). */
export const CC_VIN_ADMIN_LABEL = "Izsoļu portālu arhīvs";

/** Klienta PDF sadaļas nosaukums - bez atsauces uz ārējo pakalpojumu. */
export const CC_VIN_PDF_TITLE = "IZSOĻU PORTĀLU ARHĪVS";

/** Nobraukuma / negadījumu tabulu avota apzīmējums (leģenda PDF). */
export const CC_VIN_PDF_SOURCE_LABEL = "IZSOĻU PORTĀLU ARHĪVS";

/** Šie reģistri jau nonāk vienotajā negadījumu tabulā / banerī. */
export const CC_VIN_UNIFIED_INCIDENT_CHECK_LABELS = new Set(["Fiksētie bojājumi", "Negadījumi"]);

export const CC_VIN_SUBTITLES = {
  checks: "Pārbaudītie reģistri",
  flags: "Brīdinājumi",
  damages: "Fiksētie bojājumi",
  insurance: "Apdrošinātāju un norakstīšanas ieraksti",
  brands: "Īpašumtiesību atzīmes",
  titles: "Īpašumtiesību (title) ieraksti",
  sales: "Pārdošanas un izsoļu vēsture",
  services: "Servisa ieraksti",
  specs: "Citi dati: tehniskā specifikācija",
} as const;

export type CcVinCheckSeverity = "ok" | "alert";

/** Viena reģistra pārbaude no atskaites kopsavilkuma (12 lauciņi). */
export type CcVinCheckRow = {
  label: string;
  status: string;
  severity: CcVinCheckSeverity;
};

/** Bojājums / negadījums: datums + reģions + summa (ja zināma) + apraksts. */
export type CcVinDamageRow = {
  date: string;
  region: string;
  amount: string;
  description: string;
};

/** Universāla ieraksta rinda: datums + ieraksts + detaļas (apdrošinātāji, atzīmes). */
export type CcVinRecordRow = {
  date: string;
  label: string;
  detail: string;
};

/** Īpašumtiesību ieraksts: datums + reģions + odometrs. */
export type CcVinTitleRow = {
  date: string;
  region: string;
  odometer: string;
  note: string;
};

/** Pārdošanas / izsoles ieraksts. */
export type CcVinSaleRow = {
  date: string;
  venue: string;
  odometer: string;
  price: string;
  status: string;
  /** Cenas nozīme (piem. «Pēdējais solījums») - tikai PDF renderī no izsoles ieraksta, netiek glabāts. */
  priceLabel?: string;
};

/** Servisa ieraksts (28.11): datums + nobraukums (ja zināms) + veiktie darbi / detaļas (rindas ar \n). */
export type CcVinServiceRow = {
  date: string;
  odometer: string;
  description: string;
};

/** «Citi dati»: tehniskās specifikācijas un citu sadaļu lauki (nosaukums LV + vērtība). */
export type CcVinSpecRow = {
  label: string;
  value: string;
};

/** Strukturāli identisks `SourcePdfChecklist` (bez importa, lai nav cikliskas atkarības). */
export type CcVinPdfChecklist = {
  incidents: boolean;
  mileageHistory: boolean;
  mileageLine: boolean;
};

export type CcVinBlockState = {
  /** Atskaites datums avotā (dd.mm.gggg). */
  reportDate: string;
  /** „8/12” - cik reģistros ir atzīmes. */
  attentionMarks: string;
  /** Īpašnieku skaits pēc ārvalstu reģistriem. */
  ownersCount: string;
  checks: CcVinCheckRow[];
  /** Odometra ieraksti - nonāk vienotajā nobraukuma tabulā. */
  mileage: AutoRecordsServiceRow[];
  damages: CcVinDamageRow[];
  insurance: CcVinRecordRow[];
  brands: CcVinRecordRow[];
  titles: CcVinTitleRow[];
  sales: CcVinSaleRow[];
  /** Servisa ieraksti (CheckCar «Services records»). Vecākos blokos nav. */
  services?: CcVinServiceRow[];
  /** Tehniskā specifikācija un citi lauki («Citi dati»). Vecākos blokos nav. */
  specs?: CcVinSpecRow[];
  comments: string;
  /** Neapstrādātais avota teksts - tikai admin. */
  rawUnprocessedData: string;
  /** Papildu konteksts tikai AI - nav PDF. */
  aiContextRaw: string;
  photos: CcVinPhotoMeta[];
  photoGroups: CcVinPhotoGroup[];
  /** Slēpt CheckCar.vin ūdenszīmi pirms foto saglabāšanas (noklusējums: izslēgts). */
  hidePhotoWatermarks?: boolean;
  pdfChecklist?: CcVinPdfChecklist;
  /** TheCarApi pilnie ieraksti. Admin un klienta PDF. */
  thecarapiRecords?: ThecarapiAdminRecord[];
};

/** Lokāls dublikāts (bez `admin-source-blocks` importa - tas pats importē šo moduli). */
export function emptyCcVinMileageRow(): AutoRecordsServiceRow {
  return { date: "", odometer: "", country: "" };
}

export function emptyCcVinCheckRow(): CcVinCheckRow {
  return { label: "", status: "", severity: "ok" };
}

export function emptyCcVinDamageRow(): CcVinDamageRow {
  return { date: "", region: "", amount: "", description: "" };
}

export function emptyCcVinRecordRow(): CcVinRecordRow {
  return { date: "", label: "", detail: "" };
}

export function emptyCcVinTitleRow(): CcVinTitleRow {
  return { date: "", region: "", odometer: "", note: "" };
}

export function emptyCcVinSaleRow(): CcVinSaleRow {
  return { date: "", venue: "", odometer: "", price: "", status: "" };
}

export function emptyCcVinServiceRow(): CcVinServiceRow {
  return { date: "", odometer: "", description: "" };
}

export function emptyCcVinSpecRow(): CcVinSpecRow {
  return { label: "", value: "" };
}

export function emptyCcVinBlock(): CcVinBlockState {
  return {
    reportDate: "",
    attentionMarks: "",
    ownersCount: "",
    checks: [],
    mileage: [emptyCcVinMileageRow()],
    damages: [emptyCcVinDamageRow()],
    insurance: [emptyCcVinRecordRow()],
    brands: [emptyCcVinRecordRow()],
    titles: [emptyCcVinTitleRow()],
    sales: [emptyCcVinSaleRow()],
    comments: "",
    rawUnprocessedData: "",
    aiContextRaw: "",
    photos: [],
    photoGroups: [],
    hidePhotoWatermarks: false,
    thecarapiRecords: [],
  };
}

export function ccVinCheckRowHasData(r: CcVinCheckRow | null | undefined): boolean {
  return Boolean(r && (r.label.trim() || r.status.trim()));
}

export function ccVinDamageRowHasData(r: CcVinDamageRow | null | undefined): boolean {
  return Boolean(r && (r.date.trim() || r.region.trim() || r.amount.trim() || r.description.trim()));
}

export function ccVinRecordRowHasData(r: CcVinRecordRow | null | undefined): boolean {
  return Boolean(r && (r.date.trim() || r.label.trim() || r.detail.trim()));
}

export function ccVinTitleRowHasData(r: CcVinTitleRow | null | undefined): boolean {
  return Boolean(r && (r.date.trim() || r.region.trim() || r.odometer.trim() || r.note.trim()));
}

export function ccVinServiceRowHasData(r: CcVinServiceRow | null | undefined): boolean {
  return Boolean(r && (r.date.trim() || r.odometer.trim() || r.description.trim()));
}

export function ccVinSpecRowHasData(r: CcVinSpecRow | null | undefined): boolean {
  return Boolean(r && r.label.trim() && r.value.trim());
}

export function ccVinSaleRowHasData(r: CcVinSaleRow | null | undefined): boolean {
  return Boolean(
    r && (r.date.trim() || r.venue.trim() || r.odometer.trim() || r.price.trim() || r.status.trim()),
  );
}

/**
 * Jau saglabāta Izsoļu portālu arhīva summa → EUR attēlojums. Ja valūta jau ir eiro vai nav atpazīstama,
 * atstāj tekstu kā ir. Vecākiem blokiem, kas vēl glabā „3 989 USD”, pārrēķins notiek šeit.
 */
export function ccVinAmountToEurDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const conversion = convertAmountTextToEur(t);
  return conversion?.display ?? t;
}

/**
 * Cik ierakstu PDF sadaļa tiešām izdrukā.
 * Nobraukums ir nobraukuma sadaļā. Bojājums ar summu ir negadījumu tabulā.
 * TheCarApi lots skaitās, ja tam ir lauki vai bildes un tā pati izsole (vieta + datums) nav jau pārdošanas rindā.
 */
export function countCcVinPdfVisibleRecords(b: CcVinBlockState | null | undefined): number {
  if (!b) return 0;
  const sales = (b.sales ?? []).filter(ccVinSaleRowHasData);
  // Izsoles detaļu bloks par to pašu izsoli, kas jau ir rindā «Pārdošanas un izsoļu vēsture», nav otrs ieraksts.
  const saleKeys = new Set(sales.map((row) => `${row.venue.trim().toLowerCase()}|${row.date.trim()}`));
  const lotDay = (raw: string): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
    return m ? `${m[3]}.${m[2]}.${m[1]}` : raw.trim();
  };
  const lots = (b.thecarapiRecords ?? []).filter(
    (record) =>
      (record.fields.some((field) => field.value.trim()) || record.photos.length > 0 || record.photoUrls.length > 0) &&
      !saleKeys.has(`${record.venue.trim().toLowerCase()}|${lotDay(record.date)}`),
  ).length;
  return (
    (b.damages ?? []).filter((row) => ccVinDamageRowHasData(row) && !row.amount.trim()).length +
    (b.insurance ?? []).filter(ccVinRecordRowHasData).length +
    (b.brands ?? []).filter(ccVinRecordRowHasData).length +
    (b.titles ?? []).filter(ccVinTitleRowHasData).length +
    sales.length +
    (b.services ?? []).filter(ccVinServiceRowHasData).length +
    lots
  );
}

/** Cik faktu ierakstu ir blokā (arī tie, kas PDF izsoļu sadaļā netiek drukāti). */
export function countCcVinRecords(b: CcVinBlockState | null | undefined): number {
  if (!b) return 0;
  return (
    (b.mileage ?? []).filter(autoRecordsRowHasData).length +
    (b.damages ?? []).filter(ccVinDamageRowHasData).length +
    (b.insurance ?? []).filter(ccVinRecordRowHasData).length +
    (b.brands ?? []).filter(ccVinRecordRowHasData).length +
    (b.titles ?? []).filter(ccVinTitleRowHasData).length +
    (b.sales ?? []).filter(ccVinSaleRowHasData).length +
    (b.services ?? []).filter(ccVinServiceRowHasData).length
  );
}

export function ccVinAlertChecks(b: CcVinBlockState | null | undefined): CcVinCheckRow[] {
  return (b?.checks ?? []).filter((c) => ccVinCheckRowHasData(c) && c.severity === "alert");
}

export function ccVinBlockHasContent(b: CcVinBlockState | null | undefined): boolean {
  if (!b) return false;
  if (countCcVinRecords(b) > 0) return true;
  if ((b.checks ?? []).some(ccVinCheckRowHasData)) return true;
  if ((b.specs ?? []).some(ccVinSpecRowHasData)) return true;
  if ((b.photoGroups ?? []).some((g) => (g.photos ?? []).length > 0)) return true;
  if ((b.thecarapiRecords ?? []).some((record) => record.fields.length > 0 || record.photos.length > 0)) return true;
  return Boolean(b.comments.trim() || b.reportDate.trim() || b.attentionMarks.trim());
}

/** Jebkurš aizpildīts Izsoļu portālu arhīva lauks (internal id: cc_vin), izņemot komentāru (noklusējuma sagatave neskaitās). */
export function ccVinBlockHasOperatorData(b: CcVinBlockState | null | undefined): boolean {
  if (!b) return false;
  if (ccVinBlockHasContent({ ...b, comments: "" })) return true;
  if (b.ownersCount.trim()) return true;
  if (b.rawUnprocessedData.trim()) return true;
  if (b.aiContextRaw.trim()) return true;
  return false;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function normalizeChecklist(raw: unknown): CcVinPdfChecklist {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    incidents: o.incidents === true,
    mileageHistory: o.mileageHistory === true,
    mileageLine: o.mileageLine === true,
  };
}

function arr(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function rowObj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

/** Uzticama normalizācija no saglabātā JSON (localStorage / servera melnraksts). */
export function normalizeCcVinBlock(raw: unknown): CcVinBlockState {
  const e = emptyCcVinBlock();
  if (!raw || typeof raw !== "object") return e;
  const o = raw as Record<string, unknown>;

  const withFallback = <T>(rows: T[], empty: () => T): T[] => (rows.length > 0 ? rows : [empty()]);

  const checks = arr(o.checks)
    .map((x) => {
      const r = rowObj(x);
      const severity = r.severity === "alert" ? "alert" : "ok";
      return { label: str(r.label, 120), status: str(r.status, 120), severity } as CcVinCheckRow;
    })
    .filter(ccVinCheckRowHasData);

  const mileage = arr(o.mileage)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        odometer: str(r.odometer, 40),
        country: str(r.country, 120),
      } as AutoRecordsServiceRow;
    })
    .filter(autoRecordsRowHasData);

  const damages = arr(o.damages)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        region: str(r.region, 120),
        amount: displayUsdAsEur(str(r.amount, 60)),
        description: str(r.description, 400),
      } as CcVinDamageRow;
    })
    .filter(ccVinDamageRowHasData);

  const records = (key: "insurance" | "brands") =>
    arr(o[key])
      .map((x) => {
        const r = rowObj(x);
        return { date: str(r.date, 40), label: str(r.label, 160), detail: str(r.detail, 400) } as CcVinRecordRow;
      })
      .filter(ccVinRecordRowHasData);

  const titles = arr(o.titles)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        region: str(r.region, 120),
        odometer: str(r.odometer, 40),
        note: str(r.note, 200),
      } as CcVinTitleRow;
    })
    .filter(ccVinTitleRowHasData);

  const sales = arr(o.sales)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        venue: str(r.venue, 160),
        odometer: str(r.odometer, 40),
        price: displayUsdAsEur(str(r.price, 60)),
        status: str(r.status, 80),
      } as CcVinSaleRow;
    })
    .filter(ccVinSaleRowHasData);

  const services = arr(o.services)
    .slice(0, 300)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        odometer: str(r.odometer, 40),
        description: str(r.description, 4000),
      } as CcVinServiceRow;
    })
    .filter(ccVinServiceRowHasData);

  const specs = arr(o.specs)
    .slice(0, 200)
    .map((x) => {
      const r = rowObj(x);
      return { label: str(r.label, 120), value: str(r.value, 600) } as CcVinSpecRow;
    })
    .filter(ccVinSpecRowHasData);

  const synced = syncCcVinPhotoGroupsAndFlat(normalizeCcVinPhotoGroups(o.photoGroups, o.photos));
  const thecarapiRecords = normalizeThecarapiAdminRecords(o.thecarapiRecords);
  const salesAligned = alignCcVinSaleDatesWithRecords(sales, thecarapiRecords);

  return {
    reportDate: str(o.reportDate, 40),
    attentionMarks: str(o.attentionMarks, 20),
    ownersCount: str(o.ownersCount, 20),
    checks,
    mileage: withFallback(mileage, emptyCcVinMileageRow),
    damages: withFallback(damages, emptyCcVinDamageRow),
    insurance: withFallback(records("insurance"), emptyCcVinRecordRow),
    brands: withFallback(records("brands"), emptyCcVinRecordRow),
    titles: withFallback(titles, emptyCcVinTitleRow),
    sales: withFallback(salesAligned, emptyCcVinSaleRow),
    ...(services.length > 0 ? { services } : {}),
    ...(specs.length > 0 ? { specs } : {}),
    comments: str(o.comments, 12000),
    rawUnprocessedData: str(o.rawUnprocessedData, 200000),
    aiContextRaw: str(o.aiContextRaw, 200000),
    photos: synced.photos,
    photoGroups: synced.photoGroups,
    thecarapiRecords,
    hidePhotoWatermarks: o.hidePhotoWatermarks === true,
    ...("pdfChecklist" in o ? { pdfChecklist: normalizeChecklist(o.pdfChecklist) } : {}),
  };
}

/**
 * Izsoļu vēstures rindas datums = izsoles ieraksta (detaļu) datums, ja rinda atsaucas uz to pašu loti.
 * 27.11 (WVWZZZ3CZNE054721): vēsture dod `last_seen_at` (rāpuļa pēdējā redzēšana, UTC), detaļas - izsoles beigas;
 * tabulā / laika joslā bija 11.11, izsoles kartītē 12.11 (tāpat 08.10 / 09.10, 05.11 / 06.11).
 * Tikai, ja atšķirība ≤ 7 dienas (cita lote ar to pašu id nav iespējama, bet nepareizu datumu neievedam).
 */
export function alignCcVinSaleDatesWithRecords<T extends { date: string; status: string }>(
  sales: readonly T[],
  records: readonly { id: string; date: string }[] | null | undefined,
): T[] {
  if (!records?.length) return [...sales];
  const dotDay = (iso: string): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  };
  const ms = (dot: string): number => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dot.trim());
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : NaN;
  };
  return sales.map((row) => {
    const ids = row.status.split("·").map((x) => x.trim()).filter(Boolean);
    const rec = records.find((r) => r.id && ids.includes(r.id));
    const recDay = rec ? dotDay(rec.date) : "";
    if (!recDay || recDay === row.date.trim()) return row;
    const a = ms(recDay);
    const b = ms(row.date);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 7 * 86_400_000) return row;
    return { ...row, date: recDay };
  });
}

/** AI konteksts / avotu žurnāls - bloka saturs vienkāršā tekstā. */
export function ccVinBlockToPlainText(b: CcVinBlockState | null | undefined): string {
  if (!b || !ccVinBlockHasContent(b)) return "";
  const lines: string[] = [CC_VIN_PDF_TITLE];
  if (b.reportDate.trim()) lines.push(`Atskaites datums: ${b.reportDate.trim()}`);
  if (b.attentionMarks.trim()) lines.push(`Atzīmes reģistros: ${b.attentionMarks.trim()}`);
  if (b.ownersCount.trim()) lines.push(`Īpašnieku skaits: ${b.ownersCount.trim()}`);

  const alerts = ccVinAlertChecks(b);
  if (alerts.length > 0) {
    lines.push(CC_VIN_SUBTITLES.flags);
    for (const c of alerts) lines.push(`${c.label}: ${c.status}`);
  }

  const mileage = (b.mileage ?? []).filter(autoRecordsRowHasData);
  if (mileage.length > 0) {
    lines.push("Odometra ieraksti");
    for (const r of mileage) lines.push([r.date, r.odometer, r.country].filter(Boolean).join("\t"));
  }

  const damages = (b.damages ?? []).filter(ccVinDamageRowHasData);
  if (damages.length > 0) {
    lines.push(CC_VIN_SUBTITLES.damages);
    for (const r of damages) {
      lines.push([r.date, r.description, r.amount, r.region].filter(Boolean).join("\t"));
    }
  }

  const simple = (title: string, rows: CcVinRecordRow[]) => {
    const printable = rows.filter(ccVinRecordRowHasData);
    if (printable.length === 0) return;
    lines.push(title);
    for (const r of printable) lines.push([r.date, r.label, r.detail].filter(Boolean).join("\t"));
  };
  simple(CC_VIN_SUBTITLES.brands, b.brands ?? []);
  simple(CC_VIN_SUBTITLES.insurance, b.insurance ?? []);

  const titles = (b.titles ?? []).filter(ccVinTitleRowHasData);
  if (titles.length > 0) {
    lines.push(CC_VIN_SUBTITLES.titles);
    for (const r of titles) lines.push([r.date, r.region, r.odometer, r.note].filter(Boolean).join("\t"));
  }

  const sales = (b.sales ?? []).filter(ccVinSaleRowHasData);
  if (sales.length > 0) {
    lines.push(CC_VIN_SUBTITLES.sales);
    for (const r of sales) {
      lines.push([r.date, r.venue, r.odometer, r.price, r.status].filter(Boolean).join("\t"));
    }
  }

  const services = (b.services ?? []).filter(ccVinServiceRowHasData);
  if (services.length > 0) {
    lines.push(CC_VIN_SUBTITLES.services);
    for (const r of services) {
      lines.push([r.date, r.odometer && `${r.odometer} km`, r.description.replace(/\n+/g, "; ")].filter(Boolean).join("\t"));
    }
  }

  const specs = (b.specs ?? []).filter(ccVinSpecRowHasData);
  if (specs.length > 0) {
    lines.push(CC_VIN_SUBTITLES.specs);
    for (const r of specs) lines.push(`${r.label}: ${r.value}`);
  }

  if (b.comments.trim()) lines.push(b.comments.trim());
  return lines.join("\n");
}
