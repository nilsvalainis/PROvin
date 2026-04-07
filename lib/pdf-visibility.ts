/**
 * Admin darba zonas iestatījumi: kuri bloki iekļauti klienta PDF (noklusējums — visi ieslēgti).
 */

export type PdfVisibilitySettings = {
  payment: boolean;
  vehicle: boolean;
  client: boolean;
  notes: boolean;
  portfolio: boolean;
  alerts: boolean;
  /** Apvienotā „NOBRAUKUMA VĒSTURE” zona (visi avoti, kas atļauti atsevišķi). */
  unifiedMileage: boolean;
  /** CSDD rindas apvienotajā nobraukuma tabulā (CSDD strukturētie lauki var būt ieslēgti atsevišķi). */
  csddMileageTable: boolean;
  unifiedIncidents: boolean;
  csdd: boolean;
  autodna: boolean;
  carvertical: boolean;
  auto_records: boolean;
  ltab: boolean;
  citi_avoti: boolean;
  sludinajums: boolean;
  iriss: boolean;
};

export const DEFAULT_PDF_VISIBILITY: PdfVisibilitySettings = {
  payment: true,
  vehicle: true,
  client: true,
  notes: true,
  portfolio: true,
  alerts: true,
  unifiedMileage: true,
  csddMileageTable: true,
  unifiedIncidents: true,
  csdd: true,
  autodna: true,
  carvertical: true,
  auto_records: true,
  ltab: true,
  citi_avoti: true,
  sludinajums: true,
  iriss: true,
};

function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/** Saglabāta JSON / daļēji objekti — saplūst ar noklusējumu. */
export function mergePdfVisibility(raw: unknown): PdfVisibilitySettings {
  const d = DEFAULT_PDF_VISIBILITY;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    payment: isBool(o.payment) ? o.payment : d.payment,
    vehicle: isBool(o.vehicle) ? o.vehicle : d.vehicle,
    client: isBool(o.client) ? o.client : d.client,
    notes: isBool(o.notes) ? o.notes : d.notes,
    portfolio: isBool(o.portfolio) ? o.portfolio : d.portfolio,
    alerts: isBool(o.alerts) ? o.alerts : d.alerts,
    unifiedMileage: isBool(o.unifiedMileage) ? o.unifiedMileage : d.unifiedMileage,
    csddMileageTable: isBool(o.csddMileageTable) ? o.csddMileageTable : d.csddMileageTable,
    unifiedIncidents: isBool(o.unifiedIncidents) ? o.unifiedIncidents : d.unifiedIncidents,
    csdd: isBool(o.csdd) ? o.csdd : d.csdd,
    autodna: isBool(o.autodna) ? o.autodna : d.autodna,
    carvertical: isBool(o.carvertical) ? o.carvertical : d.carvertical,
    auto_records: isBool(o.auto_records) ? o.auto_records : d.auto_records,
    ltab: isBool(o.ltab) ? o.ltab : d.ltab,
    citi_avoti: isBool(o.citi_avoti) ? o.citi_avoti : d.citi_avoti,
    sludinajums: isBool(o.sludinajums) ? o.sludinajums : d.sludinajums,
    iriss: isBool(o.iriss) ? o.iriss : d.iriss,
  };
}
