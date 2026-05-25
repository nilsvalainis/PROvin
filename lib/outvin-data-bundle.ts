/**
 * Outvin strukturētie dati — saglabājas `auto_records.outvin` pasūtījuma melnrakstā.
 */
import {
  emptyOutvinVehicleInfo,
  outvinDealerReportHasContent,
  type OutvinDealerReport,
  type OutvinEquipmentLine,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { getOutvinCatalogSlotByType, type OutvinSlotAvailability } from "@/lib/outvin-source-catalog";

export type OutvinDealerServiceRow = AutoRecordsServiceRow & {
  serviceNotes: string;
};

export type OutvinUsCarfaxData = {
  importDate: string;
  registeredDamage: string;
  auctionData: string;
  usOdometer: string;
  notes: string;
};

export type OutvinEuropeanRegisterRow = {
  date: string;
  country: string;
  registerType: string;
  details: string;
};

export type OutvinPurchaseRecord = {
  historyType: number;
  fetchedAt: string;
  payload: unknown;
};

export type OutvinCapabilitySlotUi = {
  id: string;
  historyType: number;
  titleLv: string;
  creditCost: number;
  status: OutvinSlotAvailability;
  statusReason?: string;
  category: "service_history" | "us_carfax";
};

export type OutvinPdfSectionToggles = {
  vehicleEquipment: boolean;
  dealerService: boolean;
  usCarfax: boolean;
  europeanRegisters: boolean;
};

export type OutvinDataBundle = {
  precheckAt: string | null;
  vin: string;
  capabilitySlots: OutvinCapabilitySlotUi[];
  purchases: OutvinPurchaseRecord[];
  vehicleInfo: OutvinVehicleInfo;
  equipment: OutvinEquipmentLine[];
  accidentCheck: string;
  stolenCheck: string;
  dealerServiceLog: OutvinDealerServiceRow[];
  usCarfax: OutvinUsCarfaxData;
  europeanRegisters: OutvinEuropeanRegisterRow[];
  pdfSections: OutvinPdfSectionToggles;
};

export function emptyOutvinUsCarfax(): OutvinUsCarfaxData {
  return {
    importDate: "",
    registeredDamage: "",
    auctionData: "",
    usOdometer: "",
    notes: "",
  };
}

export function emptyOutvinEuropeanRow(): OutvinEuropeanRegisterRow {
  return { date: "", country: "", registerType: "", details: "" };
}

export function emptyOutvinDealerServiceRow(): OutvinDealerServiceRow {
  return { date: "", odometer: "", country: "", serviceNotes: "" };
}

export function emptyOutvinPdfSections(): OutvinPdfSectionToggles {
  return {
    vehicleEquipment: true,
    dealerService: true,
    usCarfax: true,
    europeanRegisters: true,
  };
}

export function emptyOutvinDataBundle(vin = ""): OutvinDataBundle {
  return {
    precheckAt: null,
    vin,
    capabilitySlots: [],
    purchases: [],
    vehicleInfo: emptyOutvinVehicleInfo(),
    equipment: [],
    accidentCheck: "",
    stolenCheck: "",
    dealerServiceLog: [emptyOutvinDealerServiceRow()],
    usCarfax: emptyOutvinUsCarfax(),
    europeanRegisters: [emptyOutvinEuropeanRow()],
    pdfSections: emptyOutvinPdfSections(),
  };
}

export function outvinDealerServiceRowHasData(r: OutvinDealerServiceRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.country.trim() || r.serviceNotes.trim());
}

export function outvinEuropeanRowHasData(r: OutvinEuropeanRegisterRow): boolean {
  return Boolean(r.date.trim() || r.country.trim() || r.registerType.trim() || r.details.trim());
}

export function outvinUsCarfaxHasData(d: OutvinUsCarfaxData): boolean {
  return Boolean(
    d.importDate.trim() ||
      d.registeredDamage.trim() ||
      d.auctionData.trim() ||
      d.usOdometer.trim() ||
      d.notes.trim(),
  );
}

export function outvinBundleHasStructuredContent(b: OutvinDataBundle | undefined | null): boolean {
  if (!b) return false;
  if (b.dealerServiceLog.some(outvinDealerServiceRowHasData)) return true;
  if (outvinUsCarfaxHasData(b.usCarfax)) return true;
  if (b.europeanRegisters.some(outvinEuropeanRowHasData)) return true;
  if (outvinDealerReportHasContent({
    vehicleInfo: b.vehicleInfo,
    accidentCheck: b.accidentCheck,
    stolenCheck: b.stolenCheck,
    equipment: b.equipment,
  })) {
    return true;
  }
  return b.purchases.length > 0;
}

export function hasOutvinPurchaseForType(b: OutvinDataBundle, historyType: number): boolean {
  return b.purchases.some((p) => p.historyType === historyType);
}

/** Nobraukuma tabula (vienotajam grafikam) — tikai km rindas no dīlera žurnāla. */
export function dealerLogToMileageRows(log: OutvinDealerServiceRow[]): AutoRecordsServiceRow[] {
  return log
    .filter((r) => r.date.trim() || r.odometer.trim())
    .map(({ date, odometer, country }) => ({ date, odometer, country }));
}

export function migrateOutvinReportToBundle(
  report: OutvinDealerReport | undefined,
  base: OutvinDataBundle,
): OutvinDataBundle {
  if (!report || !outvinDealerReportHasContent(report)) return base;
  return {
    ...base,
    vehicleInfo: report.vehicleInfo,
    equipment: report.equipment,
    accidentCheck: report.accidentCheck,
    stolenCheck: report.stolenCheck,
  };
}

function parsePurchase(raw: unknown): OutvinPurchaseRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const historyType = typeof o.historyType === "number" ? o.historyType : Number(o.historyType);
  if (!Number.isFinite(historyType)) return null;
  return {
    historyType,
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : new Date().toISOString(),
    payload: o.payload ?? null,
  };
}

function parseDealerRow(raw: unknown): OutvinDealerServiceRow {
  if (!raw || typeof raw !== "object") return emptyOutvinDealerServiceRow();
  const o = raw as Record<string, unknown>;
  return {
    date: String(o.date ?? "").slice(0, 40),
    odometer: String(o.odometer ?? "").slice(0, 40),
    country: String(o.country ?? "").slice(0, 120),
    serviceNotes: String(o.serviceNotes ?? "").slice(0, 500),
  };
}

export function parseOutvinDataBundleRaw(raw: unknown, fallbackVin = ""): OutvinDataBundle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const base = emptyOutvinDataBundle(typeof o.vin === "string" ? o.vin : fallbackVin);

  if (typeof o.precheckAt === "string") base.precheckAt = o.precheckAt.slice(0, 40);
  if (Array.isArray(o.capabilitySlots)) {
    base.capabilitySlots = o.capabilitySlots
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const x = s as Record<string, unknown>;
        const historyType = Number(x.historyType);
        if (!Number.isFinite(historyType)) return null;
        const slot = getOutvinCatalogSlotByType(historyType);
        return {
          id: String(x.id ?? slot?.id ?? `type_${historyType}`),
          historyType,
          titleLv: String(x.titleLv ?? slot?.titleLv ?? `Type ${historyType}`),
          creditCost: typeof x.creditCost === "number" ? x.creditCost : 1,
          status: (x.status as OutvinSlotAvailability) ?? "available",
          statusReason: typeof x.statusReason === "string" ? x.statusReason : undefined,
          category: (x.category as OutvinCapabilitySlotUi["category"]) ?? slot?.category ?? "service_history",
        };
      })
      .filter(Boolean) as OutvinCapabilitySlotUi[];
  }

  if (Array.isArray(o.purchases)) {
    base.purchases = o.purchases.map(parsePurchase).filter(Boolean) as OutvinPurchaseRecord[];
  }

  if (o.vehicleInfo && typeof o.vehicleInfo === "object") {
    const v = o.vehicleInfo as Record<string, unknown>;
    for (const key of Object.keys(base.vehicleInfo) as (keyof OutvinVehicleInfo)[]) {
      if (typeof v[key] === "string") base.vehicleInfo[key] = v[key].slice(0, 500);
    }
  }

  if (Array.isArray(o.equipment)) {
    base.equipment = o.equipment
      .map((line) => {
        if (!line || typeof line !== "object") return null;
        const x = line as Record<string, unknown>;
        return {
          code: String(x.code ?? "").slice(0, 32),
          description: String(x.description ?? "").slice(0, 400),
        };
      })
      .filter(Boolean) as OutvinEquipmentLine[];
  }

  if (typeof o.accidentCheck === "string") base.accidentCheck = o.accidentCheck.slice(0, 8000);
  if (typeof o.stolenCheck === "string") base.stolenCheck = o.stolenCheck.slice(0, 8000);

  if (Array.isArray(o.dealerServiceLog)) {
    const rows = o.dealerServiceLog.map(parseDealerRow).filter(outvinDealerServiceRowHasData);
    base.dealerServiceLog = rows.length > 0 ? rows : [emptyOutvinDealerServiceRow()];
  }

  if (o.usCarfax && typeof o.usCarfax === "object") {
    const u = o.usCarfax as Record<string, unknown>;
    base.usCarfax = {
      importDate: String(u.importDate ?? "").slice(0, 40),
      registeredDamage: String(u.registeredDamage ?? "").slice(0, 4000),
      auctionData: String(u.auctionData ?? "").slice(0, 4000),
      usOdometer: String(u.usOdometer ?? "").slice(0, 80),
      notes: String(u.notes ?? "").slice(0, 4000),
    };
  }

  if (Array.isArray(o.europeanRegisters)) {
    const er = o.europeanRegisters
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const x = row as Record<string, unknown>;
        const r: OutvinEuropeanRegisterRow = {
          date: String(x.date ?? "").slice(0, 40),
          country: String(x.country ?? "").slice(0, 120),
          registerType: String(x.registerType ?? "").slice(0, 120),
          details: String(x.details ?? "").slice(0, 500),
        };
        return outvinEuropeanRowHasData(r) ? r : null;
      })
      .filter(Boolean) as OutvinEuropeanRegisterRow[];
    base.europeanRegisters = er.length > 0 ? er : [emptyOutvinEuropeanRow()];
  }

  if (o.pdfSections && typeof o.pdfSections === "object") {
    const p = o.pdfSections as Record<string, unknown>;
    base.pdfSections = {
      vehicleEquipment: p.vehicleEquipment !== false,
      dealerService: p.dealerService !== false,
      usCarfax: p.usCarfax !== false,
      europeanRegisters: p.europeanRegisters !== false,
    };
  }

  return base;
}
